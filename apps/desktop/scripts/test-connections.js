#!/usr/bin/env node
/**
 * Test every platform connect path (mock OAuth + live API where possible).
 * Run: node scripts/test-connections.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');
const { LocalStorage } = require('node-localstorage');

const integrations = require('../services');
const { connectPlatform, testKeyResolution, validateConnectInput } = require('../services/connectionService');
const { discoverAccounts } = require('../services/accountDiscovery');
const { canConnectPlatform } = require('../services/accountHub');
const oauth = require('../services/oauth');

const MOCK_TOKEN = 'a'.repeat(80);
const MOCK_OAUTH_TOKENS = {
  access_token: MOCK_TOKEN,
  refresh_token: 'mock_refresh',
  expires_in: 3600,
};

const PLATFORMS = [
  'Twitter', 'LinkedIn', 'Facebook', 'Instagram', 'YouTube', 'Reddit',
  'TikTok', 'Pinterest', 'Snapchat', 'Discord', 'Threads', 'Twitch',
  'Telegram', 'WhatsApp', 'Telegram', 'WhatsApp',
];

const testStorePath = path.join(__dirname, '..', '.test-storage');
if (fs.existsSync(testStorePath)) fs.rmSync(testStorePath, { recursive: true, force: true });
const store = new LocalStorage(testStorePath);
store.setItem('activeCampaignId', 'test');

const mockKeys = {
  twId: 'tw_id', twSecret: 'tw_secret',
  liId: 'li_id', liSecret: 'li_secret',
  fbId: 'fb_id', fbSecret: 'fb_secret', metaAccess: MOCK_TOKEN,
  ytId: 'yt_id', ytSecret: 'yt_secret', youtubeApiKey: process.env.YOUTUBE_API_KEY || 'yt_api',
  rdId: 'rd_id', rdSecret: 'rd_secret',
  tkId: 'tk_id', tkSecret: 'tk_secret',
  pnId: 'pn_id', pnSecret: 'pn_secret',
  scId: 'sc_id', scSecret: 'sc_secret',
  twitchId: 'tw_id', twitchSecret: 'tw_secret',
  dcId: 'dc_id', dcSecret: 'dc_secret', discordBotToken: 'dc_bot',
  tgBotToken: '123456789:AAHfake_token_for_test',
  waPhoneId: '1234567890',
  waAccessToken: MOCK_TOKEN,
};

store.setItem('globalApiKeys', JSON.stringify(mockKeys));

let originalStartOAuth;
let oauthMockEnabled = false;

function enableOAuthMock() {
  if (oauthMockEnabled) return;
  originalStartOAuth = oauth.startOAuthFlow;
  oauth.startOAuthFlow = async (platform, keys, openExternal) => {
    if (openExternal) await openExternal(`mock://oauth/${platform}`);
    return { tokens: { ...MOCK_OAUTH_TOKENS }, platform, state: 'mock' };
  };
  oauthMockEnabled = true;
}

function disableOAuthMock() {
  if (originalStartOAuth) oauth.startOAuthFlow = originalStartOAuth;
  oauthMockEnabled = false;
}

const results = [];

function log(icon, platform, msg, detail) {
  const line = `${icon} ${platform.padEnd(12)} ${msg}`;
  console.log(line);
  if (detail) console.log('   ', detail);
  const skipped = icon === '○';
  results.push({ platform, ok: icon === '✓', skipped, msg, detail });
}

async function testValidation() {
  console.log('\n=== Input validation ===\n');
  const v1 = validateConnectInput('Telegram', { password: '123:ABC', method: 'credentials' });
  log(v1.ok ? '✓' : '✗', 'Telegram', `validation ${v1.ok ? 'ok' : v1.error}`);

  const v2 = validateConnectInput('WhatsApp', { email: '123', password: 'tok', method: 'credentials' });
  log(v2.ok ? '✓' : '✗', 'WhatsApp', `validation ${v2.ok ? 'ok' : v2.error}`);

  const v3 = validateConnectInput('TikTok', { email: 'a@b.com', method: 'oauth' });
  log(v3.ok ? '✓' : '✗', 'TikTok', `oauth validation ${v3.ok ? 'ok' : v3.error}`);
}

async function testKeyAliases() {
  console.log('\n=== Key resolution (Settings field names) ===\n');
  const { checks } = testKeyResolution(mockKeys);
  Object.entries(checks).forEach(([p, ok]) => log(ok ? '✓' : '✗', p, ok ? 'keys resolve' : 'keys MISSING'));
}

async function testCanConnect() {
  console.log('\n=== canConnectPlatform ===\n');
  const keys = integrations.resolveKeys(mockKeys);
  const platforms = ['Twitter', 'LinkedIn', 'Facebook', 'Instagram', 'YouTube', 'Reddit',
    'TikTok', 'Pinterest', 'Snapchat', 'Discord', 'Telegram', 'WhatsApp', 'Threads', 'Twitch'];
  for (const p of platforms) {
    const c = canConnectPlatform(p, keys);
    log(c.ok ? '✓' : '✗', p, c.ok ? `ok (${c.method})` : c.error);
  }
}

async function testDiscoverMockOAuth(platform) {
  enableOAuthMock();
  const keys = integrations.resolveKeys(mockKeys);
  try {
    const ytUser = platform === 'YouTube' ? 'GoogleDevelopers' : 'test@example.com';
    const accounts = await discoverAccounts(
      { platform, email: 'test@example.com', username: ytUser, useCredentials: false },
      keys,
      async () => {}
    );
    const count = accounts?.length || 0;
    log(count > 0 ? '✓' : '✗', platform, `discover oauth → ${count} account(s)`, count ? accounts.map((a) => `${a.type}:${a.handle}`).join(', ') : 'empty');
    return count > 0;
  } catch (e) {
    log('✗', platform, `discover oauth FAILED: ${e.message}`);
    return false;
  }
}

async function testConnectMockOAuth(platform) {
  enableOAuthMock();
  const keys = integrations.resolveKeys(mockKeys);
  store.removeItem('linkedAccounts_test');
  try {
    const res = await connectPlatform({
      platform,
      email: 'oauth-test@example.com',
      username: platform === 'YouTube' ? 'GoogleDevelopers' : undefined,
      method: 'oauth',
      keys,
      openExternal: async () => {},
      store,
      integrations,
    });
    log(res.success ? '✓' : '✗', platform, res.success ? `connect+link → ${res.linked} linked` : res.error);
    return res.success;
  } catch (e) {
    log('✗', platform, `connect FAILED: ${e.message}`);
    return false;
  }
}

async function testTelegramConnect() {
  console.log('\n=== Telegram (token connect) ===\n');
  store.removeItem('linkedAccounts_test');
  const keys = integrations.resolveKeys(mockKeys);
  const res = await connectPlatform({
    platform: 'Telegram',
    password: mockKeys.tgBotToken,
    username: '@testchannel',
    method: 'credentials',
    keys,
    store,
    integrations,
  });
  if (!res.success && res.error?.includes('401')) {
    log('✓', 'Telegram', 'connect path works (API rejected fake token as expected)', res.error.slice(0, 60));
    return true;
  }
  log(res.success ? '✓' : '✗', 'Telegram', res.success ? `linked ${res.linked}` : res.error);
  return res.success || (res.error && !res.error.includes('not configured'));
}

async function testWhatsAppConnect() {
  console.log('\n=== WhatsApp (token connect) ===\n');
  store.removeItem('linkedAccounts_test');
  const keys = integrations.resolveKeys(mockKeys);
  const res = await connectPlatform({
    platform: 'WhatsApp',
    email: mockKeys.waPhoneId,
    password: MOCK_TOKEN,
    method: 'credentials',
    keys,
    store,
    integrations,
  });
  if (!res.success) {
    const pathOk = !res.error?.includes('not configured') && !res.error?.includes('required');
    log(pathOk ? '✓' : '✗', 'WhatsApp', pathOk ? `connect path ok (API: ${res.error?.slice(0, 50)})` : res.error);
    return pathOk;
  }
  log('✓', 'WhatsApp', `linked ${res.linked}`);
  return true;
}

async function testYouTubeApiKey() {
  console.log('\n=== YouTube (API key — no OAuth hang) ===\n');
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    log('○', 'YouTube-API', 'skipped (no YOUTUBE_API_KEY in .env)');
    return null;
  }
  store.removeItem('linkedAccounts_test');
  const keys = integrations.resolveKeys({});
  const start = Date.now();
  const res = await connectPlatform({
    platform: 'YouTube',
    email: 'channel-search@test.com',
    password: apiKey,
    username: 'Google Developers',
    method: 'credentials',
    keys,
    store,
    integrations,
    openExternal: async () => {},
  });
  const elapsed = Date.now() - start;
  const fast = elapsed < 15000;
  log(res.success && fast ? '✓' : '✗', 'YouTube-API', res.success ? `linked ${res.linked} in ${elapsed}ms` : res.error);
  if (!fast) log('✗', 'YouTube-API', `took ${elapsed}ms — should not wait for OAuth`);
  return res.success && fast;
}

async function testOAuthMisconfigFastFail() {
  console.log('\n=== OAuth misconfig fast-fail ===\n');
  store.removeItem('linkedAccounts_test');
  const keys = integrations.resolveKeys({ tkId: '', tkSecret: '' });
  const start = Date.now();
  let err = '';
  try {
    const res = await connectPlatform({
      platform: 'TikTok',
      email: 'user@example.com',
      password: 'not-a-real-password',
      method: 'credentials',
      keys,
      store,
      integrations,
      openExternal: async () => {},
    });
    if (!res.success) err = res.error;
  } catch (e) {
    err = e.message;
  }
  const elapsed = Date.now() - start;
  const fast = elapsed < 5000;
  const goodMsg = err && !err.includes('timed out');
  log(fast && goodMsg ? '✓' : '✗', 'TikTok-FailFast', fast ? `failed in ${elapsed}ms: ${err?.slice(0, 50)}` : `slow fail ${elapsed}ms`);
  return fast && goodMsg;
}

async function testLiveTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    log('○', 'Telegram-LIVE', 'skipped (no TELEGRAM_BOT_TOKEN in .env)');
    return null;
  }
  store.removeItem('linkedAccounts_test');
  const res = await connectPlatform({
    platform: 'Telegram',
    password: token,
    email: 'live@telegram',
    method: 'credentials',
    keys: integrations.resolveKeys({}),
    store,
    integrations,
  });
  log(res.success ? '✓' : '✗', 'Telegram-LIVE', res.success ? `linked ${res.linked}: ${res.discovered?.map((d) => d.handle).join(', ')}` : res.error);
  return res.success;
}

async function main() {
  console.log('Social Imperialism — Connection Test Suite\n');

  await testKeyAliases();
  await testValidation();
  await testCanConnect();

  console.log('\n=== Discover + connect (mock OAuth) ===\n');
  const oauthPlatforms = ['Twitter', 'LinkedIn', 'Facebook', 'Instagram', 'YouTube', 'Reddit',
    'TikTok', 'Pinterest', 'Snapchat', 'Discord', 'Threads', 'Twitch'];

  let pass = 0;
  let fail = 0;
  for (const p of oauthPlatforms) {
    const d = await testDiscoverMockOAuth(p);
    const c = await testConnectMockOAuth(p);
    if (d && c) pass++; else fail++;
  }

  disableOAuthMock();

  const tg = await testTelegramConnect();
  const wa = await testWhatsAppConnect();
  if (tg) pass++; else fail++;
  if (wa) pass++; else fail++;

  const ytApi = await testYouTubeApiKey();
  if (ytApi === true) pass++; else if (ytApi === false) fail++;

  const fastFail = await testOAuthMisconfigFastFail();
  if (fastFail) pass++; else fail++;

  await testLiveTelegram();

  console.log('\n=== Summary ===');
  const failed = results.filter((r) => !r.ok && !r.skipped);
  console.log(`Checks: ${results.length}, Failed: ${failed.length}`);
  if (failed.length) {
    console.log('\nFailures:');
    failed.forEach((f) => console.log(`  - ${f.platform}: ${f.msg}`));
    process.exit(1);
  }
  console.log('\nAll connection paths passed.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Test suite crashed:', e);
  process.exit(1);
});