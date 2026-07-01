#!/usr/bin/env node
/**
 * End-to-end YouTube OAuth loopback test (no password stored on disk).
 * Usage: set YT_TEST_EMAIL and YT_TEST_PASSWORD in env, then run with electron or nodriver.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');
const { LocalStorage } = require('node-localstorage');
const integrations = require('../services');
const { connectPlatform, validateConnectInput } = require('../services/connectionService');
const oauth = require('../services/oauth');

const email = process.env.YT_TEST_EMAIL || 'theesaintmichael@gmail.com';
const password = process.env.YT_TEST_PASSWORD;

async function testLoopbackRoundTrip() {
  await oauth.ensureOAuthLoopbackServer();
  const keys = integrations.resolveKeys({});
  const pkce = oauth.generatePkce();
  const state = oauth.generateState('YouTube');
  const redirectUri = oauth.GOOGLE_LOOPBACK_REDIRECT_URI;

  const exchangePromise = oauth.waitForOAuthCallback(state);
  const fakeCode = 'mock_code_for_loopback_test';
  const callbackUrl = `${redirectUri}?code=${fakeCode}&state=${state}`;

  setTimeout(() => {
    oauth.handleOAuthCallback(callbackUrl);
  }, 100);

  try {
    await exchangePromise;
    console.log('loopback callback: OK (state matched)');
  } catch (e) {
    console.log('loopback callback: FAIL', e.message);
    return false;
  }

  try {
    await oauth.exchangeToken('YouTube', fakeCode, keys, pkce.verifier, redirectUri);
    console.log('token exchange: unexpected success');
  } catch (e) {
    const msg = e.response?.data?.error || e.message;
    if (msg === 'invalid_grant' || msg === 'invalid_code') {
      console.log('token exchange: OK (client accepts redirect, code invalid as expected)');
      return true;
    }
    console.log('token exchange: FAIL', JSON.stringify(e.response?.data || e.message));
    return false;
  }
  return true;
}

async function testConnectRouting() {
  const keys = integrations.resolveKeys({});
  const v = validateConnectInput('YouTube', { email, password: password || 'x', method: 'credentials' }, keys);
  console.log('connect validation:', v.ok ? 'OK' : v.error);
  if (!password) {
    console.log('(skipped live connect — set YT_TEST_PASSWORD to run OAuth browser test)');
    return true;
  }
  if (!v.ok) return false;

  const storePath = path.join(__dirname, '..', '.oauth-live-test');
  if (fs.existsSync(storePath)) fs.rmSync(storePath, { recursive: true, force: true });
  const store = new LocalStorage(storePath);
  store.setItem('activeCampaignId', 'default');

  console.log('Starting live Google OAuth — complete sign-in in the browser window...');
  const res = await connectPlatform({
    platform: 'YouTube',
    email,
    password,
    method: 'credentials',
    keys,
    openExternal: async (url) => {
      const { exec } = require('child_process');
      console.log('Opening system browser for Google sign-in...');
      exec(`start "" "${url}"`);
    },
    store,
    integrations,
  });

  console.log('connect result:', res.success ? `linked ${res.linked}` : res.error);
  if (res.discovered?.length) {
    res.discovered.forEach((d) => console.log(' -', d.handle, d.type));
  }
  return res.success;
}

(async () => {
  console.log('=== YouTube OAuth diagnostics ===\n');
  const loopbackOk = await testLoopbackRoundTrip();
  console.log('');
  const connectOk = await testConnectRouting();
  process.exit(loopbackOk && connectOk ? 0 : 1);
})().catch((e) => {
  console.error('diagnostic crashed:', e);
  process.exit(1);
});