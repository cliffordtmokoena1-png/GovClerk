import withErrorReporting from "@/error/withErrorReporting";
import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const orgId = url.searchParams.get("orgId");

  if (!slug) {
    return errorResponse("Slug parameter is required", 400);
  }

  const conn = getPortalDbConnection();

  // If orgId provided, exclude it from the check (allow org's own slug)
  const result = orgId
    ? await conn.execute("SELECT id FROM gc_portal_settings WHERE slug = ? AND org_id != ?", [
        slug,
        orgId,
      ])
    : await conn.execute("SELECT id FROM gc_portal_settings WHERE slug = ?", [slug]);

  const available = result.rows.length === 0;

  return jsonResponse({ available });
}

export default withErrorReporting(handler);
