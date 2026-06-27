/**
 * Purge mock/demo/QA data from desktop local storage (Electron userData).
 * Usage: node scripts/purge-demo-storage.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const { stripDemoSeedData, isDemoLinkedAccount } = require('../../../packages/core/src/projectDefaults');

function storageDir() {
  if (process.env.SI_STORAGE_DIR) return process.env.SI_STORAGE_DIR;
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'Social Imperialism', 'storage');
}

function createStore(dir) {
  const cache = new Map();
  if (!fs.existsSync(dir)) return null;
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (!fs.statSync(full).isFile()) continue;
    try { cache.set(file, fs.readFileSync(full, 'utf8')); } catch { /* skip */ }
  }
  return {
    getItem(key) { return cache.has(key) ? cache.get(key) : null; },
    setItem(key, value) {
      const v = String(value);
      cache.set(key, v);
      fs.writeFileSync(path.join(dir, key), v, 'utf8');
    },
    removeItem(key) {
      cache.delete(key);
      const full = path.join(dir, key);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    },
    _cache: cache,
  };
}

function main() {
  const dir = storageDir();
  const store = createStore(dir);
  if (!store) {
    console.log('No desktop storage found at', dir);
    return;
  }

  let projectId = 'default';
  try {
    const campaigns = JSON.parse(store.getItem('campaigns') || '[]');
    const active = store.getItem('activeCampaignId') || 'default';
    projectId = campaigns.find((c) => c.id === active)?.id || active || 'default';
  } catch { /* default */ }

  console.log('Purging demo data in', dir, '(project:', projectId, ')');
  stripDemoSeedData(store, projectId);

  const legacyKey = `linkedAccounts_${projectId}`;
  const defaultKey = 'linkedAccounts_default';
  for (const key of [legacyKey, defaultKey, `linkedAccounts_default`]) {
    try {
      const list = JSON.parse(store.getItem(key) || '[]');
      if (!Array.isArray(list)) continue;
      const filtered = list.filter((a) => !isDemoLinkedAccount(a));
      if (filtered.length !== list.length) store.setItem(key, JSON.stringify(filtered));
    } catch { /* ignore */ }
  }

  console.log('Done. Restart the desktop app if it is open.');
}

main();