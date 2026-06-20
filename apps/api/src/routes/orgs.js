const express = require('express');
const { prisma } = require('@si/db');
const { syncProjectToStore, createPrismaStore } = require('@si/core');

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
  res.json({ success: true });
});

module.exports = router;