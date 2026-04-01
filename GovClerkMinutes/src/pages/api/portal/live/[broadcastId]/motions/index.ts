import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import { requirePortalAuth } from "@/portal-auth/requirePortalAuth";
import type { PortalSessionPayload } from "@/portal-auth/portalAuth";
import type { Motion, CreateMotionRequest } from "@/types/liveSession";

export const config = {
  runtime: "edge",
};

function rowToMotion(row: any): Motion {
  return {
    id: Number(row.id),
    orgId: row.org_id,
    broadcastId: Number(row.broadcast_id),
    meetingId: Number(row.meeting_id),
    agendaItemId: row.agenda_item_id ? Number(row.agenda_item_id) : null,
    motionType: row.motion_type,
    title: row.title,
    description: row.description ?? null,
    movedBy: row.moved_by ?? null,
    secondedBy: row.seconded_by ?? null,
    status: row.status,
    voteResultSummary: row.vote_result_summary ?? null,
    ordinal: Number(row.ordinal),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    const motionsResult = await conn.execute(
      "SELECT * FROM gc_portal_motions WHERE broadcast_id = ? AND org_id = ? ORDER BY ordinal",
      [broadcastId, orgId]
    );
    const votesResult = await conn.execute(
      "SELECT * FROM gc_portal_votes WHERE broadcast_id = ? AND org_id = ?",
      [broadcastId, orgId]
    );

    const votes = votesResult.rows.map((row: any) => ({
      id: Number(row.id),
      orgId: row.org_id,
      motionId: Number(row.motion_id),
      broadcastId: Number(row.broadcast_id),
      memberName: row.member_name,
      memberId: row.member_id ?? null,
      vote: row.vote,
      votedAt: row.voted_at,
    }));

    const motions = motionsResult.rows.map((row: any) => {
      const motion = rowToMotion(row);
      motion.votes = votes.filter((vote) => vote.motionId === motion.id);
      return motion;
    });

    return jsonResponse({ motions });
  }

  if (req.method === "POST") {
    const body = (await req.json()) as CreateMotionRequest;
    const { motionType, title, description, movedBy, secondedBy, agendaItemId } = body;

    if (!title || !motionType) {
      return errorResponse("title and motionType are required", 400);
    }

    const validTypes = ["motion", "resolution", "ordinance", "bylaw", "amendment", "procedural"];
    if (!validTypes.includes(motionType)) {
      return errorResponse("Invalid motion type", 400);
    }

    // Get broadcast to find meeting_id
    const broadcastResult = await conn.execute(
      "SELECT meeting_id FROM gc_broadcasts WHERE id = ? AND org_id = ?",
      [broadcastId, orgId]
    );
    if (broadcastResult.rows.length === 0) {
      return errorResponse("Broadcast not found", 404);
    }
    const meetingId = Number((broadcastResult.rows[0] as any).meeting_id);

    // Get next ordinal
    const ordinalResult = await conn.execute(
      "SELECT COALESCE(MAX(ordinal), 0) + 1 as next_ordinal FROM gc_portal_motions WHERE broadcast_id = ? AND org_id = ?",
      [broadcastId, orgId]
    );
    const nextOrdinal = Number((ordinalResult.rows[0] as any).next_ordinal);

    await conn.execute(
      `INSERT INTO gc_portal_motions
        (org_id, broadcast_id, meeting_id, agenda_item_id, motion_type, title, description, moved_by, seconded_by, ordinal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        broadcastId,
        meetingId,
        agendaItemId ?? null,
        motionType,
        title,
        description ?? null,
        movedBy ?? null,
        secondedBy ?? null,
        nextOrdinal,
      ]
    );

    const newMotionResult = await conn.execute(
      "SELECT * FROM gc_portal_motions WHERE broadcast_id = ? AND org_id = ? ORDER BY id DESC LIMIT 1",
      [broadcastId, orgId]
    );
    const motion = rowToMotion(newMotionResult.rows[0] as any);
    motion.votes = [];
    return jsonResponse({ motion }, 201);
  }

  return errorResponse("Method not allowed", 405);
}

export default requirePortalAuth(handler);
