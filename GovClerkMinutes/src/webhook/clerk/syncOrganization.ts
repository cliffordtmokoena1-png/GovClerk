import { OrganizationJSON } from "@clerk/nextjs/dist/types/server";
import { connect, Connection } from "@planetscale/database";
import {
  DEFAULT_HEADER_BG_COLOR,
  DEFAULT_HEADER_TEXT_COLOR,
  DEFAULT_ACCENT_COLOR,
  generateUniquePortalSlug,
} from "@/pages/api/portal/utils/initializePortalSettings";

type PlanTier = "Free" | "Basic" | "Pro" | "Basic_Annual" | "Pro_Annual" | "Custom";

function resolvePlanTier(value: unknown): PlanTier {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    switch (normalized) {
      case "free":
        return "Free";
      case "basic":
        return "Basic";
      case "pro":
        return "Pro";
      case "basic_annual":
      case "basic-annual":
        return "Basic_Annual";
      case "pro_annual":
      case "pro-annual":
        return "Pro_Annual";
      case "custom":
        return "Custom";
      default:
        break;
    }
  }

  return "Free";
}

function getConnection(): Connection {
  return connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });
}

export async function upsertOrganizationFromWebhook(org: OrganizationJSON): Promise<void> {
  if (!org?.id) {
    console.warn("organization webhook missing id", org);
    return;
  }

  const publicMetadata = (org.public_metadata ?? {}) as Record<string, unknown>;
  const planTier = resolvePlanTier(publicMetadata["plan_tier"]);
  const billingEmail =
    typeof publicMetadata["billing_email"] === "string" ? publicMetadata["billing_email"] : null;
  const settingsJson = JSON.stringify(publicMetadata);
  const primaryOwnerUserId = org.created_by ?? null;

  const conn = getConnection();

  const result = await conn.execute(
    `
      INSERT INTO organizations (id, name, slug, billing_email, plan_tier, settings, primary_owner_user_id, clerk_last_synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        slug = VALUES(slug),
        billing_email = VALUES(billing_email),
        plan_tier = VALUES(plan_tier),
        settings = VALUES(settings),
        primary_owner_user_id = VALUES(primary_owner_user_id),
        clerk_last_synced_at = VALUES(clerk_last_synced_at);
    `,
    [
      org.id,
      org.name ?? null,
      org.slug ?? null,
      billingEmail,
      planTier,
      settingsJson,
      primaryOwnerUserId,
    ]
  );

  const isNewOrg = result.rowsAffected === 1;

  if (isNewOrg) {
    await conn.execute(
      "INSERT INTO payments (user_id, org_id, credit, action, billing_subject) VALUES (NULL, ?, 30, 'add', 'org') ON DUPLICATE KEY UPDATE credit = credit;",
      [org.id]
    );
    console.info(`Initialized 30 free tokens for new organization: ${org.id}`);

    if (org.slug) {
      // Derive a human-readable slug from the org display name (not the Clerk org.slug).
      const portalSlug = await generateUniquePortalSlug(conn, org.name, org.slug);

      // id is auto-generated
      await conn.execute(
        `INSERT INTO gc_portal_settings (
          org_id, slug, header_bg_color, header_text_color, accent_color, is_enabled
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE id = id`,
        [
          org.id,
          portalSlug,
          DEFAULT_HEADER_BG_COLOR,
          DEFAULT_HEADER_TEXT_COLOR,
          DEFAULT_ACCENT_COLOR,
          true, // enabled by default so new organisations can use their portal immediately
        ]
      );
      console.info(
        `Auto-created portal settings for organization: ${org.id} with slug: ${portalSlug}`
      );
    } else {
      console.warn(`Organization ${org.id} has no slug, skipping portal settings creation`);
    }
  }
}

export async function deleteOrganizationById(id: string | null | undefined): Promise<void> {
  if (!id) {
    console.warn("organization webhook delete missing id");
    return;
  }

  const conn = getConnection();
  await conn.execute("DELETE FROM organizations WHERE id = ?", [id]);
}
