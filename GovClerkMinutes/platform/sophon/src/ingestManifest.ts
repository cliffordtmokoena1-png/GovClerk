import type { ArtifactSource, Manifest, Meeting } from "./types.ts";
import { putObject } from "./s3.ts";
import { fileTypeFromBuffer } from "file-type";
import { getDb } from "./db.ts";

// Normalize and dedupe meetings and artifacts
function meetingKey(m: Meeting<ArtifactSource>): string {
  const dateIso = new Date(m.date).toISOString();
  return `${m.title.trim().toLowerCase()}|${dateIso}|${m.kind.trim().toLowerCase()}`;
}

export async function ingestManifest(manifest: Manifest, orgId: number): Promise<void> {
  const conn = getDb();

  // Deduplicate meetings and artifacts
  const uniqueMeetings = new Map<string, Meeting<ArtifactSource>>();
  const artifactList: Array<{
    meetingKey: string;
    kind: ArtifactSource["kind"];
    name: string;
    originalUrl: string;
    mime: string | null;
  }> = [];

  for (const m of manifest.meetings) {
    const key = meetingKey(m);
    if (!uniqueMeetings.has(key)) {
      uniqueMeetings.set(key, m);
    }
    const seenUrls = new Set<string>();
    for (const artifact of m.artifacts) {
      if (!artifact?.url || seenUrls.has(artifact.url)) {
        continue;
      }
      seenUrls.add(artifact.url);
      artifactList.push({
        meetingKey: key,
        kind: artifact.kind,
        name: artifact.name,
        originalUrl: artifact.url,
        mime: null,
      });
    }
  }

  // Insert or fetch meeting IDs
  const meetingIdByKey = new Map<string, number>();
  for (const [key, m] of uniqueMeetings) {
    // Try to find existing meeting first
    const res = await conn.execute(
      "SELECT id FROM gc_meetings WHERE org_id = ? AND title = ? AND kind = ? AND date = ? LIMIT 1",
      [orgId, m.title, m.kind, new Date(m.date).toISOString()]
    );
    const rows = res.rows as any[];
    if (rows.length > 0) {
      meetingIdByKey.set(key, Number(rows[0].id));
      continue;
    }
    const ins = await conn.execute(
      "INSERT INTO gc_meetings (org_id, title, kind, date, location) VALUES (?, ?, ?, ?, ?)",
      [orgId, m.title, m.kind, new Date(m.date).toISOString(), m.location || null]
    );
    meetingIdByKey.set(key, Number((ins as any).insertId));
  }

  // Insert artifact placeholders (no s3_key yet)
  const artifactRows: Array<{
    id: number;
    meetingKey: string;
    kind: ArtifactSource["kind"];
    name: string;
    originalUrl: string;
    mime: string | null;
  }> = [];

  for (const art of artifactList) {
    const meetingId = meetingIdByKey.get(art.meetingKey);
    if (!meetingId) {
      continue;
    }

    // Check if artifact exists (by meeting_id + kind + name)
    const existingRes = await conn.execute(
      "SELECT id FROM gc_artifacts WHERE org_id = ? AND meeting_id = ? AND kind = ? AND name = ? LIMIT 1",
      [orgId, meetingId, art.kind, art.name]
    );
    const existing = existingRes.rows as any[];
    if (existing.length > 0) {
      artifactRows.push({ ...art, id: Number((existing[0] as any).id) });
      continue;
    }

    const ins2 = await conn.execute(
      "INSERT INTO gc_artifacts (org_id, meeting_id, kind, name, bucket, mime, s3_key) VALUES (?, ?, ?, ?, NULL, ?, NULL)",
      [orgId, meetingId, art.kind, art.name, art.mime]
    );
    artifactRows.push({ ...art, id: Number((ins2 as any).insertId) });
  }

  // Upload to S3 using artifact ID and then update the DB row
  for (const row of artifactRows) {
    try {
      const resp = await fetch(row.originalUrl);
      if (!resp.ok) {
        console.warn(`[ingest] Failed to fetch artifact ${row.originalUrl}: ${resp.status}`);
        continue;
      }
      const arrayBuf = await resp.arrayBuffer();
      const body = Buffer.from(arrayBuf);
      const detected = await fileTypeFromBuffer(body);
      const mime = detected?.mime || row.mime || undefined;
      const s3Key = `org/${orgId}/artifacts/${row.id}`;

      await putObject({ key: s3Key, body, contentType: mime });

      await conn.execute("UPDATE gc_artifacts SET s3_key = ?, mime = ? WHERE id = ?", [
        s3Key,
        mime || null,
        row.id,
      ]);
      console.info(`[ingest] Uploaded artifact id=${row.id} to s3 with key ${s3Key}`);
    } catch (err) {
      console.error(`[ingest] Error uploading artifact id=${row.id}:`, err);
    }
  }
}
