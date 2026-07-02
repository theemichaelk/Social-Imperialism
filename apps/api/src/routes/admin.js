const express = require('express');
const { prisma } = require('@si/db');
const {
  isAdminEmail,
  getOrgBilling,
  adminSetSubscriptionStatus,
  revokeAllUserSessions,
} = require('../subscriptionAccess');

const router = express.Router();

function requirePlatformAdmin(req, res, next) {
  if (!isAdminEmail(req.user?.email)) {
    return res.status(403).json({ error: 'Platform administrator access required.' });
  }
  next();
}

router.use(requirePlatformAdmin);

function parseBilling(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/** Full platform directory — users, orgs, projects (admin omni-access). */
router.get('/directory', async (req, res) => {
  try {
    const [users, orgCount, projectCount] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          memberships: {
            select: {
              role: true,
              createdAt: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  plan: true,
                  createdAt: true,
                  settings: { where: { key: 'billingPlan' }, select: { value: true } },
                  projects: {
                    select: {
                      id: true,
                      name: true,
                      brandName: true,
                      domain: true,
                      isActive: true,
                      createdAt: true,
                    },
                    orderBy: { createdAt: 'asc' },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.organization.count(),
      prisma.project.count(),
    ]);

    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true,
        members: {
          select: {
            role: true,
            user: { select: { id: true, email: true, name: true } },
          },
        },
        projects: {
          select: { id: true, name: true, brandName: true, domain: true, isActive: true },
        },
        settings: { where: { key: 'billingPlan' }, select: { value: true } },
      },
    });

    res.json({
      summary: {
        userCount: users.length,
        orgCount,
        projectCount,
        generatedAt: new Date().toISOString(),
      },
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        isAdmin: isAdminEmail(u.email),
        organizations: u.memberships.map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          plan: m.organization.plan,
          role: m.role,
          billing: parseBilling(m.organization.settings[0]?.value),
          projects: m.organization.projects,
          memberSince: m.createdAt,
          orgCreatedAt: m.organization.createdAt,
        })),
      })),
      organizations: organizations.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        plan: o.plan,
        createdAt: o.createdAt,
        billing: parseBilling(o.settings[0]?.value),
        memberCount: o.members.length,
        members: o.members.map((m) => ({
          id: m.user.id,
          email: m.user.email,
          name: m.user.name,
          role: m.role,
          isAdmin: isAdminEmail(m.user.email),
        })),
        projects: o.projects,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Admin directory failed.' });
  }
});

/** Admin: suspend, revoke, or activate an organization's subscription. */
router.patch('/subscriptions/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params;
    const action = String(req.body?.action || '').toLowerCase();
    const reason = String(req.body?.reason || '').trim();
    const revokeSessions = req.body?.revokeSessions !== false;

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const result = await adminSetSubscriptionStatus(orgId, action, {
      reason,
      actorEmail: req.user?.email,
      revokeSessions,
    });

    res.json({
      success: true,
      orgId,
      action,
      status: result.billing.status,
      sessionsRevoked: result.sessionsRevoked,
      billing: {
        plan: result.billing.plan,
        planName: result.billing.planName,
        status: result.billing.status,
        billingEmail: result.billing.billingEmail,
      },
    });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Subscription update failed' });
  }
});

/** Admin: read subscription status for one org. */
router.get('/subscriptions/:orgId', async (req, res) => {
  try {
    const billing = await getOrgBilling(req.params.orgId);
    if (!billing || !Object.keys(billing).length) {
      return res.status(404).json({ error: 'Billing record not found' });
    }
    res.json({ orgId: req.params.orgId, billing });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Admin: revoke all sessions for a user (force sign-out). */
router.post('/users/:userId/revoke-sessions', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (isAdminEmail(user.email)) {
      return res.status(403).json({ error: 'Cannot revoke sessions for platform admin accounts' });
    }
    const count = await revokeAllUserSessions(user.id);
    res.json({ success: true, userId: user.id, sessionsRevoked: count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;