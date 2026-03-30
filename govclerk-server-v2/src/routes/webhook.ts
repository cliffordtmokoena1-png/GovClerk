import { Hono } from 'hono';
import { z } from 'zod';
import { execute } from '../services/database.js';

export const webhookRoute = new Hono();

const bodySchema = z.object({
  transcript_id: z.number(),
  s3_audio_key: z.string().optional(),
});

// This webhook is called by the Next.js frontend when an upload is complete
webhookRoute.post('/upload-complete-webhook', async (c) => {
  const secret = process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET;
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !secret || authHeader !== `Bearer ${secret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json().catch(() => null);
  if (!body?.transcript_id) {
    return c.json({ error: 'Missing transcript_id' }, 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  await execute(
    'UPDATE transcripts SET upload_complete = 1 WHERE id = ?',
    [parsed.data.transcript_id]
  );

  return c.json({ status: 'ok', transcript_id: parsed.data.transcript_id });
});