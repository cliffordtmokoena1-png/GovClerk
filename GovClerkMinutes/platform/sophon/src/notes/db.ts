import { getDb } from "../db.ts";

// Fetch broadcast data for export - NO status filter (works on ended broadcasts)
export async function getBroadcastForExport(broadcastId: number): Promise<{
  id: number;
  notes: string | null;
  meetingId: number;
  orgId: string;
  startedAt: Date | null;
  endedAt: Date | null;
} | null> {
  const conn = getDb();
  const result = await conn.execute(
    `SELECT id, notes, meeting_id, org_id, started_at, ended_at 
     FROM gc_broadcasts 
     WHERE id = ?`,
    [broadcastId]
  );

  const row = result.rows[0] as any;
  if (!row) return null;

  return {
    id: row.id,
    notes: row.notes,
    meetingId: row.meeting_id,
    orgId: row.org_id,
    startedAt: row.started_at ? new Date(row.started_at) : null,
    endedAt: row.ended_at ? new Date(row.ended_at) : null,
  };
}

// Fetch meeting data for document metadata
export async function getMeetingForExport(meetingId: number): Promise<{
  title: string;
  portalSettingsId: number;
  meetingDate: Date | null;
} | null> {
  const conn = getDb();
  const result = await conn.execute(
    `SELECT title, portal_settings_id, meeting_date 
     FROM gc_meetings 
     WHERE id = ?`,
    [meetingId]
  );

  const row = result.rows[0] as any;
  if (!row) return null;

  return {
    title: row.title || "Untitled Meeting",
    portalSettingsId: row.portal_settings_id,
    meetingDate: row.meeting_date ? new Date(row.meeting_date) : null,
  };
}
