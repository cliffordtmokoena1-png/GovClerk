import { Hono } from 'hono';
import { execute } from '../services/database.js';

export const webhookRoute = new Hono();

webhookRoute.post('/upload-complete-webhook', async (c) => {
  const secret = process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET;
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !secret || authHeader !== `Bearer ${secret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json().catch(() => null);
  if (!body?.transcript_id) return c.json({ error: 'Missing transcript_id' }, 400);

  await execute('UPDATE transcripts SET upload_complete = 1 WHERE id = ?', [body.transcript_id]);
  return c.json({ status: 'ok', transcript_id: body.transcript_id });
});
