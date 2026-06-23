const express = require('express');
const bcrypt = require('bcryptjs');
const { prisma } = require('@si/db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, orgName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const slug = (orgName || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        name: name || email.split('@')[0],
      },
    });

    const org = await prisma.organization.create({
      data: { name: orgName || `${user.name}'s Workspace`, slug: `${slug}-${Date.now().toString(36)}`, plan: 'starter' },
    });

    await prisma.organizationMember.create({
      data: { organizationId: org.id, userId: user.id, role: 'owner' },
    });

    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        name: 'Default Campaign',
        brandName: org.name,
        isActive: true,
      },
    });

    const token = signToken({ userId: user.id, orgId: org.id, email: user.email });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      organization: { id: org.id, name: org.name, slug: org.slug, plan: org.plan },
      project: { id: project.id, name: project.name },
    });
  } catch (e) {
    console.error('register:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });
    if (!membership) return res.status(403).json({ error: 'No organization' });

    const project = await prisma.project.findFirst({
      where: { organizationId: membership.organizationId, isActive: true },
    }) || await prisma.project.findFirst({ where: { organizationId: membership.organizationId } });

    const token = signToken({ userId: user.id, orgId: membership.organizationId, email: user.email });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      organization: membership.organization,
      project: project ? { id: project.id, name: project.name } : null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  const org = await prisma.organization.findUnique({ where: { id: req.user.orgId } });
  const projects = await prisma.project.findMany({ where: { organizationId: req.user.orgId } });
  const active = projects.find((p) => p.isActive) || projects[0] || null;
  res.json({
    user,
    organization: org,
    projects,
    project: active ? { id: active.id, name: active.name } : null,
  });
});

module.exports = router;