import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { transcribeAndDiarize, formatTranscriptForMinutes } from '../services/assemblyai.js';
import { query, execute } from '../services/database.js';
import { activeJobs } from '../types.js';
import type { TranscriptRow } from '../types.js';

export const diarizationRoute = new Hono();

const bodySchema = z.object({
  s3_audio_key: z.string(),
  language: z.string().optional(),
});

diarizationRoute.post('/get-diarization', authMiddleware, zValidator('json', bodySchema), async (c) => {
  const { s3_audio_key, language } = c.req.valid('json');

  // Derive transcript ID from upload key (format: "uploads/upload_12345")
  const match = s3_audio_key.match(/upload_(\d+)/);
  if (!match) {
    return c.json({ error: 'Invalid s3_audio_key format' }, 400);
  }
  const transcriptId = parseInt(match[1], 10);

  // Look up transcript in DB
  const rows = await query<TranscriptRow>(
    'SELECT id, userId, org_id, upload_kind, aws_region, language FROM transcripts WHERE id = ?',
    [transcriptId]
  );

  if (rows.length === 0) {
    return c.json({ error: 'Transcript not found' }, 404);
  }

  const transcript = rows[0];

  // Prevent double-processing
  if (activeJobs.has(transcriptId)) {
    return c.json({ error: 'Already processing' }, 409);
  }

  // Mark as in-progress
  activeJobs.set(transcriptId, {
    transcript_id: transcriptId,
    status: 'transcribing',
    started_at: new Date(),
  });

  // Process asynchronously — return 202 immediately so the frontend isn't blocked
  processTranscription(transcriptId, transcript.userId, s3_audio_key, transcript.aws_region, language ?? transcript.language ?? undefined)
    .catch(err => {
      console.error(`[diarization] Failed for transcript ${transcriptId}:`, err);
      activeJobs.delete(transcriptId);
      execute(
        'UPDATE transcripts SET transcribe_failed = 1 WHERE id = ?',
        [transcriptId]
      ).catch(console.error);
    });

  return c.json({ status: 'processing', transcript_id: transcriptId }, 202);
});

async function processTranscription(
  transcriptId: number,
  userId: string,
  s3Key: string,
  region: string,
  language?: string,
) {
  console.log(`[diarization] Starting transcription for transcript ${transcriptId}`);

  try {
    // 1. Transcribe + diarize via AssemblyAI
    const result = await transcribeAndDiarize(s3Key, region, language);
    console.log(`[diarization] AssemblyAI complete for ${transcriptId}. Duration: ${result.audio_duration}s, Speakers: ${result.speakers.length}`);

    // 2. Format transcript with speaker labels
    const formattedTranscript = formatTranscriptForMinutes(result);

    // 3. Calculate credits required (based on audio duration — 1 credit per minute)
    const creditsRequired = Math.ceil(result.audio_duration / 60);

    // 4. Save transcript text and update status in DB
    await execute(
      `UPDATE transcripts SET 
        transcribe_finished = 1,
        preview_transcribe_finished = 1,
        upload_complete = 1,
        credits_required = ?,
        snippet = ?
       WHERE id = ?`,
      [creditsRequired, result.utterances[0]?.text?.slice(0, 100) ?? '', transcriptId]
    );

    // 5. Save the diarized utterances as the transcript content
    await execute(
      `UPDATE transcripts SET transcript_text = ? WHERE id = ?`,
      [formattedTranscript, transcriptId]
    ).catch((err: unknown) => {
      const mysqlErr = err as { code?: string };
      if (mysqlErr?.code === 'ER_BAD_FIELD_ERROR') {
        console.warn(`[diarization] Could not save transcript_text for ${transcriptId} — column may not exist`);
      } else {
        console.error(`[diarization] Failed to save transcript_text for ${transcriptId}:`, err);
      }
    });

    // 6. Update job status
    activeJobs.set(transcriptId, {
      transcript_id: transcriptId,
      status: 'generating_minutes',
      started_at: new Date(),
    });

    // 7. Auto-trigger minutes generation
    await triggerMinutesGeneration(transcriptId, userId, formattedTranscript);

    // 8. Clean up job tracker
    activeJobs.set(transcriptId, {
      transcript_id: transcriptId,
      status: 'complete',
      started_at: new Date(),
    });
    setTimeout(() => activeJobs.delete(transcriptId), 60_000); // clean up after 1 min

    console.log(`[diarization] Complete for transcript ${transcriptId}`);
  } catch (err) {
    activeJobs.delete(transcriptId);
    throw err;
  }
}

async function triggerMinutesGeneration(transcriptId: number, userId: string, formattedTranscript: string) {
  const { generateMinutes } = await import('../services/openai.js');

  // Insert minutes record
  await execute(
    'INSERT IGNORE INTO minutes (transcript_id, user_id, ts_start) VALUES (?, ?, UTC_TIMESTAMP())',
    [transcriptId, userId]
  );

  const minutes = await generateMinutes(formattedTranscript);

  // Save minutes
  await execute(
    'UPDATE minutes SET minutes = ?, ts_first_gpt = UTC_TIMESTAMP() WHERE transcript_id = ? AND user_id = ?',
    [minutes, transcriptId, userId]
  );

  console.log(`[minutes] Generated minutes for transcript ${transcriptId}`);
}