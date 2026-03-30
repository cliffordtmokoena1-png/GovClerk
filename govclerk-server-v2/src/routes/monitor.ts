import { Hono } from 'hono';

export const monitorRoute = new Hono();

monitorRoute.get('/monitor', (c) => {
  return c.json({ monitor: 12345, version: 'v2', status: 'ok', timestamp: new Date().toISOString() });
});
