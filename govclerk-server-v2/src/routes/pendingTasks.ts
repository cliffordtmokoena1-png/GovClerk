import { Hono } from 'hono';
import { activeJobs } from '../types.js';

export const pendingTasksRoute = new Hono();

pendingTasksRoute.get('/get-pending-tasks', (c) => {
  const jobs = Array.from(activeJobs.values()).map(job => ({
    transcript_id: job.transcript_id,
    status: job.status,
    started_at: job.started_at.toISOString(),
    elapsed_seconds: Math.floor((Date.now() - job.started_at.getTime()) / 1000),
  }));
  return c.json({ pending_tasks: jobs, count: jobs.length });
});
