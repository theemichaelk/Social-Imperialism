const express = require('express');
const bcrypt = require('bcryptjs');
const { prisma } = require('@si/db');
const {
  signToken,
  requireAuth,
  createSession,
  revokeSession,
} = require('../middleware/auth');
const { ensureDefaultProject } = require('../projectEnsure');
const { sovereignAuthFailureCapture } = require('../middleware/sovereignThreatShield');
const {
  userHasActiveSubscription,
  setupSubscriberPassword,
  isAdminEmail,
} = require('../subscriptionAccess');
const {
  validateLoginBody,
  validateSetupPasswordBody,
} = require('../lib/authValidation');
const { enrollOnPasswordSetup } = require('../services/onboardingEmailSequences');
const {
  requestPasswordReset,
  completePasswordReset,
} = require('../services/passwordReset');

const router = express.Router();

const loginFailMap = new Map();
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAIL_CAPTURE_THRESHOLD = 5;

function shouldCaptureLoginBruteForce(req, email) {
  const key = `${req.ip || req.headers['x-forwarded-for'] || 'unknown'}:${String(email || '').toLowerCase()}`;
  const now = Date.now();
  let entry = loginFailMap.get(key);
  if (!entry || now - entry.start > LOGIN_FAIL_WINDOW_MS) {
    entry = { start: now, count: 0 };
    loginFailMap.set(key, entry);
  }
  entry.count += 1;
  return entry.count >= LOGIN_FAIL_CAPTURE_THRESHOLD;
}

router.post('/register', (_req, res) => {
  res.status(403).json({
    error: 'Open registration is disabled. Subscribe first, then set up your account.',
    subscribeUrl: '/subscribe',
  });
});

router.post('/setup-password', async (req, res) => {
  try {
    const validation = validateSetupPasswordBody(req.body);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    const { user, orgId, project } = await setupSubscriberPassword(
      validation.email,
      validation.password,
    );

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id, organizationId: orgId },
      include: { organization: true },
    });

    const billingRow = await prisma.orgSetting.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: 'billingPlan' } },
    });
    let planName = 'Social Imperialism';
    try {
      const billing = billingRow?.value ? JSON.parse(billingRow.value) : {};
      planName = billing.planName || billing.plan || planName;
    } catch (e) {
      /* use default plan name */
    }

    enrollOnPasswordSetup({
      userId: user.id,
      organizationId: orgId,
      email: user.email,
      planName,
    }).catch((err) => console.warn('[auth] password nurture email:', err.message));

    const token = signToken({ userId: user.id, orgId, email: user.email });
    await createSession(user.id, token);

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      organization: membership?.organization || { id: orgId },
      project: { id: project.id, name: project.name },
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const validation = validateLoginBody(req.body);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    const user = await prisma.user.findUnique({ where: { email: validation.email } });
    if (!user || !(await bcrypt.compare(validation.password, user.passwordHash))) {
      if (shouldCaptureLoginBruteForce(req, validation.email)) {
        await sovereignAuthFailureCapture(req, 'brute_force');
      }
      return res.status(401).json({ error: 'Invalid email or password.' });
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
    await createSession(user.id, token);

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, isAdmin: isAdminEmail(user.email) },
      organization: membership.organization,
      project: { id: project.id, name: project.name },
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Sign in failed. Please try again.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const result = await requestPasswordReset(req.body?.email);
    if (!result.ok) {
      return res.status(503).json({ error: result.error });
    }
    res.json({ success: true, message: result.message });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Could not process request.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    const result = await completePasswordReset(token, password);
    res.json({ success: true, message: 'Password updated. You can sign in now.', email: result.email });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    if (req.authToken) {
      await revokeSession(req.authToken);
    }
    res.json({ success: true, message: 'Signed out successfully.' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Sign out failed.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
    const activeMembership = memberships.find((m) => m.organizationId === req.user.orgId) || memberships[0];
    const org = activeMembership?.organization
      || await prisma.organization.findUnique({ where: { id: req.user.orgId } });
    let projects = await prisma.project.findMany({
      where: { organizationId: req.user.orgId },
      orderBy: { createdAt: 'asc' },
    });
    let active = projects.find((p) => p.isActive) || projects[0] || null;
    if (!active) {
      active = await ensureDefaultProject(req.user.orgId);
      projects = [active];
    }
    const allProjects = memberships.length
      ? await prisma.project.findMany({
        where: { organizationId: { in: memberships.map((m) => m.organizationId) } },
        orderBy: { createdAt: 'asc' },
      })
      : projects;
    res.json({
      user: { id: user.id, email: user.email, name: user.name, isAdmin: isAdminEmail(user.email) },
      organization: org,
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        plan: m.organization.plan,
        role: m.role,
        isActive: m.organizationId === req.user.orgId,
      })),
      projects,
      allProjects,
      project: { id: active.id, name: active.name },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;