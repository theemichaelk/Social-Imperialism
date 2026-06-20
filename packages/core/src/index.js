const path = require('path');
const { createPrismaStore } = require('./prismaStore');
const { registerAllHandlers } = require('./handlerRegistry');

const handlerCache = new Map();

async function getHandlersForProject({ projectId, organizationId, userDataPath }) {
  const cacheKey = `${organizationId}:${projectId}`;
  if (handlerCache.has(cacheKey)) return handlerCache.get(cacheKey);

  const store = await createPrismaStore({ projectId, organizationId });
  await syncProjectToStore(store, projectId);

  const registry = await registerAllHandlers(store, { userDataPath });
  const entry = { store, ...registry };
  handlerCache.set(cacheKey, entry);
  return entry;
}

async function syncProjectToStore(store, projectId) {
  const { prisma } = require('@si/db');
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return;

  const campaign = {
    id: project.id,
    brandName: project.brandName || project.name,
    domain: project.domain || '',
    description: project.description || '',
    tone: project.tone || 'Professional',
    status: 'Active',
  };

  let campaigns = [];
  try { campaigns = JSON.parse(store.getItem('campaigns') || '[]'); } catch (e) {}
  const idx = campaigns.findIndex((c) => c.id === project.id);
  if (idx >= 0) campaigns[idx] = { ...campaigns[idx], ...campaign };
  else campaigns.push(campaign);
  store.setItem('campaigns', JSON.stringify(campaigns));
  store.setItem('activeCampaignId', project.id);
  if (!store.getItem('globalApiKeys')) {
    const { resolveKeys } = require(path.join(__dirname, '../../../apps/desktop/services/keys'));
    const envKeys = resolveKeys({});
    store.setItem('globalApiKeys', JSON.stringify(envKeys));
  }
  await store.flush();
}

async function invoke({ projectId, organizationId, channel, args = [] }) {
  const { handlers, store } = await getHandlersForProject({ projectId, organizationId });
  const handler = handlers[channel];
  if (!handler) {
    const err = new Error(`Unknown channel: ${channel}`);
    err.code = 'UNKNOWN_CHANNEL';
    throw err;
  }
  const result = await handler(null, ...args);
  await store.flush();
  return result;
}

function listChannels(projectId, organizationId) {
  const cacheKey = `${organizationId}:${projectId}`;
  const entry = handlerCache.get(cacheKey);
  return entry ? Object.keys(entry.handlers).sort() : [];
}

module.exports = {
  createPrismaStore,
  registerAllHandlers,
  getHandlersForProject,
  invoke,
  listChannels,
  syncProjectToStore,
};