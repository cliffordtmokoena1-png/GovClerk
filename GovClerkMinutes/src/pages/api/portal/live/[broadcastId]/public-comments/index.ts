import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import { requirePortalAuth } from "@/portal-auth/requirePortalAuth";
import type { PortalSessionPayload } from "@/portal-auth/portalAuth";
import type { PublicComment, PublicCommentStatus } from "@/types/liveSession";

export const config = {
  runtime: "edge",
};

function rowToComment(row: any): PublicComment {
  return {
    id: Number(row.id),
    orgId: row.org_id,
    meetingId: Number(row.meeting_id),
    broadcastId: row.broadcast_id ? Number(row.broadcast_id) : null,
    agendaItemId: row.agenda_item_id ? Number(row.agenda_item_id) : null,
    speakerName: row.speaker_name,
    speakerEmail: row.speaker_email ?? null,
    topic: row.topic,
    commentText: row.comment_text ?? null,
    status: row.status,
    positionInQueue: row.position_in_queue ? Number(row.position_in_queue) : null,
    timeLimitSeconds: Number(row.time_limit_seconds),
    submittedAt: row.submitted_at,
    spokenAt: row.spoken_at ?? null,
  };
}

async function handler(req: NextRequest, session: PortalSessionPayload): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const broadcastId = Number(pathParts[pathParts.indexOf("live") + 1]);

  if (!broadcastId || isNaN(broadcastId)) {
    return errorResponse("Invalid broadcast ID", 400);
  }

  const { orgId } = session;
  const conn = getPortalDbConnection();

  if (req.method === "GET") {
    const result = await conn.execute(
      "SELECT * FROM gc_portal_public_comments WHERE broadcast_id = ? AND org_id = ? ORDER BY submitted_at",
      [broadcastId, orgId]
    );
    const comments = result.rows.map(rowToComment);
    return jsonResponse({ comments });
  }

  if (req.method === "PUT") {
    const body = await req.json();
    const { id, status, positionInQueue } = body as {
      id: number;
      status: PublicCommentStatus;
      positionInQueue?: number;
    };

    if (!id || !status) {
      return errorResponse("id and status are required", 400);
    }

    const validStatuses: PublicCommentStatus[] = [
      "pending",
      "approved",
      "spoken",
      "rejected",
      "withdrawn",
    ];
    if (!validStatuses.includes(status)) {
      return errorResponse("Invalid status value", 400);
    }

    // All field names in `fields` are hardcoded string literals — no user input reaches column names
    const fields = ["status = ?"];
    const values: (string | number | null)[] = [status];

    if (positionInQueue !== undefined) {
      fields.push("position_in_queue = ?");
      values.push(positionInQueue);
    }

    if (status === "spoken") {
      fields.push("spoken_at = CURRENT_TIMESTAMP");
    }

    values.push(id, broadcastId, orgId);

    await conn.execute(
      `UPDATE gc_portal_public_comments SET ${fields.join(", ")} WHERE id = ? AND broadcast_id = ? AND org_id = ?`,
      values
    );

    const result = await conn.execute("SELECT * FROM gc_portal_public_comments WHERE id = ?", [id]);
    const comment = result.rows.length > 0 ? rowToComment(result.rows[0] as any) : null;
    return jsonResponse({ comment });
  }

  return errorResponse("Method not allowed", 405);
}

export default requirePortalAuth(handler);
