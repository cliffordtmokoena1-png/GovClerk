import { createMiddleware } from 'hono/factory';
import { verifyToken } from '@clerk/backend';
import { timingSafeEqual, createHash } from 'node:crypto';

/**
 * Auth middleware for user-facing endpoints that accept Clerk JWT Bearer tokens.
 * Also accepts the UPLOAD_COMPLETE_WEBHOOK_SECRET for internal service calls,
 * matching the dual-auth pattern used in the Rust platform server.
 */
export const clerkAuthMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);

  // 1. Check if it's the internal webhook secret (for service-to-service calls)
  const secret = process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET;
  if (secret) {
    const tokenBuf = createHash('sha256').update(token).digest();
    const secretBuf = createHash('sha256').update(secret).digest();
    if (timingSafeEqual(tokenBuf, secretBuf)) {
      await next();
      return;
    }
  }

  // 2. Otherwise validate as a Clerk session JWT
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    return c.json({ error: 'Server misconfigured: missing CLERK_SECRET_KEY' }, 500);
  }

  try {
    await verifyToken(token, { secretKey: clerkSecretKey });
    await next();
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }
});
