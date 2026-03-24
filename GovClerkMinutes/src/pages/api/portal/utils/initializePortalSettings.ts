import { Connection } from "@planetscale/database";
import type { PortalSettings, NavLink } from "@/types/portal";

export const DEFAULT_HEADER_BG_COLOR = "#1a365d";
export const DEFAULT_HEADER_TEXT_COLOR = "#ffffff";
export const DEFAULT_ACCENT_COLOR = "#3182ce";

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
 */
export async function getOrCreatePortalSettings(
  conn: Connection,
  orgId: string,
  orgSlug: string
): Promise<PortalSettings> {
  // Check for existing settings
  const existing = await conn.execute("SELECT * FROM gc_portal_settings WHERE org_id = ?", [orgId]);

  if (existing.rows.length > 0) {
    return rowToPortalSettings(existing.rows[0] as PortalSettingsRow);
  }

  // Create default settings (id is auto-generated)
  await conn.execute(
    `INSERT INTO gc_portal_settings (
      org_id, slug, header_bg_color, header_text_color, accent_color, is_enabled
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE id = id`,
    [
      orgId,
      orgSlug,
      DEFAULT_HEADER_BG_COLOR,
      DEFAULT_HEADER_TEXT_COLOR,
      DEFAULT_ACCENT_COLOR,
      false,
    ]
  );

  console.info(`Auto-created portal settings for organization: ${orgId} with slug: ${orgSlug}`);

  // Fetch the newly created settings
  const created = await conn.execute("SELECT * FROM gc_portal_settings WHERE org_id = ?", [orgId]);
  return rowToPortalSettings(created.rows[0] as PortalSettingsRow);
}
