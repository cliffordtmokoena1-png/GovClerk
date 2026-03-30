import { createMiddleware } from 'hono/factory';

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const secret = process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET;

  if (!secret || token !== secret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
});
