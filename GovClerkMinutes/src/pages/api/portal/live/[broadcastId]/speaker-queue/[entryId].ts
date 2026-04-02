import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import { requirePortalAuth } from "@/portal-auth/requirePortalAuth";
import type { PortalSessionPayload } from "@/portal-auth/portalAuth";
import type { SpeakerQueueStatus } from "@/types/liveSession";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest, session: PortalSessionPayload): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const liveIndex = pathParts.indexOf("live");
  const broadcastId = Number(pathParts[liveIndex + 1]);
  const entryId = Number(pathParts[liveIndex + 3]);

  if (!broadcastId || isNaN(broadcastId) || !entryId || isNaN(entryId)) {
    return errorResponse("Invalid broadcast ID or entry ID", 400);
  }

  const { orgId } = session;
  const conn = getPortalDbConnection();

  const entryResult = await conn.execute(
    "SELECT * FROM gc_portal_speaker_queue WHERE id = ? AND broadcast_id = ? AND org_id = ?",
    [entryId, broadcastId, orgId]
  );
  if (entryResult.rows.length === 0) {
    return errorResponse("Queue entry not found", 404);
  }

  if (req.method === "PUT") {
    const body = await req.json();
    const { status } = body as { status: SpeakerQueueStatus };

    const validStatuses: SpeakerQueueStatus[] = ["waiting", "speaking", "done", "removed"];
    if (!status || !validStatuses.includes(status)) {
      return errorResponse("Invalid status value", 400);
    }

    // timestampClause uses only hardcoded strings; status is validated against the enum above
    const timestampClause =
      status === "speaking"
        ? ", started_speaking_at = CURRENT_TIMESTAMP"
        : status === "done" || status === "removed"
          ? ", finished_speaking_at = CURRENT_TIMESTAMP"
          : "";

    await conn.execute(
      `UPDATE gc_portal_speaker_queue SET status = ?${timestampClause} WHERE id = ? AND broadcast_id = ? AND org_id = ?`,
      [status, entryId, broadcastId, orgId]
    );

    const updatedResult = await conn.execute("SELECT * FROM gc_portal_speaker_queue WHERE id = ?", [
      entryId,
    ]);
    return jsonResponse({ entry: updatedResult.rows[0] });
  }

  if (req.method === "DELETE") {
    await conn.execute(
      "UPDATE gc_portal_speaker_queue SET status = 'removed', finished_speaking_at = CURRENT_TIMESTAMP WHERE id = ? AND broadcast_id = ? AND org_id = ?",
      [entryId, broadcastId, orgId]
    );
    return jsonResponse({ success: true });
  }

  return errorResponse("Method not allowed", 405);
}

export default requirePortalAuth(handler);
