import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import withErrorReporting from "@/error/withErrorReporting";
import type { SubmitPublicCommentRequest } from "@/types/liveSession";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const slugIndex = pathParts.indexOf("portal") + 1;
  const slug = pathParts[slugIndex];
  const meetingId = Number(pathParts[pathParts.indexOf("meetings") + 1]);

  if (!slug || !meetingId || isNaN(meetingId)) {
    return errorResponse("Invalid portal slug or meeting ID", 400);
  }

  const body = (await req.json()) as SubmitPublicCommentRequest;
  const { speakerName, speakerEmail, topic, commentText, agendaItemId } = body;

  if (!speakerName || !speakerName.trim()) {
    return errorResponse("speakerName is required", 400);
  }
  if (!topic || !topic.trim()) {
    return errorResponse("topic is required", 400);
  }
  if (speakerName.trim().length > 255) {
    return errorResponse("speakerName must be 255 characters or fewer", 400);
  }
  if (topic.trim().length > 500) {
    return errorResponse("topic must be 500 characters or fewer", 400);
  }

  const conn = getPortalDbConnection();

  // Validate portal and meeting exist
  const settingsResult = await conn.execute(
    "SELECT id, org_id FROM gc_portal_settings WHERE slug = ? AND is_enabled = true",
    [slug]
  );
  if (settingsResult.rows.length === 0) {
    return errorResponse("Portal not found", 404);
  }

  const orgId = (settingsResult.rows[0] as any).org_id;

  // Find active broadcast for this meeting (if any) to link broadcast_id
  const broadcastResult = await conn.execute(
    "SELECT id FROM gc_broadcasts WHERE meeting_id = ? AND org_id = ? AND status IN ('live','paused') ORDER BY created_at DESC LIMIT 1",
    [meetingId, orgId]
  );
  const broadcastId =
    broadcastResult.rows.length > 0 ? Number((broadcastResult.rows[0] as any).id) : null;

  await conn.execute(
    `INSERT INTO gc_portal_public_comments
      (org_id, meeting_id, broadcast_id, agenda_item_id, speaker_name, speaker_email, topic, comment_text, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      orgId,
      meetingId,
      broadcastId,
      agendaItemId ?? null,
      speakerName.trim(),
      speakerEmail?.trim() ?? null,
      topic.trim(),
      commentText?.trim() ?? null,
    ]
  );

  return jsonResponse(
    {
      message:
        "Your request to speak has been submitted. The clerk will review and add you to the queue.",
    },
    201
  );
}

export default withErrorReporting(handler);
