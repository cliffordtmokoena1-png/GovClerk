import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";

export const config = {
  runtime: "edge",
};

export type ApiOrgGetSettingsResponse = {
  id: string;
  name: string;
  slug: string | null;
  billingEmail: string | null;
  planTier: string;
  settings: Record<string, unknown>;
  primaryOwnerUserId: string;
};

async function handler(req: NextRequest) {
  const auth = getAuth(req);
  if (auth.userId == null) {
    return new Response(null, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { orgId } = await resolveRequestContext(auth.userId, body.orgId, req.headers);

  if (!orgId) {
    return new Response(JSON.stringify({ error: "Organization ID required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const rows = await conn
    .execute(
      "SELECT id, name, slug, billing_email, plan_tier, settings, primary_owner_user_id FROM organizations WHERE id = ?",
      [orgId]
    )
    .then((res) => res.rows);

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ error: "Organization not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const row = rows[0];
  const settings =
    typeof row["settings"] === "string" ? JSON.parse(row["settings"]) : row["settings"];

  const response: ApiOrgGetSettingsResponse = {
    id: row["id"] as string,
    name: row["name"] as string,
    slug: row["slug"] as string | null,
    billingEmail: row["billing_email"] as string | null,
    planTier: row["plan_tier"] as string,
    settings: settings || {},
    primaryOwnerUserId: row["primary_owner_user_id"] as string,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default withErrorReporting(handler);
