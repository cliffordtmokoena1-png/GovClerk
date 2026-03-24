import puppeteer, { Browser, Page } from "puppeteer";
import mimeDb from "mime-db";
import { extractMeetings } from "./llm/extractMeetings.ts";
import { extractBranding } from "./llm/extractBranding.ts";
import type {
  Artifact,
  ArtifactSource,
  ExtractedPageInfo,
  Manifest,
  Meeting,
  Plan,
} from "./types.ts";

// Contract
// - Inputs: Plan { root, maxDepth, maxBreadth, prompt }
// - Output: Manifest with meetings/artifacts discovered while crawling
// - Error modes: network timeouts, navigation failures, model failures; we continue best-effort
// - Success: returns a Manifest even if partial

// PageAnalysis is now provided by the specialized LLM function analyzePageForMeetings
type PageAnalysis = {
  nextLinks: string[];
  pageMeetings: Meeting<ArtifactSource>[];
};

function toAbsoluteUrl(base: URL, href: string): string | null {
  const u = new URL(href, base);
  if (u.protocol === "http:" || u.protocol === "https:") {
    return u.toString();
  }
  return null;
}

function sameOrigin(a: URL, b: URL): boolean {
  return a.hostname === b.hostname;
}

function normalize(url: string): string {
  const u = new URL(url);
  u.hash = "";
  u.port = "";

  // Remove trailing slash except for root path
  if (u.pathname !== "/" && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/$/, "");
  }
  return u.toString();
}

// Build extension -> mime map once from mime-db
const EXTENSION_TO_MIME: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [mime, def] of Object.entries(mimeDb as Record<string, any>)) {
    const exts: string[] | undefined = def.extensions;
    if (exts) {
      for (const ext of exts) {
        if (!map[ext]) {
          map[ext] = mime;
        }
      }
    }
  }
  return map;
})();

function mimeFromUrlOrNull(url: string): string | null {
  try {
    const u = new URL(url);
    const pathname = u.pathname;
    const lastSegment = pathname.split("/").pop() || "";
    if (!lastSegment.includes(".")) {
      return null; // no extension present
    }
    const ext = lastSegment.split(".").pop()!.toLowerCase();
    if (!ext) {
      return null;
    }
    return EXTENSION_TO_MIME[ext] || null;
  } catch (_) {
    return null;
  }
}

function externalArtifactFromUrl(kind: Artifact["kind"], url: string, name?: string): Artifact {
  return {
    kind,
    name: name || url.split("/").pop() || url,
    bucket: "external-url",
    key: url,
    mime: mimeFromUrlOrNull(url),
  };
}

async function extractPageInfo(page: Page, url: URL): Promise<ExtractedPageInfo> {
  const title = await page.title();
  const meta = await page.evaluate(() => {
    const description =
      document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
    const ogTitle =
      document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
    const ogDesc =
      document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "";
    return { description, ogTitle, ogDesc };
  });

  const textContent = await page.evaluate(() => {
    // Get a trimmed preview of main text content
    const text = document.body?.innerText || "";
    return text.replace(/\s+/g, " ").trim().slice(0, 6000);
  });

  const links: string[] = await page.evaluate(() => {
    const hrefs = Array.from(document.querySelectorAll("a[href]"))
      .map((a) => (a as HTMLAnchorElement).href)
      .filter(Boolean);
    // De-duplicate in page context
    return Array.from(new Set(hrefs));
  });

  const absoluteSameOriginLinks = links
    .map((href) => toAbsoluteUrl(url, href))
    .filter((u): u is string => !!u)
    .map((u) => normalize(u))
    .filter((u) => sameOrigin(new URL(u), url));

  return {
    title,
    description: meta.description || meta.ogDesc || meta.ogTitle || "",
    textPreview: textContent,
    links: Array.from(new Set(absoluteSameOriginLinks)),
  };
}

function prettyNameFromHostname(hostname: string): string {
  return hostname
    .replace(/^www\./, "")
    .split(".")
    .filter((p) => p && p !== "com" && p !== "gov" && p !== "org" && p !== "us")
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

export async function crawl(plan: Plan): Promise<Manifest> {
  const rootUrl = new URL(plan.root);
  console.info(
    `[crawl] Starting crawl root=${plan.root} maxDepth=${plan.maxDepth} maxBreadth=${plan.maxBreadth}`
  );

  let browser: Browser | null = null;
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [
    { url: normalize(rootUrl.toString()), depth: 0 },
  ];

  const manifest: Manifest = {
    orgName: prettyNameFromHostname(rootUrl.hostname) || rootUrl.hostname,
    domain: rootUrl.hostname,
    meetings: [],
  };

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    while (queue.length > 0) {
      const { url, depth } = queue.shift()!;
      console.info(`[crawl] Dequeued depth=${depth} url=${url} (queue=${queue.length})`);
      if (visited.has(url)) {
        continue;
      }
      visited.add(url);

      if (depth > plan.maxDepth) {
        continue;
      }

      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      if (!resp || resp.status()! >= 400) {
        continue;
      }

      const info = await extractPageInfo(page, new URL(url));
      console.info(
        `[crawl] Extracted title='${info.title}' links=${info.links.length} previewLen=${info.textPreview.length}`
      );

      // Attempt branding discovery if we don't yet have orgName refined or logo
      if (!manifest.logo || manifest.orgName === rootUrl.hostname) {
        const candidateImageUrls: string[] = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll("img[src]")) as HTMLImageElement[];
          return imgs.map((i) => i.src).filter(Boolean);
        });
        const branding = await extractBranding({
          pageUrl: url,
          title: info.title,
          description: info.description,
          textPreview: info.textPreview,
          candidateImageUrls,
        });
        console.info(
          `[crawl] Found branding: orgName='${branding.orgName}' logoUrls=${branding.logoUrls.length}`
        );
        if (branding.orgName && branding.orgName.length > 2) {
          manifest.orgName = branding.orgName.trim();
        }
        if (branding.logoUrls && branding.logoUrls.length > 0) {
          manifest.logo = externalArtifactFromUrl("logo", branding.logoUrls[0], "Site Logo");
          console.info(`[crawl] Found logo: ${manifest.logo.key}`);
        }
      }

      let analysis: PageAnalysis = { nextLinks: [], pageMeetings: [] };
      // Collect structured link context (anchor text + enclosing row/list context) for LLM grouping
      const structuredContext: Array<{ url: string; anchorText: string; contextText: string }> =
        await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[];
          const seen = new Set<string>();
          return anchors
            .map((a) => {
              const href = a.href;
              if (!href || seen.has(href)) {
                return null;
              }
              seen.add(href);
              const anchorText = (a.textContent || "").trim();
              let contextEl: HTMLElement | null = a.closest("tr");
              if (!contextEl) {
                contextEl = a.closest("li");
              }
              if (!contextEl) {
                contextEl = a.parentElement;
              }
              const rawContext = (contextEl?.innerText || "").replace(/\s+/g, " ").trim();
              const contextText = rawContext.slice(0, 400);
              return { url: href, anchorText, contextText };
            })
            .filter((x): x is { url: string; anchorText: string; contextText: string } => !!x);
        });

      const extractions = await extractMeetings({
        pageUrl: url,
        title: info.title,
        description: info.description,
        textPreview: info.textPreview,
        candidateLinks: info.links,
        structuredContext,
        maxBreadth: plan.maxBreadth,
      });

      console.info(
        `[crawl] Model: nextLinks=${extractions.nextLinks.length} pageMeetings=${extractions.pageMeetings.length}`
      );

      for (const m of extractions.pageMeetings) {
        const meeting: Meeting<ArtifactSource> = {
          title: m.title.trim(),
          kind: m.kind.trim(),
          date: new Date(m.date).toISOString(),
          location: m.location?.trim(),
          artifacts: (m.artifacts || []) as ArtifactSource[],
        };
        const exists = manifest.meetings.some(
          (x: Meeting<ArtifactSource>) =>
            x.title.toLowerCase() === meeting.title.toLowerCase() && x.date === meeting.date
        );
        if (!exists) {
          manifest.meetings.push(meeting);
          console.info(
            `[crawl] Added meeting: title='${meeting.title}' date=${meeting.date} artifacts=${meeting.artifacts.length}`
          );
        }
      }

      const candidates = (extractions.nextLinks || [])
        .map((href) => toAbsoluteUrl(new URL(url), href) || href)
        .map((u) => normalize(u))
        .filter((u) => sameOrigin(new URL(u), rootUrl) && !visited.has(u));
      for (const next of candidates.slice(0, plan.maxBreadth)) {
        queue.push({ url: next, depth: depth + 1 });
      }
      console.info(
        `[crawl] Enqueued ${Math.min(candidates.length, plan.maxBreadth)} next links (depth=${depth + 1})`
      );
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  console.info(
    `[crawl] Finished: meetings=${manifest.meetings.length} orgName='${manifest.orgName}' logo='${manifest.logo?.key ?? "none"}'`
  );
  return manifest;
}
