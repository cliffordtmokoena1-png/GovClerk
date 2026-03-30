import { createMiddleware } from 'hono/factory';
import { timingSafeEqual, createHash } from 'node:crypto';

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);
  const secret = process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET;
  if (!secret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  // Use constant-time comparison to prevent timing attacks
  const tokenBuf = createHash('sha256').update(token).digest();
  const secretBuf = createHash('sha256').update(secret).digest();
  if (!timingSafeEqual(tokenBuf, secretBuf)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});
