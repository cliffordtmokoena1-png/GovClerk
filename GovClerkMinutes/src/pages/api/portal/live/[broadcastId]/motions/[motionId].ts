import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import { requirePortalAuth } from "@/portal-auth/requirePortalAuth";
import type { PortalSessionPayload } from "@/portal-auth/portalAuth";
import type { MotionStatus } from "@/types/liveSession";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest, session: PortalSessionPayload): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const liveIndex = pathParts.indexOf("live");
  const broadcastId = Number(pathParts[liveIndex + 1]);
  const motionId = Number(pathParts[liveIndex + 3]);

  if (!broadcastId || isNaN(broadcastId) || !motionId || isNaN(motionId)) {
    return errorResponse("Invalid broadcast ID or motion ID", 400);
  }

  const { orgId } = session;
  const conn = getPortalDbConnection();

  // Verify motion exists and belongs to this org
  const motionResult = await conn.execute(
    "SELECT * FROM gc_portal_motions WHERE id = ? AND broadcast_id = ? AND org_id = ?",
    [motionId, broadcastId, orgId]
  );
  if (motionResult.rows.length === 0) {
    return errorResponse("Motion not found", 404);
  }

  if (req.method === "PUT") {
    const body = await req.json();
    const { status, title, description, movedBy, secondedBy, motionType } = body as {
      status?: MotionStatus;
      title?: string;
      description?: string;
      movedBy?: string;
      secondedBy?: string;
      motionType?: string;
    };

    const validStatuses: MotionStatus[] = ["pending", "open", "passed", "failed", "tabled", "withdrawn", "amended"];
    if (status && !validStatuses.includes(status)) {
      return errorResponse("Invalid status value", 400);
    }

    // All field names in `fields` are hardcoded string literals — no user input reaches column names
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (status !== undefined) { fields.push("status = ?"); values.push(status); }
    if (title !== undefined) { fields.push("title = ?"); values.push(title); }
    if (description !== undefined) { fields.push("description = ?"); values.push(description); }
    if (movedBy !== undefined) { fields.push("moved_by = ?"); values.push(movedBy); }
    if (secondedBy !== undefined) { fields.push("seconded_by = ?"); values.push(secondedBy); }
    if (motionType !== undefined) { fields.push("motion_type = ?"); values.push(motionType); }

    if (fields.length === 0) {
      return errorResponse("No fields to update", 400);
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(motionId, broadcastId, orgId);

    await conn.execute(
      `UPDATE gc_portal_motions SET ${fields.join(", ")} WHERE id = ? AND broadcast_id = ? AND org_id = ?`,
      values
    );

    const updatedResult = await conn.execute(
      "SELECT * FROM gc_portal_motions WHERE id = ?",
      [motionId]
    );
    return jsonResponse({ motion: updatedResult.rows[0] });
  }

  if (req.method === "DELETE") {
    await conn.execute(
      "UPDATE gc_portal_motions SET status = 'withdrawn', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND broadcast_id = ? AND org_id = ?",
      [motionId, broadcastId, orgId]
    );
    return jsonResponse({ success: true });
  }

  return errorResponse("Method not allowed", 405);
}

export default requirePortalAuth(handler);
