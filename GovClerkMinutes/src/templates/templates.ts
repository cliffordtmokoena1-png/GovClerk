import { transcripts } from "@/templates/example-minutes/transcripts";
import { minutes } from "@/templates/example-minutes/minutes";
import { speakers } from "@/templates/example-minutes/speakers";
import { gc_segments } from "@/templates/example-minutes/mg_segments";
import { changes } from "@/templates/example-minutes/changes";
import { TemplateData, Minute, Speaker, Segment, Change } from "@/templates/types";
import { connect } from "@planetscale/database";

export async function loadTemplateData(): Promise<TemplateData> {
  return {
    transcripts,
    minutes,
    speakers,
    gc_segments,
    changes,
  };
}

export async function insertTemplateTranscript(userId: string): Promise<number | null> {
  try {
    const connection = connect({
      host: process.env.PLANETSCALE_DB_HOST,
      username: process.env.PLANETSCALE_DB_USERNAME,
      password: process.env.PLANETSCALE_DB_PASSWORD,
    });

    const data = await loadTemplateData();

    if (!data.transcripts || data.transcripts.length === 0) {
      console.error("No transcript template data found");
      return null;
    }

    const templateTranscript = data.transcripts[0];

    // Set specific date (January 23, 2023 11:20AM PST)
    const specificDate = "2023-01-31 11:20:00";

    // Keep original s3AudioKey format
    const s3AudioKey = templateTranscript.s3AudioKey;

    // Note: Override this if we want to use a different title
    const title = "Example Minutes";

    const transcriptResult = await connection.execute(
      `
      INSERT INTO transcripts (
        userId, dateCreated, title, file_size, aws_region, upload_kind, s3AudioKey,
        transcribe_finished, transcribe_paused, transcribe_failed, credits_required,
        client_corruption, deleted, preview_transcribe_finished, snippet,
        diarization_ready, upload_complete, transcript_requested, insufficient_tokens
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, 
        ?, ?, ?, ?,
        1, 1, 1, 0
      )`,
      [
        userId,
        specificDate,
        title,
        templateTranscript.file_size,
        templateTranscript.aws_region,
        templateTranscript.upload_kind,
        s3AudioKey,
        templateTranscript.transcribe_finished,
        templateTranscript.transcribe_paused,
        templateTranscript.transcribe_failed,
        templateTranscript.credits_required,
        templateTranscript.client_corruption,
        templateTranscript.deleted,
        templateTranscript.preview_transcribe_finished,
        templateTranscript.snippet,
      ]
    );

    // Normal Node.js mysql client returns an array with results at index 0
    // This is different from the Edge runtime client which has results directly
    const newTranscriptId = Array.isArray(transcriptResult)
      ? transcriptResult[0].insertId
      : transcriptResult.insertId;

    await Promise.all([
      insertTemplateMinutes(data, newTranscriptId, userId, connection),
      insertTemplateSpeakers(data, newTranscriptId, userId, connection),
      insertTemplateSegments(data, newTranscriptId, connection),
      insertTemplateChanges(data, newTranscriptId, userId, connection),
    ]);
    return newTranscriptId;
  } catch (error) {
    console.error("Error inserting template transcript:", error);
    return null;
  }
}

export async function insertTemplateMinutes(
  data: TemplateData,
  newTranscriptId: number,
  userId: string,
  connection: any
): Promise<void> {
  const minutesToInsert = [...(data.minutes || [])];

  for (const minute of minutesToInsert) {
    await connection.execute(
      `
      INSERT INTO minutes (
        transcript_id, user_id, minutes, rating, ms_word_clicks, 
        copy_clicks, ts_start, version, fast_mode, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, UTC_TIMESTAMP(), ?, ?, UTC_TIMESTAMP()
      )`,
      [
        newTranscriptId,
        userId,
        minute.minutes,
        minute.rating,
        minute.ms_word_clicks,
        minute.copy_clicks,
        minute.version,
        minute.fast_mode,
      ]
    );
  }
}

export async function insertTemplateSpeakers(
  data: TemplateData,
  newTranscriptId: number,
  userId: string,
  connection: any
): Promise<void> {
  if (!data.speakers || data.speakers.length === 0) {
    return;
  }

  for (const speaker of data.speakers) {
    // Convert embedding array to JSON string or null if it doesn't exist
    const embeddingJSON = speaker.embedding ? JSON.stringify(speaker.embedding) : null;
    // Convert suggested_speakers object to JSON string or null
    const suggestedSpeakersJSON = speaker.suggested_speakers
      ? JSON.stringify(speaker.suggested_speakers)
      : null;

    await connection.execute(
      `
      INSERT INTO speakers (
        label, name, uses, transcriptId, userId,
        embedding, fast_mode, suggested_speakers, tags
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )`,
      [
        speaker.label,
        speaker.name,
        speaker.uses,
        newTranscriptId,
        userId,
        embeddingJSON,
        speaker.fast_mode,
        suggestedSpeakersJSON,
        JSON.stringify(["example"]),
      ]
    );
  }
}

export async function insertTemplateSegments(
  data: TemplateData,
  newTranscriptId: number,
  connection: any
): Promise<void> {
  if (!data.gc_segments || data.gc_segments.length === 0) {
    return;
  }

  // Check if we have both fast_mode types
  const hasFastMode0 = data.gc_segments.some((s) => s.fast_mode === 0);
  const hasFastMode1 = data.gc_segments.some((s) => s.fast_mode === 1);

  // Create a copy of segments to modify
  let segmentsToInsert = [...data.gc_segments];

  // If missing fast_mode 0, duplicate some segments with fast_mode 0
  if (!hasFastMode0 && hasFastMode1) {
    const fast1Segments = data.gc_segments.filter((s) => s.fast_mode === 1);
    const fast0Segments = fast1Segments.map((s) => ({ ...s, fast_mode: 0 }));
    segmentsToInsert = [...segmentsToInsert, ...fast0Segments];
  }
  // If missing fast_mode 1, duplicate some segments with fast_mode 1
  else if (hasFastMode0 && !hasFastMode1) {
    const fast0Segments = data.gc_segments.filter((s) => s.fast_mode === 0);
    const fast1Segments = fast0Segments.map((s) => ({ ...s, fast_mode: 1 }));
    segmentsToInsert = [...segmentsToInsert, ...fast1Segments];
  }

  // Process segments - we'll do them in batches of 50
  const BATCH_SIZE = 50;
  const batches = [];
  for (let i = 0; i < segmentsToInsert.length; i += BATCH_SIZE) {
    batches.push(segmentsToInsert.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    const promises = batch.map((segment) =>
      connection.execute(
        `
        INSERT INTO gc_segments (
          transcript_id, start, stop, speaker, transcript,
          segment_index, fast_mode, is_user_visible
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?
        )`,
        [
          newTranscriptId,
          segment.start,
          segment.stop,
          segment.speaker,
          segment.transcript,
          segment.segment_index,
          segment.fast_mode,
          segment.is_user_visible,
        ]
      )
    );

    await Promise.all(promises);
  }
}

export async function insertTemplateChanges(
  data: TemplateData,
  newTranscriptId: number,
  userId: string,
  connection: any
): Promise<void> {
  if (!data.changes || data.changes.length === 0) {
    return;
  }

  for (const change of data.changes) {
    await connection.execute(
      `
      INSERT INTO changes (
        transcript_id, revision_id, user_id, created_at, 
        change_type, diff_content, base_version, new_version, fast_mode
      ) VALUES (
        ?, ?, ?, UTC_TIMESTAMP(),
        ?, ?, ?, ?, ?
      )`,
      [
        newTranscriptId,
        change.revision_id,
        userId,
        change.change_type,
        change.diff_content,
        change.base_version,
        change.new_version,
        change.fast_mode,
      ]
    );
  }
}