const express = require('express');
const { prisma } = require('@si/db');
const path = require('path');
const {
  getSiteTrackingSettings,
  getPublicSiteTrackingPayload,
  emptySettings,
  STORE_KEY,
  LEGACY_STORE_KEY,
} = require(path.join(__dirname, '../../../desktop/services/siteTrackingSettings'));

const router = express.Router();

async function resolvePublicOrg() {
  const orgSlug = process.env.SEED_ORG_SLUG || 'social-imperialism';
  return prisma.organization.findUnique({ where: { slug: orgSlug } });
}

async function resolvePublicProject() {
  const projectId = process.env.PUBLIC_SITE_PROJECT_ID;
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project) return project;
  }
  const org = await resolvePublicOrg();
  if (!org) return null;
  return prisma.project.findFirst({
    where: { organizationId: org.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
}

function parseSettingsJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadPublicTrackingSettings() {
  const org = await resolvePublicOrg();
  if (org) {
    const orgRow = await prisma.orgSetting.findUnique({
      where: { organizationId_key: { organizationId: org.id, key: STORE_KEY } },
    });
    const parsed = parseSettingsJson(orgRow?.value);
    if (parsed) {
      return getSiteTrackingSettings({
        getItem: (key) => (key === STORE_KEY ? orgRow.value : null),
      });
    }
  }

  const project = await resolvePublicProject();
  if (!project) return emptySettings();

  const [orgRow, projectRow] = await Promise.all([
    org
      ? prisma.orgSetting.findUnique({
        where: { organizationId_key: { organizationId: org.id, key: STORE_KEY } },
      })
      : null,
    prisma.projectSetting.findUnique({
      where: { projectId_key: { projectId: project.id, key: LEGACY_STORE_KEY } },
    }),
  ]);

  const cache = {};
  if (orgRow?.value) cache[STORE_KEY] = orgRow.value;
  if (projectRow?.value) cache[LEGACY_STORE_KEY] = projectRow.value;

  return getSiteTrackingSettings({
    getItem: (key) => cache[key] ?? null,
  });
}

router.get('/site-tracking', async (req, res) => {
  try {
    const settings = await loadPublicTrackingSettings();
    const payload = getPublicSiteTrackingPayload(settings, req.query.path || '/');
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ success: true, data: payload });
  } catch (e) {
    console.error('public/site-tracking:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/site-tracking/status', async (req, res) => {
  try {
    const { summarizeTrackingPayload } = require(path.join(__dirname, '../../../desktop/services/siteTrackingSettings'));
    const settings = await loadPublicTrackingSettings();
    const pathname = req.query.path || '/';
    const payload = getPublicSiteTrackingPayload(settings, pathname);
    const summary = summarizeTrackingPayload(payload);
    res.json({
      success: true,
      path: pathname,
      configured: summary.active,
      fields: summary.fields,
      updatedAt: summary.updatedAt,
      ga4: !!payload.ga4MeasurementId,
      gtm: !!payload.gtmContainerId,
      googleSearchConsole: !!payload.googleSearchConsoleVerification,
      bing: !!payload.bingWebmasterVerification,
      yahoo: !!payload.yahooSiteVerification,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = { router, loadPublicTrackingSettings, resolvePublicOrg, resolvePublicProject };