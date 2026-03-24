import { assertString } from "@/utils/assert";
import { connect, Connection } from "@planetscale/database";
import fs from "fs/promises";
import path from "path";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { assertRegion, getTranscriptBucketNameByRegion } from "@/utils/s3";
import { convertDocument } from "./pandoc";

interface Segment {
  speaker: string;
  transcript?: string;
}

async function getSpeakers(
  conn: ReturnType<typeof connect>,
  transcriptId: number,
  userId: string,
  fastMode: boolean
): Promise<Map<string, string>> {
  const result = await conn.execute(
    "SELECT label, name FROM speakers WHERE transcriptId = ? AND userId = ? AND fast_mode = ?",
    [transcriptId, userId, fastMode ? 1 : 0]
  );

  const rows = result.rows;
  const speakers = new Map<string, string>();
  for (const row of rows as any[]) {
    speakers.set(row.label, row.name);
  }
  return speakers;
}

async function getTranscriptSegments(
  conn: Connection,
  transcriptId: number,
  fastMode: boolean
): Promise<Segment[]> {
  const rows = await conn
    .execute(
      "SELECT speaker, transcript FROM gc_segments WHERE transcript_id = ? AND fast_mode = ? ORDER BY CAST(start AS TIME)",
      [transcriptId, fastMode ? 1 : 0]
    )
    .then((res) => res.rows);

  return rows as Segment[];
}

export async function downloadTranscript(transcriptId: number, outputDir: string): Promise<void> {
  const transcript = await getTranscript(transcriptId);
  if (transcript == null) {
    throw new Error(`Transcript with ID ${transcriptId} not found`);
  }
  const transcriptPath = path.join(outputDir, "transcript.txt");
  await fs.writeFile(transcriptPath, transcript);

  console.log(`✅ Wrote ${transcriptPath}`);
}

// Returns the transcript as a string, or null if not found
export async function getTranscript(transcriptId: number): Promise<string | null> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const transcriptRow = await conn
    .execute("SELECT upload_kind, userId, aws_region FROM transcripts WHERE id = ?;", [
      transcriptId,
    ])
    .then((res) => res.rows[0]);

  const uploadKind = assertString(transcriptRow["upload_kind"]);
  const userId = assertString(transcriptRow["userId"]);
  const region = assertRegion(transcriptRow["aws_region"]);

  const s3 = new S3Client({
    credentials: {
      accessKeyId: assertString(process.env.AWS_ACCESS_KEY_ID),
      secretAccessKey: assertString(process.env.AWS_SECRET_ACCESS_KEY),
    },
    region,
  });

  if (uploadKind === "audio") {
    const speakers = await getSpeakers(conn, transcriptId, userId, false);
    const segments = await getTranscriptSegments(conn, transcriptId, false);

    return segments
      .filter((segment) => segment.transcript !== null)
      .map((segment) => {
        let name = segment.speaker;
        if (name.startsWith("UNASSIGNED_")) {
          name = "Speaker";
        } else if (speakers.has(segment.speaker)) {
          name = speakers.get(segment.speaker) as string;
        }
        const text = segment.transcript;
        return `${name}: ${text}`;
      })
      .join("\n")
      .trim();
  } else if (uploadKind === "text") {
    const s3Key = `${process.env.TEST_MODE === "true" ? "test_" : ""}uploads/upload_${transcriptId}`;

    const command = new GetObjectCommand({
      Bucket: getTranscriptBucketNameByRegion(region),
      Key: s3Key,
    });

    const response = await s3.send(command);
    const bytes = await response.Body?.transformToByteArray();
    if (bytes == null) {
      console.error(`Failed to download ${s3Key}`);
      return null;
    }

    return Buffer.from(bytes).toString("utf-8").trim();
  } else if (uploadKind === "word") {
    const s3Key = `${process.env.TEST_MODE === "true" ? "test_" : ""}uploads/upload_${transcriptId}`;

    const command = new GetObjectCommand({
      Bucket: getTranscriptBucketNameByRegion(region),
      Key: s3Key,
    });

    const response = await s3.send(command);
    const bytes = await response.Body?.transformToByteArray();
    if (bytes == null) {
      console.error(`Failed to download ${s3Key}`);
      return null;
    }

    const htmlBlob = await convertDocument({
      input: new Blob([Buffer.from(bytes)]),
      inputType: "docx",
      outputType: "html",
    });

    const htmlTranscript = await htmlBlob.text();

    // Remove img tags
    const htmlTranscriptWithoutImgs = htmlTranscript.replace(/<img[^>]*>/g, "");

    return htmlTranscriptWithoutImgs.trim();
  } else {
    throw new Error(`Invalid upload_kind: ${uploadKind}`);
  }
}
