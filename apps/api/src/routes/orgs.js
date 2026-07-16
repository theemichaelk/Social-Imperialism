const express = require('express');
const { prisma } = require('@si/db');
const { syncProjectToStore, createPrismaStore, clearHandlerCache } = require('@si/core');

const router = express.Router();

router.get('/projects', async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { organizationId: req.user.orgId },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ projects });
});

router.post('/projects', async (req, res) => {
  const { name, brandName, domain, description, tone } = req.body;

  // Brand caps: inactive/free → 1; starter → 3; growth → 10; enterprise → 50
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.user.orgId } });
    const plan = String(org?.plan || 'starter').toLowerCase();
    const existingCount = await prisma.project.count({ where: { organizationId: req.user.orgId } });

    let billingStatus = '';
    try {
      const row = await prisma.orgSetting.findUnique({
        where: { organizationId_key: { organizationId: req.user.orgId, key: 'billingPlan' } },
      });
      const billing = row?.value ? JSON.parse(row.value) : {};
      billingStatus = String(billing.status || '').toLowerCase();
    } catch {
      billingStatus = '';
    }

    const inactive = !billingStatus || billingStatus === 'inactive' || billingStatus === 'canceled' || billingStatus === 'free';
    const freeLike = inactive || plan === 'free' || plan === 'trial';
    const maxBrands = freeLike ? 1 : plan === 'starter' ? 3 : plan === 'growth' ? 10 : 50;

    if (existingCount >= maxBrands) {
      return res.status(403).json({
        error: freeLike
          ? 'Reached free plan limit. Free plan allows 1 brand. Upgrade to create more.'
          : `Plan limit reached (${maxBrands} brands on ${plan}). Upgrade to create more.`,
        code: 'PLAN_BRAND_LIMIT',
        planLimit: true,
        subscribeUrl: '/subscribe',
        maxBrands,
        existingCount,
      });
    }
  } catch (e) {
    // Non-fatal: allow create if plan check fails unexpectedly
    console.warn('[orgs] plan brand limit check:', e.message);
  }

  const project = await prisma.project.create({
    data: {
      organizationId: req.user.orgId,
      name: name || 'New Campaign',
      brandName: brandName || name,
      domain, description, tone,
      isActive: false,
    },
  });
  res.json({ project });
});

router.patch('/projects/:id', async (req, res) => {
  const project = await prisma.project.updateMany({
    where: { id: req.params.id, organizationId: req.user.orgId },
    data: req.body,
  });
  if (project.count === 0) return res.status(404).json({ error: 'Not found' });

  const updated = await prisma.project.findUnique({ where: { id: req.params.id } });
  const store = await createPrismaStore({ projectId: updated.id, organizationId: req.user.orgId });
  await syncProjectToStore(store, updated.id);
  await store.flush();
  clearHandlerCache(updated.id, req.user.orgId);
  res.json({ project: updated });
});

router.post('/projects/:id/activate', async (req, res) => {
  await prisma.project.updateMany({
    where: { organizationId: req.user.orgId },
    data: { isActive: false },
  });
  await prisma.project.updateMany({
    where: { id: req.params.id, organizationId: req.user.orgId },
    data: { isActive: true },
  });
  clearHandlerCache(req.params.id, req.user.orgId);
  res.json({ success: true });
});

module.exports = router;