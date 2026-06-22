require('dotenv').config({ path: require('path').join(__dirname, '../../../apps/api/.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../../../apps/desktop/.env') });
const bcrypt = require('bcryptjs');
const { prisma } = require('./index');
const { demoLinkedAccounts, demoKeywords } = require('../../core/src/projectDefaults');
const { resolveKeys } = require('../../../apps/desktop/services/keys');

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

  const org = await prisma.organization.upsert({
    where: { slug: 'acme-growth' },
    update: {},
    create: { name: 'Acme Growth Labs', slug: 'acme-growth', plan: 'growth' },
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

  const user = primaryUser;

  let project = await prisma.project.findFirst({ where: { organizationId: org.id } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        organizationId: org.id,
        name: 'Default Campaign',
        brandName: 'Acme Growth Labs',
        domain: 'acmegrowth.com',
        description: 'Social media marketing automation for B2B SaaS growth.',
        tone: 'Professional',
        isActive: true,
      },
    });
  } else {
    project = await prisma.project.update({
      where: { id: project.id },
      data: {
        brandName: 'Acme Growth Labs',
        domain: 'acmegrowth.com',
        description: 'Social media marketing automation for B2B SaaS growth.',
        tone: 'Professional',
        isActive: true,
      },
    });
  }

  const accounts = demoLinkedAccounts(project.id);
  for (const acc of accounts) {
    await prisma.socialAccount.upsert({
      where: { id: acc.id },
      update: {
        platform: acc.platform,
        handle: acc.handle,
        accountType: acc.type,
        metadata: JSON.stringify({ profile: acc.profile }),
        status: 'connected',
      },
      create: {
        id: acc.id,
        projectId: project.id,
        platform: acc.platform,
        handle: acc.handle,
        accountType: acc.type,
        metadata: JSON.stringify({ profile: acc.profile }),
        status: 'connected',
      },
    });
  }

  const keywords = demoKeywords(project.id);
  for (const kw of keywords) {
    const existing = await prisma.keyword.findFirst({
      where: { projectId: project.id, term: kw.term },
    });
    if (!existing) {
      await prisma.keyword.create({
        data: {
          projectId: project.id,
          term: kw.term,
          platformFlags: JSON.stringify(kw.platforms),
        },
      });
    }
  }

  const defaults = {
    [`linkedAccounts_${project.id}`]: JSON.stringify(accounts),
    keywords: JSON.stringify(keywords),
    engagementLists: JSON.stringify([
      { id: 'elist_demo_1', name: 'SaaS Founders', type: 'linkedin-profiles', profileUrls: [], autoEngage: false, campaignId: project.id },
    ]),
    watchedMonitors: JSON.stringify([
      { id: 'mon_1', label: 'Brand mentions', type: 'keyword', target: 'Acme Growth', platform: 'Twitter' },
    ]),
    autoRulesEngine: JSON.stringify({
      enabled: true, replyMode: 'smart', spamFilter: true, crisisMode: false,
      maxRepliesPerHour: 10, platforms: ['Twitter', 'LinkedIn', 'Reddit'],
      updatedAt: new Date().toISOString(),
    }),
    onboardingComplete: 'true',
    workerRunningFlag: 'false',
    quoraTrafficOps: JSON.stringify({
      [project.id]: {
        mode: 'manual',
        model: 'gemini',
        angles: [{ id: 'default', name: 'Default Brand Angle', brandPositioning: 'Acme Growth Labs' }],
        answers: [],
        publishedLog: [],
        cachedQuestions: [
          { title: 'What are the best social media automation tools?', url: 'https://www.quora.com/What-are-the-best-social-media-automation-tools', keyword: 'marketing', score: 85, views: 12000 },
          { title: 'How do I grow a B2B SaaS brand on LinkedIn?', url: 'https://www.quora.com/How-do-I-grow-a-B2B-SaaS-brand-on-LinkedIn', keyword: 'marketing', score: 78, views: 8500 },
        ],
        lastScrape: { keyword: 'marketing', at: new Date().toISOString(), count: 2 },
      },
    }),
  };

  for (const [key, value] of Object.entries(defaults)) {
    await upsertProjectSetting(project.id, key, value);
  }

  const globalApiKeys = resolveKeys({});
  await prisma.orgSetting.upsert({
    where: { organizationId_key: { organizationId: org.id, key: 'globalApiKeys' } },
    update: { value: JSON.stringify(globalApiKeys) },
    create: { organizationId: org.id, key: 'globalApiKeys', value: JSON.stringify(globalApiKeys) },
  });

  const schedExists = await prisma.scheduledPost.findFirst({ where: { projectId: project.id } });
  if (!schedExists) {
    await prisma.scheduledPost.create({
      data: {
        projectId: project.id,
        socialAccountId: accounts[0].id,
        platform: 'LinkedIn',
        accountId: accounts[0].id,
        content: '🚀 Acme Growth Labs tip: Batch content on Monday, schedule for the week.',
        scheduledFor: new Date(Date.now() + 3 * 86400000),
        status: 'scheduled',
      },
    });
  }

  console.log('Seeded:', { admins: [...new Set(ADMIN_EMAILS)], org: org.slug, projectId: project.id, accounts: accounts.length, keywords: keywords.length });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());