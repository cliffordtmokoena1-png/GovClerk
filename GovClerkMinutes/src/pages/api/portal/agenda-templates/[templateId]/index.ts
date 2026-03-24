import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest): Promise<Response> {
  const auth = getAuth(req);
  if (!auth.userId) {
    return errorResponse("Unauthorized", 401);
  }

  if (req.method !== "DELETE") {
    return errorResponse("Method not allowed", 405);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  // Path: /api/portal/agenda-templates/[templateId]
  const templateId = pathParts[pathParts.length - 2];

  if (!templateId) {
    return errorResponse("Template ID is required", 400);
  }

  const body = await req.json().catch(() => ({ orgId: "" }));
  const { orgId: bodyOrgId } = body;

  const { orgId } = await resolveRequestContext(auth.userId, bodyOrgId, req.headers);

  if (!orgId) {
    return errorResponse("Organization context required", 400);
  }

  const conn = getPortalDbConnection();

  // Verify template exists and belongs to org
  const templateResult = await conn.execute(
    "SELECT id, org_id FROM gc_agenda_templates WHERE id = ? AND org_id = ?",
    [templateId, orgId]
  );

  if (templateResult.rows.length === 0) {
    return errorResponse("Template not found", 404);
  }

  // Delete the template
  await conn.execute("DELETE FROM gc_agenda_templates WHERE id = ? AND org_id = ?", [
    templateId,
    orgId,
  ]);

  return jsonResponse({ success: true });
}

export default withErrorReporting(handler);
