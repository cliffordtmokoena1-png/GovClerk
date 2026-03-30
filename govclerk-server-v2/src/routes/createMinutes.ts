import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { generateMinutes } from '../services/openai.js';
import { query, execute } from '../services/database.js';
import type { TranscriptRow } from '../types.js';

export const createMinutesRoute = new Hono();

const bodySchema = z.object({
  transcript_id: z.number(),
  upload_kind: z.string().optional(),
  test_mode: z.boolean().optional(),
});

createMinutesRoute.post('/create-minutes', authMiddleware, zValidator('json', bodySchema), async (c) => {
  const { transcript_id } = c.req.valid('json');
  const authHeader = c.req.header('Authorization')!;
  const userId = authHeader.slice(7); // In old system, token = user_id for this endpoint

  const transcripts = await query<TranscriptRow>(
    'SELECT * FROM transcripts WHERE id = ?',
    [transcript_id]
  );

  if (transcripts.length === 0) {
    return c.json({ error: 'Transcript not found' }, 404);
  }

  // Get the formatted transcript text
  const transcriptRows = await query<{ transcript_text: string | null }>(
    'SELECT transcript_text FROM transcripts WHERE id = ?',
    [transcript_id]
  );

  const transcriptText = transcriptRows[0]?.transcript_text;
  if (!transcriptText) {
    return c.json({ error: 'No transcript text available. Audio may not have been processed yet.' }, 400);
  }

  // Ensure minutes record exists
  await execute(
    'INSERT IGNORE INTO minutes (transcript_id, user_id, ts_start) VALUES (?, ?, UTC_TIMESTAMP())',
    [transcript_id, userId]
  );

  // Generate asynchronously
  generateMinutes(transcriptText)
    .then(minutes => execute(
      'UPDATE minutes SET minutes = ?, ts_first_gpt = UTC_TIMESTAMP() WHERE transcript_id = ? AND user_id = ?',
      [minutes, transcript_id, userId]
    ))
    .catch(err => {
      console.error(`[create-minutes] Failed for ${transcript_id}:`, err);
      execute(
        'UPDATE minutes SET minutes_failed = 1 WHERE transcript_id = ? AND user_id = ?',
        [transcript_id, userId]
      ).catch(console.error);
    });

  return c.json({ status: 'generating', transcript_id }, 202);
});
