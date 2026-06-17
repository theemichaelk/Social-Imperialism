#!/usr/bin/env node
/**
 * Live Google/YouTube OAuth test using real credentials from env vars only.
 * YT_TEST_EMAIL + YT_TEST_PASSWORD — never written to disk.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { LocalStorage } = require('node-localstorage');
const integrations = require('../services');
const { connectPlatform } = require('../services/connectionService');
const oauth = require('../services/oauth');
const youtube = require('../services/platforms/youtube');

const email = process.env.YT_TEST_EMAIL || 'theesaintmichael@gmail.com';
const password = process.env.YT_TEST_PASSWORD;

async function puppeteerGoogleLogin(authUrl) {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 520, height: 800 },
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );

  console.log('Opening Google sign-in...');
  await page.goto(authUrl, { waitUntil: 'networkidle2', timeout: 120000 });

  const bodyText = await page.evaluate(() => document.body?.innerText || '');
  if (bodyText.includes('invalid_request') || bodyText.includes('Access blocked')) {
    console.log('GOOGLE BLOCKED:', bodyText.slice(0, 500));
    await browser.close();
    return { blocked: true, text: bodyText };
  }

  try {
    const emailSel = 'input[type="email"]';
    const hasEmail = await page.$(emailSel);
    if (hasEmail) {
      await page.type(emailSel, email, { delay: 30 });
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
    }

    const passSel = 'input[type="password"]';
    const hasPass = await page.$(passSel);
    if (hasPass) {
      await page.type(passSel, password, { delay: 30 });
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
    }

    // Account picker (many YouTube brand accounts) — click primary Google account row
    await new Promise((r) => setTimeout(r, 1500));
    await page.evaluate((em) => {
      const candidates = [...document.querySelectorAll('div, li, [role="link"], [data-identifier]')];
      const row = candidates.find((el) => {
        const t = (el.textContent || '').trim();
        return t.includes(em) && t.length < 120;
      });
      if (row) row.click();
    }, email);
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});

    // OAuth consent — Allow / Continue
    for (let i = 0; i < 5; i++) {
      if (page.url().includes('/oauth/callback')) break;
      const clicked = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button, input[type="submit"], [role="button"]')];
        const allow = buttons.find((b) => /allow|continue|confirm|accept/i.test(b.textContent || b.value || ''));
        if (allow) { allow.click(); return true; }
        return false;
      });
      if (clicked) await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      else break;
    }

    const callbackUrl = await page.waitForFunction(
      () => window.location.href.includes('/oauth/callback'),
      { timeout: 120000 },
    ).then(() => page.url()).catch(async () => {
      const t = await page.evaluate(() => document.body?.innerText || '');
      return { error: t.slice(0, 800) };
    });

    if (typeof callbackUrl === 'object' && callbackUrl.error) {
      console.log('Sign-in did not reach callback:', callbackUrl.error);
      await browser.close();
      return { blocked: true, text: callbackUrl.error };
    }

    console.log('Callback received:', callbackUrl.slice(0, 80) + '...');
    await browser.close();
    return { callbackUrl };
  } catch (e) {
    const shot = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
    console.log('Puppeteer login error:', e.message);
    if (shot) console.log('Page text:', shot.slice(0, 600));
    await browser.close();
    return { blocked: true, text: shot || e.message };
  }
}

async function main() {
  if (!password) {
    console.error('Set YT_TEST_PASSWORD env var to run live login test.');
    process.exit(1);
  }

  console.log('=== Live YouTube login test ===');
  console.log('Email:', email);

  await oauth.ensureOAuthLoopbackServer();
  const keys = integrations.resolveKeys({});
  const pkce = oauth.generatePkce();
  const state = oauth.generateState('YouTube');
  const redirectUri = oauth.GOOGLE_LOOPBACK_REDIRECT_URI;
  const authUrl = oauth.buildAuthUrl('YouTube', keys, state, pkce, redirectUri, { loginHint: email });

  const callbackPromise = oauth.waitForOAuthCallback(state);

  const loginPromise = puppeteerGoogleLogin(authUrl);
  let code;
  try {
    const result = await Promise.race([
      callbackPromise.then((r) => ({ source: 'loopback', code: r.code })),
      loginPromise.then((r) => (r.blocked ? { source: 'blocked', text: r.text } : { source: 'browser', callbackUrl: r.callbackUrl })),
    ]);
    if (result.source === 'blocked') {
      console.log('\nRESULT: Google sign-in blocked or failed.');
      console.log(result.text?.slice?.(0, 500) || result.text);
      process.exit(1);
    }
    if (result.source === 'loopback') {
      code = result.code;
    } else {
      oauth.handleOAuthCallback(result.callbackUrl);
      code = (await callbackPromise).code;
    }
  } catch (e) {
    console.log('OAuth wait failed:', e.message);
    process.exit(1);
  }
  const tokens = await oauth.exchangeToken('YouTube', code, keys, pkce.verifier, redirectUri);
  console.log('Token exchange: OK, has refresh_token:', !!tokens.refresh_token);

  const channels = await youtube.discoverChannels(tokens.access_token, null, null, email);
  console.log(`Channels found: ${channels.length}`);
  channels.forEach((ch) => console.log(` - ${ch.handle} [${ch.id}] subs:${ch.subscriberCount || '?'}`));

  process.exit(channels.length > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Live test crashed:', e.response?.data || e.message);
  process.exit(1);
});