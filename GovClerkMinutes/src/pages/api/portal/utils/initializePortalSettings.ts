import { Connection } from "@planetscale/database";
import type { PortalSettings, NavLink } from "@/types/portal";

export const DEFAULT_HEADER_BG_COLOR = "#1a365d";
export const DEFAULT_HEADER_TEXT_COLOR = "#ffffff";
export const DEFAULT_ACCENT_COLOR = "#3182ce";

/**
 * Org slug values that conflict with Next.js portal page routes.
 * Note: "demo" and "live" are NOT listed here — they are fixed sub-path
 * segments in `/portal/[slug]/demo` and `/portal/[slug]/live`, never org
 * slugs, so they create no routing conflict.
 */
export const RESERVED_PORTAL_SLUGS = new Set([
  "admin",
  "sign-in",
  "sign-up",
  "register",
  "forgot-password",
  "reset-password",
  "verify",
  "broadcast",
  "calendar",
  "records",
  "notices",
  "request-records",
]);

/**
 * Converts an org display name into a URL-safe slug:
 * lowercase → replace non-alphanumeric runs with "-" → collapse → trim ends.
 */
export function slugifyOrgName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Derives the best unique portal slug from an org name + Clerk slug.
 * Checks uniqueness against `gc_portal_settings` in the supplied connection.
 */
export async function generateUniquePortalSlug(
  conn: Connection,
  orgName: string | null | undefined,
  clerkSlug: string | null | undefined
): Promise<string> {
  const base = slugifyOrgName(orgName);

  let candidate: string;
  if (!base || RESERVED_PORTAL_SLUGS.has(base)) {
    // Fall back to Clerk slug if it is not reserved/empty
    if (clerkSlug && !RESERVED_PORTAL_SLUGS.has(clerkSlug) && clerkSlug.trim() !== "") {
      candidate = clerkSlug;
    } else {
      // Append -portal to the org name slug (or clerk slug as last resort)
      const fallbackBase = base || clerkSlug || "org";
      candidate = `${fallbackBase}-portal`;
    }
  } else {
    candidate = base;
  }

  // Ensure uniqueness by appending -2, -3, … as needed (max 100 attempts)
  let slug = candidate;
  let counter = 2;
  while (counter <= 100) {
    const existing = await conn.execute("SELECT id FROM gc_portal_settings WHERE slug = ?", [slug]);
    if ((existing.rows as any[]).length === 0) break;
    slug = `${candidate}-${counter}`;
    counter++;
  }

  return slug;
}

export interface PortalSettingsRow {
  id: number;
  org_id: string;
  slug: string;
  page_title: string | null;
  page_description: string | null;
  logo_url: string | null;
  header_bg_color: string;
  header_text_color: string;
  accent_color: string;
  nav_links: string | null;
  is_enabled: number;
  created_at: string;
  updated_at: string;
}

export function rowToPortalSettings(row: PortalSettingsRow): PortalSettings {
  let navLinks: NavLink[] | null = null;
  if (typeof row.nav_links === "string") {
    navLinks = JSON.parse(row.nav_links);
  }

  return {
    id: row.id,
    orgId: row.org_id,
    slug: row.slug,
    pageTitle: row.page_title,
    pageDescription: row.page_description,
    logoUrl: row.logo_url,
    headerBgColor: row.header_bg_color,
    headerTextColor: row.header_text_color,
    accentColor: row.accent_color,
    navLinks: navLinks || null,
    isEnabled: Boolean(row.is_enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Gets existing portal settings for an organization, or creates default settings if none exist.
 * This ensures admin APIs always return settings instead of 404.
 *
 * @param orgName - The org's display name (used to derive a human-readable slug).
 * @param orgSlug - The Clerk `org.slug` used as a fallback when the display name is reserved.
 */
export async function getOrCreatePortalSettings(
  conn: Connection,
  orgId: string,
  orgSlug: string,
  orgName?: string | null
): Promise<PortalSettings> {
  // Check for existing settings
  const existing = await conn.execute("SELECT * FROM gc_portal_settings WHERE org_id = ?", [orgId]);

  if (existing.rows.length > 0) {
    return rowToPortalSettings(existing.rows[0] as PortalSettingsRow);
  }

  // Derive a human-readable, unique slug from the org display name.
  const portalSlug = await generateUniquePortalSlug(conn, orgName, orgSlug);

  // Create default settings (id is auto-generated)
  await conn.execute(
    `INSERT INTO gc_portal_settings (
      org_id, slug, header_bg_color, header_text_color, accent_color, is_enabled
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE id = id`,
    [
      orgId,
      portalSlug,
      DEFAULT_HEADER_BG_COLOR,
      DEFAULT_HEADER_TEXT_COLOR,
      DEFAULT_ACCENT_COLOR,
      false,
    ]
  );

  console.info(`Auto-created portal settings for organization: ${orgId} with slug: ${portalSlug}`);

  // Fetch the newly created settings
  const created = await conn.execute("SELECT * FROM gc_portal_settings WHERE org_id = ?", [orgId]);
  return rowToPortalSettings(created.rows[0] as PortalSettingsRow);
}
