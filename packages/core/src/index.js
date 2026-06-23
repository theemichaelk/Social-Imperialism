const path = require('path');
const { createPrismaStore } = require('./prismaStore');
const { registerAllHandlers } = require('./handlerRegistry');
const eventCoordination = require('./eventCoordination');
const { wrapInvokeError } = require('./resilience');
const eventBus = require('./eventBus');

const handlerCache = new Map();
const CACHE_TTL_MS = parseInt(process.env.HANDLER_CACHE_TTL_MS || '1800000', 10);

function clearHandlerCache(projectId, organizationId) {
  if (projectId && organizationId) {
    handlerCache.delete(`${organizationId}:${projectId}`);
    return;
  }
  handlerCache.clear();
}

async function getHandlersForProject({ projectId, organizationId, userDataPath, forceRefresh = false }) {
  const cacheKey = `${organizationId}:${projectId}`;
  const cached = handlerCache.get(cacheKey);
  if (!forceRefresh && cached) {
    if (Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.entry;
    handlerCache.delete(cacheKey);
  }

  const store = await createPrismaStore({ projectId, organizationId });
  await syncProjectToStore(store, projectId);

  const registry = await registerAllHandlers(store, { userDataPath });
  const entry = { store, ...registry, projectId, organizationId };

  store.coordinateEvent = (type, data) => eventCoordination.dispatch(entry, {
    type,
    data,
    projectId,
    organizationId,
  });

  handlerCache.set(cacheKey, { entry, loadedAt: Date.now() });
  return entry;
}

async function syncProjectToStore(store, projectId) {
  const { prisma } = require('@si/db');
  const { ensureProjectDefaults } = require('./projectDefaults');
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { socialAccounts: true, keywords: true },
  });
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
  {
    const { resolveKeys } = require(path.join(__dirname, '../../../apps/desktop/services/keys'));
    let stored = {};
    try { stored = JSON.parse(store.getItem('globalApiKeys') || '{}'); } catch (e) {}
    const merged = resolveKeys(stored);
    store.setItem('globalApiKeys', JSON.stringify(merged));
  }

  ensureProjectDefaults(store, project);

  const linkedKey = `linkedAccounts_${project.id}`;
  if (project.socialAccounts?.length && !store.getItem(linkedKey)) {
    const accounts = project.socialAccounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      handle: a.handle,
      type: a.accountType,
      ...(a.metadata ? JSON.parse(a.metadata) : {}),
    }));
    store.setItem(linkedKey, JSON.stringify(accounts));
  }

  if (project.keywords?.length && !store.getItem('keywords')) {
    store.setItem('keywords', JSON.stringify(project.keywords.map((k) => ({
      id: k.id,
      term: k.term,
      campaignId: project.id,
      platforms: k.platformFlags ? JSON.parse(k.platformFlags) : [],
    }))));
  }

  await store.flush();
}

async function afterInvoke({ entry, channel, args, result }) {
  const mapped = eventCoordination.mapChannelEvent(channel, args, result);
  if (mapped) {
    await eventCoordination.dispatch(entry, {
      ...mapped,
      projectId: entry.projectId,
      organizationId: entry.organizationId,
    });
  }

  if (['set-active-campaign', 'save-global-keys', 'save-settings'].includes(channel)) {
    clearHandlerCache(entry.projectId, entry.organizationId);
  }
}

async function invoke({ projectId, organizationId, channel, args = [], userContext = null }) {
  const entry = await getHandlersForProject({ projectId, organizationId });
  const { handlers, store, pendingOAuth } = entry;
  if (userContext) store._invokeContext = userContext;
  const handler = handlers[channel];
  if (!handler) {
    const err = new Error(`Unknown channel: ${channel}`);
    err.code = 'UNKNOWN_CHANNEL';
    throw err;
  }
  try {
    const result = await handler(null, ...args);
    await store.flush();
    await afterInvoke({ entry, channel, args, result });

    const oauthUrl = typeof pendingOAuth === 'function' ? pendingOAuth() : null;
    if (!oauthUrl) return result;
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return { ...result, pendingOAuthUrl: oauthUrl };
    }
    return { success: true, data: result, pendingOAuthUrl: oauthUrl };
  } catch (e) {
    throw wrapInvokeError(e);
  }
}

function listChannels(projectId, organizationId) {
  const cacheKey = `${organizationId}:${projectId}`;
  const cached = handlerCache.get(cacheKey);
  return cached?.entry ? Object.keys(cached.entry.handlers).sort() : [];
}

module.exports = {
  createPrismaStore,
  registerAllHandlers,
  getHandlersForProject,
  invoke,
  listChannels,
  syncProjectToStore,
  clearHandlerCache,
  eventBus,
};