const express = require('express');
const { prisma } = require('@si/db');
const { isAdminEmail } = require('../subscriptionAccess');

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

module.exports = router;