import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { transcribeAndDiarize, formatTranscriptForMinutes } from '../services/assemblyai.js';
import { generateMinutes } from '../services/openai.js';
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

  const match = s3_audio_key.match(/upload_(\d+)/);
  if (!match) return c.json({ error: 'Invalid s3_audio_key format' }, 400);

  const transcriptId = parseInt(match[1], 10);

  const rows = await query<TranscriptRow>(
    'SELECT id, userId, org_id, upload_kind, aws_region, language FROM transcripts WHERE id = ?',
    [transcriptId]
  );

  if (rows.length === 0) return c.json({ error: 'Transcript not found' }, 404);
  if (activeJobs.has(transcriptId)) return c.json({ error: 'Already processing' }, 409);

  const transcript = rows[0];

  activeJobs.set(transcriptId, { transcript_id: transcriptId, status: 'transcribing', started_at: new Date() });

  // Fire and forget — process in background
  (async () => {
    try {
      console.log(`[diarization] Starting for transcript ${transcriptId}`);
      const result = await transcribeAndDiarize(s3_audio_key, transcript.aws_region, language ?? transcript.language ?? undefined);
      const formattedTranscript = formatTranscriptForMinutes(result);
      const creditsRequired = Math.ceil(result.audio_duration / 60);

      await execute(
        `UPDATE transcripts SET transcribe_finished = 1, preview_transcribe_finished = 1, upload_complete = 1, credits_required = ?, snippet = ? WHERE id = ?`,
        [creditsRequired, result.utterances[0]?.text?.slice(0, 100) ?? '', transcriptId]
      );

      // Try saving transcript_text — column may not exist yet, that's OK
      await execute('UPDATE transcripts SET transcript_text = ? WHERE id = ?', [formattedTranscript, transcriptId]).catch((err) => {
        console.warn(`[diarization] transcript_text column not yet added to schema (transcript ${transcriptId}):`, err instanceof Error ? err.message : err);
      });

      activeJobs.set(transcriptId, { transcript_id: transcriptId, status: 'generating_minutes', started_at: new Date() });
      console.log(`[diarization] AssemblyAI done for ${transcriptId}, generating minutes...`);

      await execute('INSERT IGNORE INTO minutes (transcript_id, user_id, ts_start) VALUES (?, ?, UTC_TIMESTAMP())', [transcriptId, transcript.userId]);
      const minutes = await generateMinutes(formattedTranscript);
      await execute('UPDATE minutes SET minutes = ?, ts_first_gpt = UTC_TIMESTAMP() WHERE transcript_id = ? AND user_id = ?', [minutes, transcriptId, transcript.userId]);

      activeJobs.set(transcriptId, { transcript_id: transcriptId, status: 'complete', started_at: new Date() });
      setTimeout(() => activeJobs.delete(transcriptId), 60_000);
      console.log(`[diarization] Complete for transcript ${transcriptId}`);
    } catch (err) {
      console.error(`[diarization] Error for transcript ${transcriptId}:`, err);
      activeJobs.delete(transcriptId);
      await execute('UPDATE transcripts SET transcribe_failed = 1 WHERE id = ?', [transcriptId]).catch(() => {});
    }
  })();

  return c.json({ status: 'processing', transcript_id: transcriptId }, 202);
});
