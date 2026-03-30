import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { generateMinutes } from '../services/openai.js';
import { query, execute } from '../services/database.js';

export const createMinutesRoute = new Hono();

const bodySchema = z.object({
  transcript_id: z.number(),
  upload_kind: z.string().optional(),
  test_mode: z.boolean().optional(),
});

createMinutesRoute.post('/create-minutes', authMiddleware, zValidator('json', bodySchema), async (c) => {
  const { transcript_id } = c.req.valid('json');
  const authHeader = c.req.header('Authorization')!;
  const userId = authHeader.slice(7);

  const transcriptRows = await query<{ transcript_text: string | null; userId: string }>(
    'SELECT transcript_text, userId FROM transcripts WHERE id = ?',
    [transcript_id]
  );

  if (transcriptRows.length === 0) return c.json({ error: 'Transcript not found' }, 404);

  const transcriptText = transcriptRows[0]?.transcript_text;
  const actualUserId = transcriptRows[0]?.userId ?? userId;

  if (!transcriptText) return c.json({ error: 'No transcript text available. Audio may not have been processed yet.' }, 400);

  await execute('INSERT IGNORE INTO minutes (transcript_id, user_id, ts_start) VALUES (?, ?, UTC_TIMESTAMP())', [transcript_id, actualUserId]);

  generateMinutes(transcriptText)
    .then(minutes => execute('UPDATE minutes SET minutes = ?, ts_first_gpt = UTC_TIMESTAMP() WHERE transcript_id = ? AND user_id = ?', [minutes, transcript_id, actualUserId]))
    .catch(err => console.error(`[create-minutes] Error for ${transcript_id}:`, err));

  return c.json({ status: 'generating', transcript_id }, 202);
});
