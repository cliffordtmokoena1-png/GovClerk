import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { regenerateMinutes } from '../services/openai.js';
import { query, execute } from '../services/database.js';

export const regenerateMinutesRoute = new Hono();

const bodySchema = z.object({ feedback: z.string() });

regenerateMinutesRoute.post('/regenerate-minutes/:transcript_id', authMiddleware, zValidator('json', bodySchema), async (c) => {
  const transcriptId = parseInt(c.req.param('transcript_id'), 10);
  const { feedback } = c.req.valid('json');
  const authHeader = c.req.header('Authorization')!;
  const userId = authHeader.slice(7);

  const minutesRows = await query<{ minutes: string; version: number }>(
    'SELECT minutes, version FROM minutes WHERE transcript_id = ? AND user_id = ? ORDER BY version DESC LIMIT 1',
    [transcriptId, userId]
  );

  if (minutesRows.length === 0) {
    return c.json({ error: 'No minutes found for this transcript' }, 404);
  }

  const transcriptRows = await query<{ transcript_text: string | null; org_id: string | null }>(
    'SELECT transcript_text, org_id FROM transcripts WHERE id = ?',
    [transcriptId]
  );

  const transcriptText = transcriptRows[0]?.transcript_text ?? '';
  const orgId = transcriptRows[0]?.org_id ?? null;
  const previousMinutes = minutesRows[0].minutes;
  const nextVersion = minutesRows[0].version + 1;

  // Save feedback
  await execute(
    'UPDATE minutes SET feedback = ? WHERE transcript_id = ? AND user_id = ?',
    [feedback, transcriptId, userId]
  );

  // Regenerate asynchronously
  regenerateMinutes(transcriptText, previousMinutes, feedback)
    .then(newMinutes => execute(
      'INSERT INTO minutes (transcript_id, user_id, org_id, minutes, version, ts_start, feedback) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?)',
      [transcriptId, userId, orgId, newMinutes, nextVersion, feedback]
    ))
    .catch(err => {
      console.error(`[regenerate-minutes] Failed for ${transcriptId}:`, err);
      execute(
        'UPDATE minutes SET minutes_failed = 1 WHERE transcript_id = ? AND user_id = ?',
        [transcriptId, userId]
      ).catch(console.error);
    });

  return c.json({ status: 'regenerating', transcript_id: transcriptId }, 202);
});