import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import { requirePortalAuth } from "@/portal-auth/requirePortalAuth";
import type { PortalSessionPayload } from "@/portal-auth/portalAuth";
import type { AttendanceRecord, RecordAttendanceRequest } from "@/types/liveSession";

export const config = {
  runtime: "edge",
};

function rowToAttendance(row: any): AttendanceRecord {
  return {
    id: Number(row.id),
    orgId: row.org_id,
    meetingId: Number(row.meeting_id),
    broadcastId: Number(row.broadcast_id),
    memberName: row.member_name,
    memberId: row.member_id ?? null,
    status: row.status,
    arrivedAt: row.arrived_at ?? null,
    departedAt: row.departed_at ?? null,
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
      "SELECT * FROM gc_portal_attendance WHERE broadcast_id = ? AND org_id = ? ORDER BY member_name",
      [broadcastId, orgId]
    );
    const attendance = result.rows.map(rowToAttendance);
    return jsonResponse({ attendance });
  }

  if (req.method === "POST") {
    const body = (await req.json()) as RecordAttendanceRequest;
    const { memberName, status } = body;

    if (!memberName || !status) {
      return errorResponse("memberName and status are required", 400);
    }

    const validStatuses = ["present", "absent", "late", "excused"];
    if (!validStatuses.includes(status)) {
      return errorResponse("Invalid status value", 400);
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

    await conn.execute(
      `INSERT INTO gc_portal_attendance (org_id, meeting_id, broadcast_id, member_name, status, arrived_at)
       VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'present' OR ? = 'late' THEN CURRENT_TIMESTAMP ELSE NULL END)
       ON DUPLICATE KEY UPDATE status = VALUES(status), arrived_at = CASE WHEN VALUES(status) = 'present' OR VALUES(status) = 'late' THEN COALESCE(arrived_at, CURRENT_TIMESTAMP) ELSE arrived_at END, updated_at = CURRENT_TIMESTAMP`,
      [orgId, meetingId, broadcastId, memberName, status, status, status]
    );

    const result = await conn.execute(
      "SELECT * FROM gc_portal_attendance WHERE broadcast_id = ? AND member_name = ? AND org_id = ?",
      [broadcastId, memberName, orgId]
    );
    const record = rowToAttendance(result.rows[0] as any);
    return jsonResponse({ attendance: record });
  }

  return errorResponse("Method not allowed", 405);
}

export default requirePortalAuth(handler);
