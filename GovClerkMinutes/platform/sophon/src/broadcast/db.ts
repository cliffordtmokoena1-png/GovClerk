import { getDb } from "../db.ts";

export async function endBroadcastByStreamKey(streamKey: string): Promise<void> {
  const conn = getDb();

  const result = await conn.execute(
    `UPDATE gc_broadcasts 
     SET status = 'ended', ended_at = NOW() 
     WHERE stream_key = ? AND status IN ('setup', 'live', 'paused')`,
    [streamKey]
  );

  if (result.rowsAffected && result.rowsAffected > 0) {
    console.info(`[broadcast] Ended broadcast with stream key ${streamKey} due to inactivity`);
  }
}

export async function endStaleBroadcasts(staleThresholdMinutes: number = 5): Promise<number> {
  const conn = getDb();

  const result = await conn.execute(
    `UPDATE gc_broadcasts 
     SET status = 'ended', ended_at = NOW() 
     WHERE status IN ('setup', 'live', 'paused') 
     AND updated_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [staleThresholdMinutes]
  );

  const count = result.rowsAffected ?? 0;
  if (count > 0) {
    console.info(
      `[broadcast] Ended ${count} stale broadcast(s) that were inactive for ${staleThresholdMinutes}+ minutes`
    );
  }

  return count;
}

export async function getStreamKeyByBroadcastId(broadcastId: number): Promise<string | null> {
  const conn = getDb();

  const result = await conn.execute(`SELECT stream_key FROM gc_broadcasts WHERE id = ?`, [
    broadcastId,
  ]);

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  return result.rows[0].stream_key as string;
}

export async function getBroadcastByStreamKey(streamKey: string): Promise<{
  id: number;
  meetingId: number;
  orgId: string;
  portalSettingsId: number;
} | null> {
  const conn = getDb();
  const result = await conn.execute(
    `SELECT b.id, b.meeting_id, b.org_id, m.portal_settings_id
     FROM gc_broadcasts b
     JOIN gc_meetings m ON m.id = b.meeting_id
     WHERE b.stream_key = ? AND b.status IN ('setup', 'live', 'paused')
     LIMIT 1`,
    [streamKey]
  );

  const row = result.rows[0] as any;
  if (!row) return null;

  return {
    id: row.id,
    meetingId: row.meeting_id,
    orgId: row.org_id,
    portalSettingsId: row.portal_settings_id,
  };
}
