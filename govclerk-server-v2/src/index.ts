import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { monitorRoute } from './routes/monitor.js';
import { diarizationRoute } from './routes/diarization.js';
import { createMinutesRoute } from './routes/createMinutes.js';
import { regenerateMinutesRoute } from './routes/regenerateMinutes.js';
import { pendingTasksRoute } from './routes/pendingTasks.js';
import { webhookRoute } from './routes/webhook.js';
import { convertDocumentRoute } from './routes/convertDocument.js';

const app = new Hono();

app.use('*', cors({
  origin: '*',
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}));
app.use('*', logger());

app.route('/api', monitorRoute);
app.route('/api', diarizationRoute);
app.route('/api', createMinutesRoute);
app.route('/api', regenerateMinutesRoute);
app.route('/api', pendingTasksRoute);
app.route('/api', webhookRoute);
app.route('/api', convertDocumentRoute);

const port = Number(process.env.PORT) || 8000;
console.log(`GovClerk Server v2 running on port ${port}`);

serve({ fetch: app.fetch, port });