/**
 * Background scheduler — auto-search, worker cycle, due scheduled posts.
 */
const { prisma } = require('@si/db');
const { invoke } = require('@si/core');

const FREQ_MS = {
  '5m': 5 * 60 * 1000,
  '10m': 10 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

let timers = [];

function parseFreq(freq, fallback = 24 * 60 * 60 * 1000) {
  if (!freq) return fallback;
  return FREQ_MS[freq] || fallback;
}

async function runForAllProjects(channel, args = []) {
  const projects = await prisma.project.findMany({ where: { isActive: true }, include: { organization: true } });
  const results = [];
  for (const p of projects) {
    try {
      const data = await invoke({
        projectId: p.id,
        organizationId: p.organizationId,
        channel,
        args,
      });
      results.push({ projectId: p.id, ok: true, data });
    } catch (e) {
      console.warn(`[scheduler] ${channel} project ${p.id}:`, e.message);
      results.push({ projectId: p.id, ok: false, error: e.message });
    }
  }
  return results;
}

async function tickWorkerAndSearch() {
  const projects = await prisma.project.findMany({ where: { isActive: true } });
  for (const p of projects) {
    try {
      const { invoke: inv } = require('@si/core');
      const workerOn = await inv({
        projectId: p.id,
        organizationId: p.organizationId,
        channel: 'get-worker-status',
        args: [],
      });
      if (workerOn?.running || workerOn?.isRunning) {
        await inv({
          projectId: p.id,
          organizationId: p.organizationId,
          channel: 'run-auto-rules-now',
          args: [],
        });
      }
      const settings = await inv({
        projectId: p.id,
        organizationId: p.organizationId,
        channel: 'get-auto-search-settings',
        args: [],
      });
      if (settings?.dailyEnabled !== false) {
        const freq = parseFreq(settings?.frequency, 24 * 60 * 60 * 1000);
        const last = settings?.lastRun || 0;
        if (Date.now() - last >= freq) {
          await inv({
            projectId: p.id,
            organizationId: p.organizationId,
            channel: 'trigger-full-auto-search',
            args: [],
          });
        }
      }
    } catch (e) {
      console.warn(`[scheduler] tick project ${p.id}:`, e.message);
    }
  }
}

async function tickDuePosts() {
  await runForAllProjects('process-due-scheduled-posts', []);
}

function startScheduler() {
  if (process.env.DISABLE_SCHEDULER === '1') return;
  timers.forEach(clearInterval);
  timers = [];

  const workerInterval = parseInt(process.env.SCHEDULER_WORKER_MS || '600000', 10);
  const postsInterval = parseInt(process.env.SCHEDULER_POSTS_MS || '120000', 10);

  timers.push(setInterval(() => tickWorkerAndSearch().catch(console.error), workerInterval));
  timers.push(setInterval(() => tickDuePosts().catch(console.error), postsInterval));

  console.log(`[scheduler] Started — worker/search every ${workerInterval / 1000}s, due posts every ${postsInterval / 1000}s`);
}

function stopScheduler() {
  timers.forEach(clearInterval);
  timers = [];
}

module.exports = { startScheduler, stopScheduler, tickWorkerAndSearch, tickDuePosts };