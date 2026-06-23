/**
 * Durable background jobs via Prisma Job table.
 */
const { prisma } = require('@si/db');

async function enqueue({ type, projectId, organizationId, payload, runAt }) {
  const job = await prisma.job.create({
    data: {
      type,
      projectId: projectId || null,
      payload: payload ? JSON.stringify(payload) : null,
      status: 'pending',
      runAt: runAt || new Date(),
    },
  });
  return job;
}

async function claimNextJob() {
  const job = await prisma.job.findFirst({
    where: { status: 'pending', runAt: { lte: new Date() } },
    orderBy: { runAt: 'asc' },
  });
  if (!job) return null;
  await prisma.job.update({
    where: { id: job.id },
    data: { status: 'running', updatedAt: new Date() },
  });
  return job;
}

async function completeJob(id, result, error) {
  await prisma.job.update({
    where: { id },
    data: {
      status: error ? 'failed' : 'completed',
      result: result ? JSON.stringify(result) : null,
      updatedAt: new Date(),
    },
  });
}

async function processOneJob() {
  const job = await claimNextJob();
  if (!job) return null;

  let payload = {};
  try { payload = job.payload ? JSON.parse(job.payload) : {}; } catch (e) {}

  try {
    if (!job.projectId) throw new Error('Job missing projectId');
    const project = await prisma.project.findUnique({
      where: { id: job.projectId },
      select: { organizationId: true },
    });
    if (!project) throw new Error('Project not found for job');

    const channel = payload.channel || job.type;
    const args = payload.args || [];
    const { invoke } = require('./index');
    const data = await invoke({
      projectId: job.projectId,
      organizationId: project.organizationId,
      channel,
      args,
    });
    await completeJob(job.id, data);
    return { jobId: job.id, channel, ok: true, data };
  } catch (e) {
    await completeJob(job.id, null, e.message);
    return { jobId: job.id, ok: false, error: e.message };
  }
}

async function tickJobs() {
  const max = parseInt(process.env.JOB_RUNNER_BATCH || '5', 10);
  const results = [];
  for (let i = 0; i < max; i++) {
    const r = await processOneJob();
    if (!r) break;
    results.push(r);
  }
  return results;
}

function startJobRunner() {
  if (process.env.DISABLE_JOB_RUNNER === '1') return () => {};
  const interval = parseInt(process.env.JOB_RUNNER_MS || '30000', 10);
  const id = setInterval(() => tickJobs().catch(console.error), interval);
  console.log(`[jobRunner] Started — every ${interval / 1000}s`);
  return () => clearInterval(id);
}

module.exports = { enqueue, processOneJob, tickJobs, startJobRunner };