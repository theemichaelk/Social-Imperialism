require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.user.count()
  .then((c) => { console.log('DB OK — users:', c); })
  .catch((e) => { console.error('DB FAIL:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());