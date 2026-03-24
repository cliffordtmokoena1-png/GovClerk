import { getDb } from "../db.ts";

interface SaveSegmentParams {
  streamKey: string;
  segmentId: string;
  speaker: string | null;
  text: string;
  startTime: number | null;
  endTime: number | null;
  words?: Array<{ text: string; start?: number; end?: number }>;
}

const segmentIndexMap = new Map<string, number>();
const saveLocks = new Map<string, Promise<void>>();

export function resetSegmentIndex(streamKey: string): void {
  segmentIndexMap.delete(streamKey);
  saveLocks.delete(streamKey);
}

export async function saveTranscriptSegment(params: SaveSegmentParams): Promise<void> {
  const { streamKey } = params;

  if (!params.text.trim()) {
    return;
  }

  const existingLock = saveLocks.get(streamKey);

  const operation = (existingLock ?? Promise.resolve()).then(() => doSaveTranscriptSegment(params));

  saveLocks.set(
    streamKey,
    operation.catch(() => {})
  );

  return operation;
}

async function doSaveTranscriptSegment(params: SaveSegmentParams): Promise<void> {
  const { streamKey, segmentId, speaker, text, startTime, endTime } = params;

  const conn = getDb();

  const broadcastResult = await conn.execute(
    "SELECT id FROM gc_broadcasts WHERE stream_key = ? LIMIT 1",
    [streamKey]
  );

  if (broadcastResult.rows.length === 0) {
    console.warn(`[saveTranscriptSegment] No broadcast found for stream_key: ${streamKey}`);
    return;
  }

  const broadcastId = Number((broadcastResult.rows[0] as { id: number }).id);

  const current = segmentIndexMap.get(streamKey) ?? 0;
  const segmentIndex = current + 1;
  segmentIndexMap.set(streamKey, segmentIndex);

  await conn.execute(
    `INSERT INTO gc_broadcast_transcript_segments 
    (broadcast_id, segment_index, speaker_id, speaker_label, text, start_time, end_time, is_final, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [broadcastId, segmentIndex, null, speaker, text, startTime ?? 0, endTime, 1]
  );

  console.info(
    `[saveTranscriptSegment] Inserted segment ${segmentIndex} (${segmentId}) for broadcast ${broadcastId} startTime=${startTime}`
  );
}
