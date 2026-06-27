require('dotenv').config({ path: require('path').join(__dirname, '../../../apps/api/.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../../../apps/desktop/.env') });
const bcrypt = require('bcryptjs');
const { prisma } = require('./index');
const { resolveKeys } = require('../../../apps/desktop/services/keys');
const { stripDemoSeedData } = require('../../core/src/projectDefaults');

async function upsertProjectSetting(projectId, key, value) {
  await prisma.projectSetting.upsert({
    where: { projectId_key: { projectId, key } },
    update: { value },
    create: { projectId, key, value },
  });
}

const ADMIN_EMAILS = [
  process.env.SEED_EMAIL || 'theesaintmichael@gmail.com',
  'michaelk@tsbrenterprises.com',
];

async function main() {
  const password = process.env.SEED_PASSWORD || 'Kingme05$';
  const hash = await bcrypt.hash(password, 10);
  const orgName = process.env.SEED_ORG_NAME || 'Social Imperialism';
  const orgSlug = process.env.SEED_ORG_SLUG || 'social-imperialism';

  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: {},
    create: { name: orgName, slug: orgSlug, plan: 'growth' },
  });

  let primaryUser = null;
  for (const email of [...new Set(ADMIN_EMAILS)]) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash: hash, name: 'Michael Kaswatuka' },
      create: { email, passwordHash: hash, name: 'Michael Kaswatuka' },
    });
    if (!primaryUser) primaryUser = user;

    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      update: { role: 'owner' },
      create: { organizationId: org.id, userId: user.id, role: 'owner' },
    });
  }

  let project = await prisma.project.findFirst({ where: { organizationId: org.id } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        organizationId: org.id,
        name: 'Default Campaign',
        brandName: orgName,
        domain: '',
        description: '',
        tone: 'Professional',
        isActive: true,
      },
    });
  }

  const minimalDefaults = {
    [`linkedAccounts_${project.id}`]: '[]',
    keywords: '[]',
    engagementLists: '[]',
    watchedMonitors: '[]',
    aiRepliesHistory: '[]',
    leads: '[]',
    scheduled_posts: '[]',
    onboardingComplete: 'false',
    workerRunningFlag: 'false',
  };

  for (const [key, value] of Object.entries(minimalDefaults)) {
    const existing = await prisma.projectSetting.findUnique({
      where: { projectId_key: { projectId: project.id, key } },
    });
    if (!existing) await upsertProjectSetting(project.id, key, value);
  }

  const globalApiKeys = resolveKeys({});
  await prisma.orgSetting.upsert({
    where: { organizationId_key: { organizationId: org.id, key: 'globalApiKeys' } },
    update: { value: JSON.stringify(globalApiKeys) },
    create: { organizationId: org.id, key: 'globalApiKeys', value: JSON.stringify(globalApiKeys) },
  });

  await prisma.socialAccount.deleteMany({
    where: {
      projectId: project.id,
      OR: [
        { handle: { in: ['Acme Growth Labs', '@acmegrowth', 'u/acmegrowth'] } },
        { id: { startsWith: 'si_li_' } },
        { id: { startsWith: 'si_tw_' } },
        { id: { startsWith: 'si_rd_' } },
      ],
    },
  });

  await prisma.scheduledPost.deleteMany({
    where: { projectId: project.id, content: { contains: 'Acme Growth Labs tip' } },
  });

  const store = {
    getItem: (key) => minimalDefaults[key] || null,
    setItem: (key, value) => { minimalDefaults[key] = value; },
  };
  stripDemoSeedData(store, project.id);
  for (const [key, value] of Object.entries(minimalDefaults)) {
    await upsertProjectSetting(project.id, key, value);
  }

  console.log('Seeded (no demo data):', { admins: [...new Set(ADMIN_EMAILS)], org: org.slug, projectId: project.id });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());