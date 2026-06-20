require('dotenv').config({ path: require('path').join(__dirname, '../../../apps/api/.env') });
const bcrypt = require('bcryptjs');
const { prisma } = require('./index');

async function main() {
  const email = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
  const password = process.env.SEED_PASSWORD || 'Kingme05$';
  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: hash, name: 'Michael Kaswatuka' },
    create: { email, passwordHash: hash, name: 'Michael Kaswatuka' },
  });

  const org = await prisma.organization.upsert({
    where: { slug: 'acme-growth' },
    update: {},
    create: { name: 'Acme Growth Labs', slug: 'acme-growth', plan: 'growth' },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    update: { role: 'owner' },
    create: { organizationId: org.id, userId: user.id, role: 'owner' },
  });

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
  }

  console.log('Seeded:', { email, password, org: org.slug, projectId: project.id });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());