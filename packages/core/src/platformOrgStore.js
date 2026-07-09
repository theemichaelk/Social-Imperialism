/**
 * Platform org store — backs www.socialimperialism.com settings (tracking, DNS, etc.)
 * that must persist on SEED_ORG_SLUG regardless of the user's active campaign org.
 */
const path = require('path');
const { prisma } = require('@si/db');
const { createPrismaStore } = require('./prismaStore');

const SITE_TRACKING_CHANNELS = new Set([
  'get-site-tracking-settings',
  'save-site-tracking-settings',
  'get-public-site-tracking-preview',
]);

let cache = null;
const CACHE_TTL_MS = 60_000;

function platformOrgSlug() {
  return process.env.PUBLIC_SITE_ORG_SLUG || process.env.SEED_ORG_SLUG || 'social-imperialism';
}

async function resolvePlatformOrg() {
  const org = await prisma.organization.findUnique({ where: { slug: platformOrgSlug() } });
  if (!org) throw new Error(`Platform org not found: ${platformOrgSlug()}`);
  return org;
}

async function resolvePlatformProject(orgId) {
  const projectId = process.env.PUBLIC_SITE_PROJECT_ID;
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project?.organizationId === orgId) return project;
  }
  let project = await prisma.project.findFirst({
    where: { organizationId: orgId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!project) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    project = await prisma.project.create({
      data: {
        organizationId: orgId,
        name: 'Platform Site',
        brandName: org?.name || 'Platform Site',
        isActive: true,
      },
    });
  }
  return project;
}

async function getPlatformOrgStore({ forceRefresh = false } = {}) {
  if (!forceRefresh && cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache.store;
  }
  const org = await resolvePlatformOrg();
  const project = await resolvePlatformProject(org.id);
  const store = await createPrismaStore({ projectId: project.id, organizationId: org.id });
  cache = { store, loadedAt: Date.now(), organizationId: org.id, projectId: project.id };
  return store;
}

function clearPlatformOrgStoreCache() {
  cache = null;
}

function isSiteTrackingChannel(channel) {
  return SITE_TRACKING_CHANNELS.has(channel);
}

async function invokeSiteTrackingChannel(channel, args = []) {
  const desktopServices = path.join(__dirname, '../../../apps/desktop/services/siteTrackingSettings');
  const {
    getSiteTrackingSettings,
    saveSiteTrackingSettings,
    getPublicSiteTrackingPayload,
    getSitePagesCatalog,
  } = require(desktopServices);
  const store = await getPlatformOrgStore();

  if (channel === 'get-site-tracking-settings') {
    return {
      success: true,
      settings: getSiteTrackingSettings(store),
      catalog: getSitePagesCatalog(),
    };
  }
  if (channel === 'save-site-tracking-settings') {
    const result = saveSiteTrackingSettings(store, args[0] || {});
    await store.flush();
    clearPlatformOrgStoreCache();
    return result;
  }
  if (channel === 'get-public-site-tracking-preview') {
    const pathname = args[0] || '/';
    return {
      success: true,
      preview: getPublicSiteTrackingPayload(getSiteTrackingSettings(store), pathname),
    };
  }
  throw new Error(`Unhandled site tracking channel: ${channel}`);
}

module.exports = {
  SITE_TRACKING_CHANNELS,
  platformOrgSlug,
  resolvePlatformOrg,
  getPlatformOrgStore,
  clearPlatformOrgStoreCache,
  isSiteTrackingChannel,
  invokeSiteTrackingChannel,
};