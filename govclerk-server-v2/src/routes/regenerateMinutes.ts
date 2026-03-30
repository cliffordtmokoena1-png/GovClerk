import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { regenerateMinutes } from '../services/openai.js';
import { query, execute } from '../services/database.js';

export const regenerateMinutesRoute = new Hono();

regenerateMinutesRoute.post(
  '/regenerate-minutes/:transcript_id',
  authMiddleware,
  zValidator('json', z.object({ feedback: z.string() })),
  async (c) => {
    const transcriptId = parseInt(c.req.param('transcript_id'), 10);
    const { feedback } = c.req.valid('json');
    const authHeader = c.req.header('Authorization')!;
    const userId = authHeader.slice(7);

    const minutesRows = await query<{ minutes: string; version: number }>(
      'SELECT minutes, version FROM minutes WHERE transcript_id = ? AND user_id = ? ORDER BY version DESC LIMIT 1',
      [transcriptId, userId]
    );

    if (minutesRows.length === 0) return c.json({ error: 'No minutes found' }, 404);

    const transcriptRows = await query<{ transcript_text: string | null }>(
      'SELECT transcript_text FROM transcripts WHERE id = ?',
      [transcriptId]
    );

    const transcriptText = transcriptRows[0]?.transcript_text ?? '';
    const previousMinutes = minutesRows[0].minutes;
    const nextVersion = minutesRows[0].version + 1;

    await execute('UPDATE minutes SET feedback = ? WHERE transcript_id = ? AND user_id = ?', [feedback, transcriptId, userId]);

    // Generate new minutes incorporating the feedback; insert as a new version row.
    // The feedback column on the previous version row records what prompted the revision.
    regenerateMinutes(transcriptText, previousMinutes, feedback)
      .then(newMinutes =>
        execute(
          'INSERT INTO minutes (transcript_id, user_id, minutes, version, ts_start, feedback) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), ?)',
          [transcriptId, userId, newMinutes, nextVersion, feedback]
        )
      )
      .catch(err => console.error(`[regenerate-minutes] Error for ${transcriptId}:`, err));

    return c.json({ status: 'regenerating', transcript_id: transcriptId }, 202);
  }
);
