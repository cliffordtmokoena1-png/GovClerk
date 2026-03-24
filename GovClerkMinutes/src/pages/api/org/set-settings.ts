import { getAuth } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import withErrorReporting from "@/error/withErrorReporting";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { requireOrgAdmin } from "@/utils/orgPermissions";

export const config = {
  runtime: "edge",
};

export type ApiOrgSetSettingsRequest = {
  orgId: string;
  settings: Record<string, unknown>;
};

export type ApiOrgSetSettingsResponse = {
  success: boolean;
};

async function handler(req: NextRequest) {
  const auth = getAuth(req);
  if (auth.userId == null) {
    return new Response(null, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId, orgId, site } = await resolveRequestContext(auth.userId, body.orgId, req.headers);

  if (!orgId) {
    return new Response(JSON.stringify({ error: "Organization ID required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify user is org admin
  try {
    await requireOrgAdmin(userId, orgId, site);
  } catch (error) {
    return new Response(JSON.stringify({ error: "Only organization admins can update settings" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { settings } = body as ApiOrgSetSettingsRequest;

  if (!settings || typeof settings !== "object") {
    return new Response(JSON.stringify({ error: "Invalid settings object" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  await conn.execute(
    "UPDATE organizations SET settings = ?, updated_at = CURRENT_TIMESTAMP() WHERE id = ?",
    [JSON.stringify(settings), orgId]
  );

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default withErrorReporting(handler);
