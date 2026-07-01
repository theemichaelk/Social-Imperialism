/**
 * Grok browser engine — session-based (no API). Uses native Chrome/Edge/Opera/Firefox with persistent cookies.
 */
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const nativeBrowser = require('./nativeBrowserLauncher');

function loadGrokDefaults() {
  try {
    const { coreRequire } = require('../coreRequire');
    return coreRequire('src/grokDefaults').GROK_DEFAULTS;
  } catch {
    try {
      return require(path.join(__dirname, '../../../packages/core/src/grokDefaults')).GROK_DEFAULTS;
    } catch {
      return {
        platform: 'grok',
        url: 'https://grok.com/',
        imagineUrl: 'https://grok.com/imagine',
        email: '',
        password: '',
        autoLogin: true,
        browserId: 'edge',
        launchMode: 'app_profile',
        profileKey: 'grok',
        assetsSubdir: 'grok-assets',
      };
    }
  }
}

const GROK_DEFAULTS = loadGrokDefaults();

const nodriverBridge = require('./nodriverBridge');

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

/** Seed brain/GROK.md defaults when no credentials saved yet */
function seedGrokDefaultsIfNeeded(store) {
  const s = getSettings(store);
  if (s.email) return s;
  return saveSettings(store, {
    email: GROK_DEFAULTS.email,
    password: GROK_DEFAULTS.password,
    autoLogin: GROK_DEFAULTS.autoLogin,
    enabled: true,
  });
}

function getProfileDir(userDataPath, store) {
  if (store) {
    return nativeBrowser.getProfileDir(userDataPath, nativeBrowser.getBrowserSettings(store), 'grok');
  }
  const dir = path.join(userDataPath, 'native-browser-profiles', 'edge', 'grok');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getAssetsDir(userDataPath) {
  const dir = path.join(userDataPath, 'grok-assets');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function launchGrokBrowser(userDataPath, store, { headless = false } = {}) {
  if (activeBrowser?.isConnected?.()) {
    return { browser: activeBrowser, page: activePage };
  }

  const session = await nativeBrowser.launchNativeBrowser({
    store,
    userDataPath,
    profileKey: 'grok',
    headless,
    reuseActive: true,
  });

  activeBrowser = session.browser;
  activePage = session.page;

  return { browser: activeBrowser, page: activePage, browserId: session.browserId };
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
  const url = await page.url();
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
  const { page } = await launchGrokBrowser(userDataPath, store, { headless: false });

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
  const { page } = await launchGrokBrowser(userDataPath, store, { headless });

  const currentUrl = await page.url();
  if (!currentUrl || currentUrl === 'about:blank') {
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

/** How many Extend clicks to run after initial generation (derived from prompt structure). */
function countPromptParts(prompt) {
  const text = String(prompt || '').trim();
  if (!text) return 1;
  const explicit = text.split(/\n---+\n|\n\|\n|(?:^|\n)\s*(?:part|scene|segment|chapter)\s*\d+\s*[:.)-]/gim)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
  if (explicit.length > 1) return Math.min(8, explicit.length);
  const sentences = text.split(/[.!?]+\s+/).filter((s) => s.length > 15);
  if (sentences.length >= 3) return Math.min(6, Math.ceil(sentences.length / 2));
  return Math.max(1, Math.min(5, Math.ceil(text.length / 180)));
}

/** Wait before Extend — minimum 60s, scales with prompt length and part index. */
function estimateExtendWaitMs(prompt, partIndex = 0, totalParts = 1) {
  const base = 60000;
  const lengthBonus = Math.floor((String(prompt || '').length / 100) * 8000);
  const partBonus = partIndex * 12000;
  const multiPartBonus = totalParts > 2 ? (totalParts - 1) * 5000 : 0;
  return Math.min(180000, base + lengthBonus + partBonus + multiPartBonus);
}

async function ensureImagineVideoMode(page) {
  const clicked = await clickByText(page, [
    '^video$', 'make video', 'text to video', 'generate video', 'video mode', '^animate$',
  ]);
  if (clicked) await delay(1500);
  return clicked;
}

async function clickExtendButton(page) {
  const result = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll('button, a, [role="button"], [aria-label], [title], span')];
    for (const node of candidates) {
      const text = (node.textContent || node.getAttribute('aria-label') || node.getAttribute('title') || '').trim();
      if (!text) continue;
      if (
        /^extend$/i.test(text)
        || /extend\s*(video|clip|scene|from)?/i.test(text)
        || /continue\s*(video|clip)?/i.test(text)
        || /lengthen/i.test(text)
        || /extend from frame/i.test(text)
      ) {
        node.click();
        return { ok: true, label: text.slice(0, 48) };
      }
    }
    return { ok: false };
  });
  if (result.ok) await delay(2500);
  return result.ok;
}

async function waitForVideoGeneration(page, minWaitMs, maxWaitMs = 240000) {
  const start = Date.now();
  const deadline = start + maxWaitMs;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const videos = [...document.querySelectorAll('video')];
      const ready = videos.some((v) => v.src && v.src.length > 10 && (v.readyState >= 2 || v.duration > 0));
      const generating = /generating|creating|processing|extending/i.test(document.body?.innerText || '');
      return { ready, generating, count: videos.length };
    });
    const elapsed = Date.now() - start;
    if (state.ready && elapsed >= minWaitMs * 0.8) return { ready: true, elapsed, ...state };
    if (!state.generating && elapsed >= minWaitMs) return { ready: state.ready, elapsed, ...state };
    await delay(3000);
  }
  return { ready: false, elapsed: Date.now() - start, timeout: true };
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

  if ((await page.url()).includes('sign-in')) {
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

/**
 * Grok Imagine VIDEO — keyword prompt, wait ~1min (scaled by length/parts), click Extend per part.
 */
async function generateGrokVideo(store, userDataPath, prompt, {
  extendParts = null,
  maxExtends = 5,
  baseWaitMs = 60000,
  keywordMeta = {},
} = {}) {
  if (!prompt?.trim()) throw new Error('Video prompt is required.');
  const page = await ensureSession(store, userDataPath);

  await page.goto(GROK_IMAGINE, { waitUntil: 'networkidle2', timeout: 120000 });
  await delay(2000);

  if ((await page.url()).includes('sign-in')) {
    throw new Error('Grok Imagine requires login. Connect Grok in Settings first.');
  }

  await ensureImagineVideoMode(page);

  const trimmed = prompt.trim();
  const totalParts = extendParts ?? countPromptParts(trimmed);
  const extendCount = Math.min(maxExtends, Math.max(0, totalParts - 1));
  const extendLog = [];

  await submitPrompt(page, trimmed);

  const initialWait = Math.max(baseWaitMs, estimateExtendWaitMs(trimmed, 0, totalParts));
  const initialGen = await waitForVideoGeneration(page, initialWait);
  extendLog.push({ step: 'initial', waitMs: initialWait, ...initialGen });

  for (let i = 0; i < extendCount; i += 1) {
    const waitMs = estimateExtendWaitMs(trimmed, i + 1, totalParts);
    await delay(waitMs);

    let clicked = await clickExtendButton(page);
    if (!clicked) {
      await delay(5000);
      clicked = await clickExtendButton(page);
    }

    extendLog.push({
      step: `extend_${i + 1}`,
      waitMs,
      clicked,
      partIndex: i + 1,
      totalParts,
    });

    if (clicked) {
      const gen = await waitForVideoGeneration(page, estimateExtendWaitMs(trimmed, i + 1, totalParts));
      extendLog[extendLog.length - 1] = { ...extendLog[extendLog.length - 1], ...gen };
    }
  }

  const collectStart = Date.now();
  let assets = [];
  while (Date.now() - collectStart < 300000) {
    assets = await collectImagineAssets(page, userDataPath, 'grok_video');
    const videos = assets.filter((a) => a.type === 'video');
    if (videos.length) {
      return {
        success: true,
        assets,
        primaryAsset: videos[videos.length - 1],
        source: 'grok-video',
        totalParts,
        extendsRequested: extendCount,
        extendsClicked: extendLog.filter((e) => e.clicked).length,
        extendLog,
        primaryKeyword: keywordMeta.primaryKeyword || null,
        matchedKeywords: keywordMeta.matchedKeywords || [],
      };
    }
    if (assets.length) break;
    await delay(4000);
  }

  if (assets.length) {
    return {
      success: true,
      assets,
      primaryAsset: assets[0],
      source: 'grok-video',
      note: 'Video element not detected — saved best available asset',
      totalParts,
      extendLog,
      primaryKeyword: keywordMeta.primaryKeyword || null,
      matchedKeywords: keywordMeta.matchedKeywords || [],
    };
  }

  return {
    success: false,
    error: 'No video detected from Grok Imagine. Complete generation in the browser window if needed.',
    browserOpen: true,
    totalParts,
    extendLog,
  };
}

async function getStatus(store, userDataPath) {
  const settings = getSettings(store);
  let profileReady = false;
  let profileDir = null;
  if (userDataPath) {
    try {
      profileDir = getProfileDir(userDataPath, store);
      profileReady = fs.existsSync(profileDir) && fs.readdirSync(profileDir).length > 0;
    } catch (e) { /* ignore */ }
  }
  const hasCredentials = !!(settings.email || settings.password);
  const sessionValid = settings.sessionValid || sessionState.loggedIn || profileReady;
  const browserStatus = nativeBrowser.getBrowserStatus(store, userDataPath);
  return {
    nodriverReady: (await nodriverBridge.getStatus()).nodriverReady,
    puppeteerReady: (await nodriverBridge.getStatus()).nodriverReady,
    nativeBrowser: browserStatus,
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
  await nativeBrowser.closeBrowserSession('grok');
  activeBrowser = null;
  activePage = null;
  sessionState.loggedIn = false;
}

module.exports = {
  getSettings,
  saveSettings,
  seedGrokDefaultsIfNeeded,
  getAssetsDir,
  launchGrokBrowser,
  loginToGrok,
  ensureSession,
  askGrokText,
  generateGrokImagine,
  generateGrokVideo,
  countPromptParts,
  estimateExtendWaitMs,
  getStatus,
  closeGrokBrowser,
  SIGN_IN_URL,
  GROK_HOME,
  GROK_IMAGINE,
};