import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { transcribeAndDiarize, formatTranscriptForMinutes } from '../services/assemblyai.js';
import { query, execute } from '../services/database.js';
import { activeJobs } from '../types.js';
import type { TranscriptRow } from '../types.js';

export const diarizationRoute = new Hono();

/** Converts milliseconds to a time string in the format "HH:MM:SS.mmm" used by gc_segments. */
function formatMsToTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${seconds.toFixed(3).padStart(6, '0')}`;
}

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
  processTranscription(transcriptId, transcript.userId, transcript.org_id, s3_audio_key, transcript.aws_region, language ?? transcript.language ?? undefined)
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
  orgId: string | null,
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

    // 3.5. Check user's current token balance and deduct tokens
    const balanceRows = await query<{ balance: string | null }>(
      orgId
        ? `SELECT (
            COALESCE((SELECT SUM(credit) FROM payments WHERE user_id = ? AND org_id IS NULL), 0) +
            COALESCE((SELECT SUM(credit) FROM payments WHERE org_id = ?), 0)
          ) AS balance`
        : 'SELECT COALESCE(SUM(credit), 0) AS balance FROM payments WHERE user_id = ? AND org_id IS NULL',
      orgId ? [userId, orgId] : [userId]
    );
    const currentBalance = parseInt(String(balanceRows[0]?.balance ?? '0'), 10) || 0;

    if (currentBalance < creditsRequired) {
      console.warn(`[diarization] Insufficient tokens for transcript ${transcriptId}: balance=${currentBalance}, required=${creditsRequired}`);
      await execute(
        `UPDATE transcripts SET
          credits_required = ?,
          transcribe_paused = 1,
          insufficient_tokens = 1,
          was_paywalled = 1,
          upload_complete = 1
         WHERE id = ?`,
        [creditsRequired, transcriptId]
      );
      activeJobs.delete(transcriptId);
      return;
    }

    // Deduct tokens from user balance
    try {
      await execute(
        `INSERT INTO payments (user_id, org_id, transcript_id, credit, action) VALUES (?, ?, ?, ?, 'sub')`,
        [userId, orgId, transcriptId, -creditsRequired]
      );
    } catch (err: unknown) {
      const mysqlErr = err as { code?: string; errno?: number; message?: string };
      const isActionColumnMissing =
        mysqlErr?.code === 'ER_BAD_FIELD_ERROR' ||
        mysqlErr?.errno === 1054 ||
        (typeof mysqlErr?.message === 'string' && (mysqlErr.message.includes('1054') || mysqlErr.message.includes('Unknown column')));
      if (isActionColumnMissing) {
        console.warn(`[diarization] 'action' column not found in payments table, retrying without it`);
        await execute(
          `INSERT INTO payments (user_id, org_id, transcript_id, credit) VALUES (?, ?, ?, ?)`,
          [userId, orgId, transcriptId, -creditsRequired]
        );
      } else {
        throw err;
      }
    }
    console.log(`[diarization] Deducted ${creditsRequired} tokens from user ${userId} for transcript ${transcriptId}`);

    // 4. Save transcript text and update status in DB
    await execute(
      `UPDATE transcripts SET 
        transcribe_finished = 1,
        preview_transcribe_finished = 1,
        upload_complete = 1,
        diarization_ready = 1,
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

    // 5.5. Insert individual utterances into gc_segments so the frontend Transcript component
    // can render each speaker turn with proper start/stop times and speaker labels.
    if (result.utterances.length > 0) {
      const placeholders = result.utterances.map(() => '(?, ?, ?, ?, ?, ?, 0, 1)').join(', ');
      const values: (string | number)[] = [];
      result.utterances.forEach((u, i) => {
        values.push(transcriptId, formatMsToTime(u.start), formatMsToTime(u.end), u.speaker, u.text, i);
      });
      await execute(
        `INSERT INTO gc_segments (transcript_id, start, stop, speaker, transcript, segment_index, fast_mode, is_user_visible) VALUES ${placeholders}`,
        values
      );
      console.log(`[diarization] Inserted ${result.utterances.length} segments into gc_segments for transcript ${transcriptId}`);
    }

    // 6. Update job status
    activeJobs.set(transcriptId, {
      transcript_id: transcriptId,
      status: 'generating_minutes',
      started_at: new Date(),
    });

    // 7. Auto-trigger minutes generation
    await triggerMinutesGeneration(transcriptId, userId, orgId, formattedTranscript);

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

async function triggerMinutesGeneration(transcriptId: number, userId: string, orgId: string | null, formattedTranscript: string) {
  const { generateMinutes } = await import('../services/minutesProvider.js');

  // Insert minutes record
  await execute(
    'INSERT IGNORE INTO minutes (transcript_id, user_id, org_id, ts_start) VALUES (?, ?, ?, UTC_TIMESTAMP())',
    [transcriptId, userId, orgId]
  );

  const minutes = await generateMinutes(formattedTranscript);

  // Save minutes
  await execute(
    'UPDATE minutes SET minutes = ?, ts_first_gpt = UTC_TIMESTAMP() WHERE transcript_id = ? AND user_id = ? AND org_id <=> ?',
    [minutes, transcriptId, userId, orgId]
  );

  console.log(`[minutes] Generated minutes for transcript ${transcriptId}`);
}