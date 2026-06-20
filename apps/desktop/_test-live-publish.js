/**
 * Live publish smoke test — seeds LinkedIn from .env token and attempts publish-post.
 * Usage: node _test-live-publish.js [--dry-run]
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { LocalStorage } = require('node-localstorage');
const { resolveKeys } = require('./services/keys');
const linkedin = require('./services/platforms/linkedin');
const { linkAllDiscoveredAccounts, getLinkedAccounts } = require('./services/accountAutomation');
const { publishPost } = require('./services/publisher');
const integrations = require('./services');

const dryRun = process.argv.includes('--dry-run');
const dataPath = path.join(__dirname, '.test-live-publish-store');
if (fs.existsSync(dataPath)) fs.rmSync(dataPath, { recursive: true, force: true });
fs.mkdirSync(dataPath, { recursive: true });
const store = new LocalStorage(path.join(dataPath, 'storage'));
store.setItem('activeCampaignId', 'default');
store.setItem('campaigns', JSON.stringify([{ id: 'default', brandName: 'Acme Growth Labs', domain: 'acmegrowth.com' }]));

const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
store.setItem('globalApiKeys', JSON.stringify(keys));
const activeId = 'default';

async function main() {
  console.log('\n=== LIVE PUBLISH SMOKE TEST ===\n');
  console.log('LinkedIn token:', keys.linkedinAccessToken ? 'present' : 'missing');
  console.log('Meta token:', keys.metaAccess ? 'present' : 'missing');
  console.log('Twitter token:', keys.twitterAccessToken ? 'present' : 'missing');

  if (!keys.linkedinAccessToken) {
    console.log('✗ No LinkedIn access token in .env — connect via Account Hub OAuth first.');
    process.exit(1);
  }

  const discovered = await linkedin.discoverAccounts(keys, 'oauth@social-imperialism.local', keys.linkedinAccessToken);

  if (!discovered?.length) {
    console.log('✗ LinkedIn discoverAccounts returned no accounts');
    process.exit(1);
  }

  const tokenB64 = Buffer.from(JSON.stringify({ access_token: keys.linkedinAccessToken })).toString('base64');
  const withTokens = discovered.map((a) => ({ ...a, encryptedTokens: tokenB64 }));

  const { linked } = await linkAllDiscoveredAccounts({
    store,
    integrations,
    keys,
    discovered: withTokens,
    meta: { loginEmail: 'oauth@social-imperialism.local', connectionId: 'conn_live_test', sharedTokens: tokenB64 },
  });

  store.setItem(`linkedAccounts_${activeId}`, JSON.stringify(linked));
  console.log(`✓ Linked ${linked.length} account(s):`, linked.map((a) => `${a.platform}/${a.handle}`).join(', '));

  const account = linked.find((a) => a.platform === 'LinkedIn') || linked[0];
  const postData = {
    platform: 'LinkedIn',
    accountId: account.id,
    content: `[SI Test ${new Date().toISOString().slice(0, 16)}] Social Imperialism live publish smoke test — safe to delete.`,
    humanLike: false,
  };

  if (dryRun) {
    console.log('~ Dry run — would publish:', postData.content.slice(0, 80));
    process.exit(0);
  }

  try {
    const result = await publishPost(postData, keys, getLinkedAccounts(store, activeId), { humanLike: false });
    console.log('✓ Live publish OK:', JSON.stringify(result).slice(0, 200));
    process.exit(0);
  } catch (e) {
    console.log('✗ Live publish failed:', e.response?.status || '', e.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});