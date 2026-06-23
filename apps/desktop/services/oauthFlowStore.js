/**
 * Persistent OAuth flows for SaaS (survives multi-instance API + long polls).
 */
const FLOW_PREFIX = 'oauth_flow_';
const TTL_MS = 15 * 60 * 1000;

async function saveFlow(projectId, state, data) {
  const { prisma } = require('@si/db');
  const payload = {
    ...data,
    state,
    projectId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await prisma.projectSetting.upsert({
    where: { projectId_key: { projectId, key: `${FLOW_PREFIX}${state}` } },
    create: { projectId, key: `${FLOW_PREFIX}${state}`, value: JSON.stringify(payload) },
    update: { value: JSON.stringify(payload) },
  });
  return payload;
}

async function getFlow(state) {
  const { prisma } = require('@si/db');
  const rows = await prisma.projectSetting.findMany({
    where: { key: `${FLOW_PREFIX}${state}` },
    take: 1,
  });
  if (!rows.length) return null;
  try {
    return JSON.parse(rows[0].value);
  } catch (e) {
    return null;
  }
}

async function updateFlow(state, patch) {
  const flow = await getFlow(state);
  if (!flow) return null;
  const next = { ...flow, ...patch, updatedAt: new Date().toISOString() };
  const { prisma } = require('@si/db');
  await prisma.projectSetting.updateMany({
    where: { key: `${FLOW_PREFIX}${state}` },
    data: { value: JSON.stringify(next) },
  });
  return next;
}

async function markComplete(state, tokens) {
  return updateFlow(state, { status: 'complete', tokens });
}

async function markError(state, error) {
  return updateFlow(state, { status: 'error', error: String(error) });
}

async function removeFlow(state) {
  const { prisma } = require('@si/db');
  await prisma.projectSetting.deleteMany({ where: { key: `${FLOW_PREFIX}${state}` } });
}

function isExpired(flow) {
  if (!flow?.createdAt) return true;
  return Date.now() - new Date(flow.createdAt).getTime() > TTL_MS;
}

module.exports = {
  saveFlow,
  getFlow,
  updateFlow,
  markComplete,
  markError,
  removeFlow,
  isExpired,
  FLOW_PREFIX,
};