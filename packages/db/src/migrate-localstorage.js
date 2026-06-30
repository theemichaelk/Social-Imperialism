/**
 * One-time / repeatable import: desktop node-localstorage dir → Prisma ProjectSetting + entities.
 *
 * Usage:
 *   npm run db:migrate-storage
 *   npm run db:migrate-storage -- --dir "C:\Users\...\Social Imperialism\storage"
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../../apps/api/.env') });
const fs = require('fs');
const path = require('path');
const { prisma } = require('./index');
const { persistEntitiesFromStore } = require('../../core/src/persistEntities');
const { ORG_KEYS } = require('../../core/src/prismaStore');

function parseArgs() {
  const args = process.argv.slice(2);
  let dir = null;
  let orgSlug = process.env.SEED_ORG_SLUG || 'social-imperialism';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) dir = args[++i];
    if (args[i] === '--org' && args[i + 1]) orgSlug = args[++i];
  }
  return { dir, orgSlug };
}

function defaultStorageDirs() {
  const appData = process.env.APPDATA || process.env.HOME || '';
  return [
    path.join(appData, 'Social Imperialism', 'storage'),
    path.join(__dirname, '../../../apps/desktop/storage'),
  ].filter((d) => d && fs.existsSync(d));
}

function readLocalStorageDir(storageDir) {
  const keys = {};
  const files = fs.readdirSync(storageDir);
  for (const file of files) {
    const full = path.join(storageDir, file);
    if (!fs.statSync(full).isFile()) continue;
    try {
      const key = decodeURIComponent(file);
      keys[key] = fs.readFileSync(full, 'utf8');
    } catch {
      keys[file] = fs.readFileSync(full, 'utf8');
    }
  }
  return keys;
}

function makeStoreFromKeys(keys) {
  const cache = new Map(Object.entries(keys));
  return {
    getItem(key) { return cache.has(key) ? cache.get(key) : null; },
    setItem(key, value) { cache.set(key, String(value)); },
    _cache: cache,
  };
}

async function main() {
  const { dir, orgSlug } = parseArgs();
  const candidates = dir ? [dir] : defaultStorageDirs();

  if (!candidates.length) {
    console.error('No localStorage directory found. Pass --dir <path> to import.');
    process.exit(1);
  }

  const storageDir = candidates[0];
  console.log('Importing from:', storageDir);

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    console.error(`Organization not found: ${orgSlug}. Run npm run db:seed first.`);
    process.exit(1);
  }

  const project = await prisma.project.findFirst({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'asc' },
  });
  if (!project) {
    console.error('No project found. Run npm run db:seed first.');
    process.exit(1);
  }

  const keys = readLocalStorageDir(storageDir);
  const keyNames = Object.keys(keys);
  console.log(`Found ${keyNames.length} localStorage keys`);

  let projectCount = 0;
  let orgCount = 0;

  for (const [key, value] of Object.entries(keys)) {
    const isOrg = ORG_KEYS.has(key) || key.startsWith('org_');
    if (isOrg) {
      await prisma.orgSetting.upsert({
        where: { organizationId_key: { organizationId: org.id, key } },
        update: { value },
        create: { organizationId: org.id, key, value },
      });
      orgCount++;
    } else {
      await prisma.projectSetting.upsert({
        where: { projectId_key: { projectId: project.id, key } },
        update: { value },
        create: { projectId: project.id, key, value },
      });
      projectCount++;
    }
  }

  const store = makeStoreFromKeys(keys);
  const activeId = store.getItem('activeCampaignId') || project.id;
  const targetProject = activeId === project.id
    ? project
    : await prisma.project.findUnique({ where: { id: activeId } }) || project;

  await persistEntitiesFromStore(store, targetProject.id);

  console.log('Migration complete:', {
    projectId: targetProject.id,
    orgSlug,
    projectSettings: projectCount,
    orgSettings: orgCount,
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());