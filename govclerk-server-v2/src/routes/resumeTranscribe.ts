import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { query, execute } from '../services/database.js';
import { activeJobs } from '../types.js';
import type { TranscriptRow } from '../types.js';
import { processTranscription } from './diarization.js';

export const resumeTranscribeRoute = new Hono();

resumeTranscribeRoute.post('/resume-transcribe', authMiddleware, async (c) => {
  const transcriptIdParam = c.req.query('transcriptId');
  if (!transcriptIdParam) {
    return c.json({ error: 'Missing transcriptId query parameter' }, 400);
  }
  const transcriptId = parseInt(transcriptIdParam, 10);
  if (isNaN(transcriptId)) {
    return c.json({ error: 'Invalid transcriptId' }, 400);
  }

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

  // Construct the S3 key for the uploaded audio
  const s3Key = `uploads/upload_${transcriptId}`;

  // Mark as in-progress
  activeJobs.set(transcriptId, {
    transcript_id: transcriptId,
    status: 'transcribing',
    started_at: new Date(),
  });

  // Process asynchronously — return 200 immediately so the frontend isn't blocked.
  // 65 minutes is slightly longer than AssemblyAI's internal 60-minute timeout,
  // acting as a hard safety net to prevent hung jobs.
  const PROCESS_TIMEOUT_MS = 65 * 60 * 1000;
  const timeoutHandle = setTimeout(() => {
    if (activeJobs.has(transcriptId)) {
      console.error(`[resume-transcribe] Hard timeout reached for transcript ${transcriptId}`);
      activeJobs.delete(transcriptId);
      execute(
        'UPDATE transcripts SET transcribe_failed = 1 WHERE id = ?',
        [transcriptId]
      ).catch(console.error);
    }
  }, PROCESS_TIMEOUT_MS);

  processTranscription(
    transcriptId,
    transcript.userId,
    transcript.org_id,
    s3Key,
    transcript.aws_region,
    transcript.language ?? undefined,
  )
    .then(() => clearTimeout(timeoutHandle))
    .catch(err => {
      clearTimeout(timeoutHandle);
      console.error(`[resume-transcribe] Failed for transcript ${transcriptId}:`, err);
      activeJobs.delete(transcriptId);
      execute(
        'UPDATE transcripts SET transcribe_failed = 1 WHERE id = ?',
        [transcriptId]
      ).catch(console.error);
    });

  return c.json({}, 200);
});
