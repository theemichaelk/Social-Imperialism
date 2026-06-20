require('dotenv').config({ path: require('path').join(__dirname, '../../api/.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../../desktop/.env') });

const { prisma } = require('@si/db');
const { invoke } = require('@si/core');

const POLL_MS = parseInt(process.env.WORKER_POLL_MS || '60000', 10);

async function processDuePosts() {
  const projects = await prisma.project.findMany({ select: { id: true, organizationId: true } });
  for (const p of projects) {
    try {
      const result = await invoke({
        projectId: p.id,
        organizationId: p.organizationId,
        channel: 'process-due-scheduled-posts',
        args: [],
      });
      if (result?.published > 0) {
        console.log(`[worker] Published ${result.published} for project ${p.id}`);
      }
    } catch (e) {
      console.warn(`[worker] project ${p.id}:`, e.message);
    }
  }
}

async function tick() {
  console.log('[worker] tick', new Date().toISOString());
  await processDuePosts();
}

console.log('[worker] Social Imperialism background worker started');
tick();
setInterval(tick, POLL_MS);