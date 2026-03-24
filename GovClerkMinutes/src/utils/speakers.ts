import { connect, type Connection } from "@planetscale/database";

export type SpeakerMap = Map<string, string>;

export function formatSpeakerLabel(speakerId: string | null): string | null {
  if (!speakerId) {
    return null;
  }

  const speakerMatch = speakerId.match(/^speaker_(\d+)$/i);
  if (speakerMatch) {
    return `Speaker ${parseInt(speakerMatch[1], 10) + 1}`;
  }

  const speakerNum = parseInt(speakerId, 10);
  if (!isNaN(speakerNum) && speakerId === String(speakerNum)) {
    return `Speaker ${speakerNum + 1}`;
  }

  return speakerId;
}

export async function getSpeakerMap(
  transcriptId: number,
  existingConn?: Connection
): Promise<SpeakerMap> {
  const conn =
    existingConn ??
    connect({
      host: process.env.PLANETSCALE_DB_HOST,
      username: process.env.PLANETSCALE_DB_USERNAME,
      password: process.env.PLANETSCALE_DB_PASSWORD,
    });

  const speakersResult = await conn.execute(
    "SELECT label, name FROM speakers WHERE transcriptId = ? AND fast_mode = 0",
    [transcriptId]
  );

  const speakerMap: SpeakerMap = new Map();
  for (const row of speakersResult.rows as any[]) {
    speakerMap.set(row.label, row.name);
  }

  return speakerMap;
}

export function substituteSpeakerLabels(
  content: string | null,
  speakerMap: SpeakerMap
): string | null {
  if (!content || speakerMap.size === 0) {
    return content;
  }

  let result = content;
  for (const [label, name] of speakerMap.entries()) {
    const placeholder = `{{${label}}}`;
    if (name) {
      result = result.split(placeholder).join(name);
    }
  }

  return result;
}
