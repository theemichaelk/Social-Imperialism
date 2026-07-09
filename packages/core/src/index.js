const path = require('path');
const { createPrismaStore } = require('./prismaStore');
const { persistEntitiesFromStore } = require('./persistEntities');
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

async function persistActiveCampaignToProject(store, projectId) {
  const { prisma } = require('@si/db');
  const activeId = store.getItem('activeCampaignId');
  if (!activeId || activeId !== projectId) return;
  let campaigns = [];
  try { campaigns = JSON.parse(store.getItem('campaigns') || '[]'); } catch (e) {}
  const campaign = campaigns.find((c) => c.id === projectId);
  if (!campaign?.brandName?.trim()) return;
  await prisma.project.update({
    where: { id: projectId },
    data: {
      brandName: campaign.brandName,
      domain: campaign.domain || '',
      description: campaign.description || '',
      tone: campaign.tone || 'Professional',
      name: campaign.brandName,
    },
  });
}

async function syncProjectToStore(store, projectId) {
  const { prisma } = require('@si/db');
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { socialAccounts: true, keywords: true },
  });
  if (!project) return;

  const campaignFromDb = {
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
  if (idx >= 0) {
    const stored = campaigns[idx];
    campaigns[idx] = {
      ...campaignFromDb,
      ...stored,
      brandName: stored.brandName || campaignFromDb.brandName,
      domain: stored.domain || campaignFromDb.domain,
      description: stored.description || campaignFromDb.description,
      tone: stored.tone || campaignFromDb.tone,
    };
  } else {
    campaigns.push(campaignFromDb);
  }
  store.setItem('campaigns', JSON.stringify(campaigns));

  const isSaas = process.env.SAAS_MODE === '1' || process.env.SAAS_MODE === 'true';
  const previousActive = store.getItem('activeCampaignId');
  if (isSaas) {
    store.setItem('activeCampaignId', project.id);
  } else {
    const hasValidActive = previousActive && campaigns.some((c) => c.id === previousActive);
    if (!hasValidActive) store.setItem('activeCampaignId', project.id);
  }
  // Keys are resolved at request time (admin gets .env merge; clients use saved keys only).

  const { ensureProjectDefaults, stripDemoSeedData, isDemoLinkedAccount } = require('./projectDefaults');
  ensureProjectDefaults(store, project);
  stripDemoSeedData(store, project.id);

  const activeCampaignId = store.getItem('activeCampaignId') || project.id;
  const linkedKey = `linkedAccounts_${activeCampaignId}`;
  let linked = [];
  try { linked = JSON.parse(store.getItem(linkedKey) || '[]'); } catch (e) { linked = []; }
  let linkedEmpty = !Array.isArray(linked) || !linked.length;

  if (linkedEmpty && previousActive && previousActive !== activeCampaignId) {
    try {
      const legacy = JSON.parse(store.getItem(`linkedAccounts_${previousActive}`) || '[]');
      const realLegacy = Array.isArray(legacy) ? legacy.filter((a) => !isDemoLinkedAccount(a)) : [];
      if (realLegacy.length) {
        store.setItem(linkedKey, JSON.stringify(realLegacy));
        linkedEmpty = false;
      }
    } catch (e) { /* ignore */ }
  }

  if (project.socialAccounts?.length && linkedEmpty) {
    const accounts = project.socialAccounts
      .filter((a) => !isDemoLinkedAccount({ id: a.id, handle: a.handle, platform: a.platform }))
      .map((a) => ({
        id: a.id,
        platform: a.platform,
        handle: a.handle,
        type: a.accountType,
        ...(a.metadata ? JSON.parse(a.metadata) : {}),
      }));
    if (accounts.length) store.setItem(linkedKey, JSON.stringify(accounts));
  }

  try {
    const { prisma } = require('@si/db');
    const demoAccounts = await prisma.socialAccount.findMany({
      where: { projectId: project.id },
    });
    const demoIds = demoAccounts
      .filter((a) => isDemoLinkedAccount({ id: a.id, handle: a.handle, platform: a.platform }))
      .map((a) => a.id);
    if (demoIds.length) {
      await prisma.socialAccount.deleteMany({ where: { id: { in: demoIds } } });
    }
    await prisma.scheduledPost.deleteMany({
      where: { projectId: project.id, content: { contains: 'Acme Growth Labs tip' } },
    });
  } catch { /* desktop-only */ }

  if (project.keywords?.length && !store.getItem('keywords')) {
    store.setItem('keywords', JSON.stringify(project.keywords.map((k) => ({
      id: k.id,
      term: k.term,
      campaignId: project.id,
      platforms: k.platformFlags ? JSON.parse(k.platformFlags) : [],
    }))));
  }

  try {
    const { reconcileContainment } = require('./sovereignThreatCapture');
    reconcileContainment(store);
  } catch { /* optional */ }

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
    if (['set-active-campaign', 'save-settings'].includes(channel)) {
      await persistActiveCampaignToProject(entry.store, entry.projectId);
    }
    clearHandlerCache(entry.projectId, entry.organizationId);
  }
}

async function invoke({ projectId, organizationId, channel, args = [], userContext = null }) {
  const {
    isPlatformOrgChannel,
    resolvePlatformInvokeTarget,
    clearPlatformOrgStoreCache,
  } = require('./platformOrgStore');

  let targetProjectId = projectId;
  let targetOrgId = organizationId;
  if (isPlatformOrgChannel(channel)) {
    const target = await resolvePlatformInvokeTarget();
    targetProjectId = target.projectId;
    targetOrgId = target.organizationId;
  }

  const entry = await getHandlersForProject({ projectId: targetProjectId, organizationId: targetOrgId });
  const { handlers, store, pendingOAuth } = entry;
  if (userContext) {
    const { isPlatformAdminEmail } = require('./platformAdmin');
    const { releasePendingThreatsForPlatformAdmin } = require('./sovereignThreatCapture');
    const isPlatformAdmin = isPlatformAdminEmail(userContext.email);
    store._invokeContext = { ...userContext, isPlatformAdmin, theeMichael: isPlatformAdmin };
    if (isPlatformAdmin) {
      releasePendingThreatsForPlatformAdmin(store, userContext.email);
    }
  }
  const handler = handlers[channel];
  if (!handler) {
    const err = new Error(`Unknown channel: ${channel}`);
    err.code = 'UNKNOWN_CHANNEL';
    throw err;
  }
  try {
    const result = await handler(null, ...args);
    await store.flush();
    if (isPlatformOrgChannel(channel)) clearPlatformOrgStoreCache();
    await persistEntitiesFromStore(store, projectId, channel);
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
  persistActiveCampaignToProject,
  persistEntitiesFromStore,
  clearHandlerCache,
  eventBus,
  ...require('./platformOrgStore'),
};