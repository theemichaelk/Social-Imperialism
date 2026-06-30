const express = require('express');
const bcrypt = require('bcryptjs');
const { prisma } = require('@si/db');
const { signToken, requireAuth } = require('../middleware/auth');
const { ensureDefaultProject } = require('../projectEnsure');
const { sovereignAuthFailureCapture } = require('../middleware/sovereignThreatShield');
const {
  userHasActiveSubscription,
  setupSubscriberPassword,
  isAdminEmail,
} = require('../subscriptionAccess');

const router = express.Router();

router.post('/register', (_req, res) => {
  res.status(403).json({
    error: 'Open registration is disabled. Subscribe first, then set up your account.',
    subscribeUrl: '/subscribe',
  });
});

router.post('/setup-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { user, orgId, project } = await setupSubscriberPassword(email, password);
    const token = signToken({ userId: user.id, orgId, email: user.email });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      organization: { id: orgId },
      project: { id: project.id, name: project.name },
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalized = String(email || '').trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      await sovereignAuthFailureCapture(req, 'brute_force');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const access = await userHasActiveSubscription(user.id, user.email);
    if (!access.ok && !isAdminEmail(user.email)) {
      return res.status(403).json({
        error: access.error || 'Subscription required',
        subscribeUrl: '/subscribe',
      });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });
    if (!membership) return res.status(403).json({ error: 'No organization' });

    const billing = access.billing || null;
    if (billing?.pendingPasswordSetup) {
      return res.status(403).json({
        error: 'Complete account setup with your subscription email.',
        setupUrl: `/setup-account?email=${encodeURIComponent(user.email)}`,
      });
    }

    const project = await ensureDefaultProject(membership.organizationId);
    const token = signToken({ userId: user.id, orgId: membership.organizationId, email: user.email });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      organization: membership.organization,
      project: { id: project.id, name: project.name },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  const org = await prisma.organization.findUnique({ where: { id: req.user.orgId } });
  let projects = await prisma.project.findMany({ where: { organizationId: req.user.orgId } });
  let active = projects.find((p) => p.isActive) || projects[0] || null;
  if (!active) {
    active = await ensureDefaultProject(req.user.orgId);
    projects = [active];
  }
  res.json({
    user,
    organization: org,
    projects,
    project: { id: active.id, name: active.name },
  });
});

module.exports = router;