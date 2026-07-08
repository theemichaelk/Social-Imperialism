const express = require('express');
const { prisma } = require('@si/db');
const path = require('path');
const {
  getSiteTrackingSettings,
  getPublicSiteTrackingPayload,
} = require(path.join(__dirname, '../../../desktop/services/siteTrackingSettings'));

const router = express.Router();

async function resolvePublicProject() {
  const projectId = process.env.PUBLIC_SITE_PROJECT_ID;
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project) return project;
  }
  const orgSlug = process.env.SEED_ORG_SLUG || 'social-imperialism';
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) return null;
  return prisma.project.findFirst({
    where: { organizationId: org.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
}

/** Minimal prisma-backed store for one project setting key. */
function createReadStore(projectId, organizationId) {
  return {
    projectId,
    organizationId,
    getItem(key) {
      return this._cache?.[key] ?? null;
    },
    async load() {
      const row = await prisma.projectSetting.findUnique({
        where: { projectId_key: { projectId, key: 'siteTrackingSettings' } },
      });
      this._cache = { siteTrackingSettings: row?.value || null };
    },
  };
}

router.get('/site-tracking', async (req, res) => {
  try {
    const project = await resolvePublicProject();
    if (!project) {
      const { emptySettings } = require(path.join(__dirname, '../../../desktop/services/siteTrackingSettings'));
      return res.json({ success: true, data: getPublicSiteTrackingPayload(emptySettings(), req.query.path || '/') });
    }
    const store = createReadStore(project.id, project.organizationId);
    await store.load();
    const settings = getSiteTrackingSettings(store);
    const payload = getPublicSiteTrackingPayload(settings, req.query.path || '/');
    res.set('Cache-Control', 'public, max-age=120');
    res.json({ success: true, data: payload });
  } catch (e) {
    console.error('public/site-tracking:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;