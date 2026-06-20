/**
 * Grok browser engine — session-based (no API). Uses Puppeteer with persistent profile.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  puppeteer = null;
}

const STORAGE_KEY = 'grokEngineSettings';
const SIGN_IN_URL = 'https://accounts.x.ai/sign-in?redirect=grok-com&return_to=%2F%3Fq%3D%26reasoningMode%3Dnone%26voice%3Dfalse';
const GROK_HOME = 'https://grok.com/';
const GROK_IMAGINE = 'https://grok.com/imagine';

let activeBrowser = null;
let activePage = null;
let sessionState = { loggedIn: false, lastCheck: null, lastError: null };

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getSettings(store) {
  try {
    const raw = store.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return {
      enabled: saved.enabled !== false,
      email: saved.email || '',
      password: saved.password || '',
      autoLogin: saved.autoLogin !== false,
      headlessAfterLogin: saved.headlessAfterLogin === true,
      lastLoginAt: saved.lastLoginAt || null,
      sessionValid: saved.sessionValid === true,
    };
  } catch (e) {
    return { enabled: true, email: '', password: '', autoLogin: true, headlessAfterLogin: false };
  }
}

function saveSettings(store, partial) {
  const merged = { ...getSettings(store), ...partial, updatedAt: new Date().toISOString() };
  store.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

function getProfileDir(userDataPath) {
  const dir = path.join(userDataPath, 'grok-browser-profile');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getAssetsDir(userDataPath) {
  const dir = path.join(userDataPath, 'grok-assets');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function launchGrokBrowser(userDataPath, { headless = false } = {}) {
  if (!puppeteer) {
    throw new Error('Puppeteer is not installed. Run: npm install puppeteer');
  }

  if (activeBrowser?.isConnected?.()) {
    return { browser: activeBrowser, page: activePage };
  }

  const profileDir = getProfileDir(userDataPath);
  activeBrowser = await puppeteer.launch({
    headless,
    userDataDir: profileDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1400,900',
    ],
    defaultViewport: { width: 1400, height: 900 },
  });

  const pages = await activeBrowser.pages();
  activePage = pages[0] || (await activeBrowser.newPage());
  await activePage.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );

  return { browser: activeBrowser, page: activePage };
}

async function tryFillInput(page, selectors, value) {
  if (!value) return false;
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click({ clickCount: 3 });
        await el.type(String(value), { delay: 25 });
        return true;
      }
    } catch (e) { /* next */ }
  }
  return false;
}

async function clickByText(page, patterns) {
  return page.evaluate((pats) => {
    const nodes = [...document.querySelectorAll('button, a, [role="button"], span')];
    for (const node of nodes) {
      const text = (node.textContent || node.getAttribute('aria-label') || '').trim();
      if (!text) continue;
      for (const pat of pats) {
        if (new RegExp(pat, 'i').test(text)) {
          node.click();
          return true;
        }
      }
    }
    return false;
  }, patterns);
}

async function isLoggedIn(page) {
  const url = page.url();
  if (url.includes('accounts.x.ai/sign-in') || url.includes('/login')) return false;

  return page.evaluate(() => {
    const body = document.body?.innerText || '';
    if (/sign in|log in|create account/i.test(body) && !/new chat/i.test(body)) {
      const hasComposer = !!document.querySelector('textarea, [contenteditable="true"], input[type="text"]');
      if (!hasComposer) return false;
    }
    const markers = [/new chat/i, /imagine/i, /grok/i, /ask grok/i];
    return markers.some((re) => re.test(body)) || !!document.querySelector('textarea, [contenteditable="true"]');
  });
}

async function loginToGrok(store, userDataPath, { visible = true, waitForManual = true } = {}) {
  const settings = getSettings(store);
  const { page } = await launchGrokBrowser(userDataPath, { headless: false });

  await page.goto(SIGN_IN_URL, { waitUntil: 'networkidle2', timeout: 120000 });
  await delay(2000);

  if (await isLoggedIn(page)) {
    sessionState = { loggedIn: true, lastCheck: new Date().toISOString(), lastError: null };
    saveSettings(store, { sessionValid: true, lastLoginAt: new Date().toISOString() });
    return { success: true, message: 'Grok session already active.', loggedIn: true };
  }

  if (settings.autoLogin && settings.email) {
    await tryFillInput(page, [
      'input[type="email"]',
      'input[name="email"]',
      'input[autocomplete="email"]',
      'input[placeholder*="email" i]',
    ], settings.email);
    await delay(500);

    if (settings.password) {
      await tryFillInput(page, [
        'input[type="password"]',
        'input[name="password"]',
        'input[autocomplete="current-password"]',
      ], settings.password);
      await delay(500);
      await clickByText(page, ['^sign in$', '^log in$', '^continue$', '^next$']);
      await delay(4000);
    }
  }

  if (waitForManual && visible) {
    for (let i = 0; i < 90; i += 1) {
      if (await isLoggedIn(page)) break;
      await delay(2000);
    }
  }

  const loggedIn = await isLoggedIn(page);
  sessionState = {
    loggedIn,
    lastCheck: new Date().toISOString(),
    lastError: loggedIn ? null : 'Complete sign-in in the Grok browser window (CAPTCHA/2FA if prompted).',
  };

  if (loggedIn) {
    saveSettings(store, { sessionValid: true, lastLoginAt: new Date().toISOString() });
    return { success: true, message: 'Grok authorized — session saved in browser profile.', loggedIn: true };
  }

  return {
    success: false,
    loggedIn: false,
    error: sessionState.lastError,
    message: 'Sign-in not detected yet. Complete login in the opened browser, then click Connect again.',
  };
}

async function ensureSession(store, userDataPath) {
  const settings = getSettings(store);
  const headless = settings.headlessAfterLogin;
  const { page } = await launchGrokBrowser(userDataPath, { headless });

  if (!page.url() || page.url() === 'about:blank') {
    await page.goto(GROK_HOME, { waitUntil: 'networkidle2', timeout: 120000 });
  }

  let loggedIn = await isLoggedIn(page);
  if (!loggedIn) {
    const loginResult = await loginToGrok(store, userDataPath, { visible: true, waitForManual: true });
    loggedIn = loginResult.loggedIn;
  }

  if (!loggedIn) {
    throw new Error('Grok is not logged in. Open Settings → Grok Engine and click Connect & Authorize.');
  }

  return page;
}

async function startNewChat(page) {
  await page.goto(GROK_HOME, { waitUntil: 'networkidle2', timeout: 120000 });
  await delay(1500);
  await clickByText(page, ['new chat', 'new conversation', '^\\+$']);
  await delay(1000);
}

async function clearComposer(page) {
  await page.evaluate(() => {
    const el = document.querySelector(
      'textarea:not([disabled]), [contenteditable="true"]:not([contenteditable="false"]), [role="textbox"]',
    );
    if (!el) return false;
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.value = '';
    } else {
      el.textContent = '';
      el.innerHTML = '';
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  });
  await delay(200);
}

async function submitPrompt(page, prompt) {
  await clearComposer(page);

  const typed = await tryFillInput(page, [
    'textarea:not([disabled])',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'input[type="text"]',
  ], prompt);

  if (!typed) {
    await page.evaluate((text) => {
      const el = document.querySelector('textarea, [contenteditable="true"], [role="textbox"]');
      if (!el) return false;
      el.focus();
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        el.value = text;
      } else {
        el.textContent = text;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }, prompt);
  }

  await delay(600);
  const sent = await clickByText(page, ['^send$', 'submit', 'ask grok', 'generate', '^go$']);
  if (!sent) {
    await page.keyboard.press('Enter');
  }
  await delay(800);
}

async function extractAssistantMessages(page, userPromptSnippet = '') {
  return page.evaluate((promptSnippet) => {
    const skipPatterns = [
      /^sign in/i, /^new chat/i, /^imagine/i, /^grok$/i, /^send$/i,
      /^ask grok/i, /^type a message/i, /^STRICT INSTRUCTIONS/i,
      /^BRAND PROFILE/i, /^TRACKED KEYWORDS/i, /^USER CONTENT/i,
    ];
    const isNoise = (t) => {
      if (!t || t.length < 8) return true;
      if (promptSnippet && t.includes(promptSnippet.slice(0, 60))) return true;
      return skipPatterns.some((re) => re.test(t.trim()));
    };

    const selectors = [
      '[data-testid*="assistant"]',
      '[data-role="assistant"]',
      '[class*="assistant"]',
      '[class*="response"]',
      '[data-testid*="message"]',
      '[class*="message"]',
      'article',
      '.markdown',
      '.prose',
    ];

    const blocks = [];
    const seen = new Set();
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        const t = (el.innerText || '').trim();
        if (isNoise(t) || seen.has(t)) return;
        seen.add(t);
        blocks.push(t);
      });
    });

    if (blocks.length >= 2) {
      return blocks[blocks.length - 1];
    }
    if (blocks.length === 1) return blocks[0];

    const body = document.body?.innerText || '';
    const lines = body.split('\n').map((l) => l.trim()).filter((l) => !isNoise(l) && l.length > 15);
    return lines.slice(-6).join('\n');
  }, userPromptSnippet.slice(0, 200));
}

async function waitForAssistantReply(page, timeoutMs = 120000, userPrompt = '') {
  const start = Date.now();
  let lastText = '';
  let stableCount = 0;

  while (Date.now() - start < timeoutMs) {
    const text = await extractAssistantMessages(page, userPrompt);

    if (text && text.length > 15) {
      if (text === lastText) {
        stableCount += 1;
        if (stableCount >= 2) return text;
      } else {
        lastText = text;
        stableCount = 0;
      }
    }
    await delay(2000);
  }

  if (lastText) return lastText;
  throw new Error('Timed out waiting for Grok text response. Check the Grok browser window.');
}

async function askGrokText(store, userDataPath, prompt, { newChat = true, meta = {} } = {}) {
  if (!prompt?.trim()) throw new Error('Prompt is required.');
  const page = await ensureSession(store, userDataPath);
  if (newChat) await startNewChat(page);
  const submitted = prompt.trim();
  await submitPrompt(page, submitted);
  let text = await waitForAssistantReply(page, 120000, submitted);
  try {
    const { stripPromptEcho } = require('./grokPromptBuilder');
    text = stripPromptEcho(text, submitted);
  } catch (e) { /* optional */ }
  return {
    success: true,
    text,
    source: 'grok-browser',
    primaryKeyword: meta.primaryKeyword || null,
    matchedKeywords: meta.matchedKeywords || [],
    taskType: meta.taskType || null,
  };
}

async function downloadAsset(url, destPath) {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Invalid data URL');
    fs.writeFileSync(destPath, Buffer.from(match[2], 'base64'));
    return destPath;
  }
  if (fs.existsSync(url)) {
    fs.copyFileSync(url, destPath);
    return destPath;
  }
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 90000 });
  fs.writeFileSync(destPath, Buffer.from(res.data));
  return destPath;
}

async function collectImagineAssets(page, userDataPath, prefix = 'grok_img') {
  const assetsDir = getAssetsDir(userDataPath);
  const found = await page.evaluate(() => {
    const urls = new Set();
    document.querySelectorAll('img, video, source').forEach((el) => {
      const src = el.src || el.getAttribute('src') || '';
      if (src && !src.includes('avatar') && !src.includes('logo') && src.length > 20) urls.add(src);
    });
    return [...urls];
  });

  const saved = [];
  for (let i = 0; i < found.length; i += 1) {
    const url = found[i];
    const ext = url.includes('.mp4') || url.includes('video') ? '.mp4' : '.png';
    const dest = path.join(assetsDir, `${prefix}_${Date.now()}_${i}${ext}`);
    try {
      await downloadAsset(url, dest);
      saved.push({ path: dest, url: `file://${dest.replace(/\\/g, '/')}`, type: ext === '.mp4' ? 'video' : 'image' });
    } catch (e) { /* skip failed */ }
  }
  return saved;
}

async function generateGrokImagine(store, userDataPath, prompt) {
  if (!prompt?.trim()) throw new Error('Imagine prompt is required.');
  const page = await ensureSession(store, userDataPath);

  await page.goto(GROK_IMAGINE, { waitUntil: 'networkidle2', timeout: 120000 });
  await delay(2000);

  if (page.url().includes('sign-in')) {
    throw new Error('Grok Imagine requires login. Connect Grok in Settings first.');
  }

  await submitPrompt(page, prompt.trim());

  const start = Date.now();
  let assets = [];
  while (Date.now() - start < 180000) {
    assets = await collectImagineAssets(page, userDataPath, 'grok_imagine');
    if (assets.length) break;
    await delay(3000);
  }

  if (!assets.length) {
    return {
      success: false,
      error: 'No image/video detected from Grok Imagine. Complete generation in the browser window if needed.',
      browserOpen: true,
    };
  }

  return { success: true, assets, primaryAsset: assets[0], source: 'grok-imagine' };
}

async function getStatus(store, userDataPath) {
  const settings = getSettings(store);
  let profileReady = false;
  let profileDir = null;
  if (userDataPath) {
    try {
      profileDir = getProfileDir(userDataPath);
      profileReady = fs.existsSync(profileDir) && fs.readdirSync(profileDir).length > 0;
    } catch (e) { /* ignore */ }
  }
  const hasCredentials = !!(settings.email || settings.password);
  const sessionValid = settings.sessionValid || sessionState.loggedIn || profileReady;
  return {
    puppeteerReady: !!puppeteer,
    settings: {
      enabled: settings.enabled,
      email: settings.email ? `${settings.email.slice(0, 3)}***` : '',
      autoLogin: settings.autoLogin,
      sessionValid,
      hasCredentials,
      lastLoginAt: settings.lastLoginAt,
    },
    session: sessionState,
    profileReady,
    profileDir,
  };
}

async function closeGrokBrowser() {
  if (activeBrowser) {
    try { await activeBrowser.close(); } catch (e) { /* ignore */ }
  }
  activeBrowser = null;
  activePage = null;
  sessionState.loggedIn = false;
}

module.exports = {
  getSettings,
  saveSettings,
  getAssetsDir,
  launchGrokBrowser,
  loginToGrok,
  ensureSession,
  askGrokText,
  generateGrokImagine,
  getStatus,
  closeGrokBrowser,
  SIGN_IN_URL,
  GROK_HOME,
  GROK_IMAGINE,
};