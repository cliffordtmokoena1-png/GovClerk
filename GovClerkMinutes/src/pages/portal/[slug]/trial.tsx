/**
 * Portal Trial Page — /portal/[slug]/trial
 *
 * Shown for authenticated users who do not have an active subscription.
 * Displays a read-only preview of the portal with upgrade CTAs.
 * No Org Dashboard access. No broadcast controls.
 *
 * Access rules:
 *   - Not authenticated → redirect to /portal/[slug]/sign-in
 *   - GovClerk admin OR active subscription → redirect to /portal/[slug]/admin
 *   - Otherwise → show trial/preview page
 */

import { GetServerSideProps } from "next";
import { useState } from "react";
import { RESERVED_PORTAL_SLUGS } from "@/pages/api/portal/utils/initializePortalSettings";
import type { PublicPortalResponse } from "@/types/portal";
import type { PortalAnnouncement } from "@/types/publicRecords";
import { PublicPortalLayout, DemoPortalView } from "@/components/portal/public";
import { getPortalSessionFromCookieHeader, isGovClerkAdmin } from "@/portal-auth/portalAuth";
import { makeDefaultPortalSettings } from "@/utils/defaultPortalSettings";

interface TrialPortalPageProps {
  settings: PublicPortalResponse["settings"];
  slug: string;
  announcements: PortalAnnouncement[];
  portalExists: boolean;
}

function AnnouncementsBanner({
  announcements,
}: Readonly<{ announcements: PortalAnnouncement[] }>) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div aria-live="polite" aria-label="Portal announcements">
      {visible.map((a) => {
        const bgClass =
          a.type === "emergency"
            ? "bg-red-50 border-red-400"
            : a.type === "alert"
              ? "bg-yellow-50 border-yellow-400"
              : "bg-blue-50 border-blue-300";
        const textClass =
          a.type === "emergency"
            ? "text-red-900"
            : a.type === "alert"
              ? "text-yellow-900"
              : "text-blue-900";
        return (
          <div
            key={a.id}
            className={`border-b px-4 py-3 ${bgClass}`}
            role="region"
            aria-label={a.title}
          >
            <div className="max-w-7xl mx-auto flex items-start justify-between gap-4">
              <div className={`flex-1 text-sm ${textClass}`}>
                <strong>{a.title}</strong>
                {a.body && <span className="ml-2 opacity-80">{a.body}</span>}
              </div>
              <button
                type="button"
                onClick={() => setDismissed((prev) => new Set(prev).add(a.id))}
                aria-label={`Dismiss announcement: ${a.title}`}
                className={`flex-shrink-0 text-lg leading-none ${textClass} hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-current rounded`}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TrialPortalPage({
  settings,
  slug,
  announcements,
}: TrialPortalPageProps) {
  return (
    <>
      <AnnouncementsBanner announcements={announcements} />
      <PublicPortalLayout
        settings={settings}
        meetings={[]}
        filter={{ sortBy: "newest" }}
        onFilterChange={() => {}}
      >
        <DemoPortalView slug={slug} accentColor={settings.accentColor} />
      </PublicPortalLayout>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<TrialPortalPageProps> = async (context) => {
  const { slug } = context.params as { slug: string };

  if (RESERVED_PORTAL_SLUGS.has(slug)) {
    return { notFound: true };
  }

  // Require authentication
  const session = await getPortalSessionFromCookieHeader(context.req.headers.cookie).catch(
    () => null
  );
  if (!session) {
    return {
      redirect: {
        destination: `/portal/${slug}/sign-in`,
        permanent: false,
      },
    };
  }

  // GovClerk admins always go to admin
  if (isGovClerkAdmin(session.email)) {
    return {
      redirect: {
        destination: `/portal/${slug}/admin`,
        permanent: false,
      },
    };
  }

  // Check subscription — paying subscribers go to admin
  try {
    const { getPortalDbConnection } = await import("@/utils/portalDb");
    const conn = getPortalDbConnection();
    const subResult = await conn.execute(
      "SELECT tier, status FROM gc_portal_subscriptions WHERE org_id = ? AND status IN ('active', 'trial') LIMIT 1",
      [session.orgId]
    );
    if ((subResult.rows as any[]).length > 0) {
      return {
        redirect: {
          destination: `/portal/${slug}/admin`,
          permanent: false,
        },
      };
    }
  } catch {
    // DB error — continue to show trial page
  }

  const host = context.req.headers.host || "localhost:3000";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${isLocalhost ? "http" : "https"}://${host}`;

  let settings = makeDefaultPortalSettings(slug);
  let portalExists = false;
  try {
    const res = await fetch(`${baseUrl}/api/public/portal/${slug}`);
    if (res.ok) {
      const data = await res.json();
      settings = data.settings;
      portalExists = true;
    }
  } catch {
    // ignore
  }

  let announcements: PortalAnnouncement[] = [];
  try {
    const res = await fetch(`${baseUrl}/api/public/portal/${slug}/announcements`);
    if (res.ok) {
      const data = await res.json();
      announcements = data.announcements || [];
    }
  } catch {
    // ignore
  }

  return {
    props: {
      settings,
      slug,
      announcements,
      portalExists,
    },
  };
};
