/**
 * Native browser launcher — Chrome, Edge, Opera, Firefox (not bundled Chromium).
 * Persistent profiles save cookies between sessions; optional attach to running browser via CDP.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const STORAGE_KEY = 'nativeBrowserSettings';

const BROWSER_DEFS = {
  chrome: {
    id: 'chrome',
    label: 'Google Chrome',
    engine: 'chromium',
    winPaths: [
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ],
    systemUserDataDir: () => path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'),
    debugArg: '--remote-debugging-port',
  },
  edge: {
    id: 'edge',
    label: 'Microsoft Edge',
    engine: 'chromium',
    winPaths: [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ],
    systemUserDataDir: () => path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data'),
    debugArg: '--remote-debugging-port',
  },
  opera: {
    id: 'opera',
    label: 'Opera / Opera GX',
    engine: 'chromium',
    winPaths: [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Opera', 'opera.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Opera GX', 'opera.exe'),
      'C:\\Program Files\\Opera\\opera.exe',
      'C:\\Program Files\\Opera GX\\opera.exe',
    ],
    systemUserDataDir: () => path.join(process.env.APPDATA || '', 'Opera Software', 'Opera Stable'),
    debugArg: '--remote-debugging-port',
  },
  firefox: {
    id: 'firefox',
    label: 'Mozilla Firefox',
    engine: 'firefox',
    winPaths: [
      'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
      'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
    ],
    systemUserDataDir: () => path.join(process.env.APPDATA || '', 'Mozilla', 'Firefox', 'Profiles'),
    debugArg: null,
  },
  chromium: {
    id: 'chromium',
    label: 'Bundled Chromium (Puppeteer fallback)',
    engine: 'bundled',
    winPaths: [],
    systemUserDataDir: null,
    debugArg: '--remote-debugging-port',
  },
};

let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = null; }

let playwrightFirefox;
try { playwrightFirefox = require('playwright').firefox; } catch (e) { playwrightFirefox = null; }

const activeSessions = new Map();

function getDefaultSettings() {
  const installed = detectInstalledBrowsers();
  const edge = installed.find((b) => b.id === 'edge' && b.installed);
  const chrome = installed.find((b) => b.id === 'chrome' && b.installed);
  return {
    browserId: edge ? 'edge' : (chrome ? 'chrome' : 'edge'),
    launchMode: 'app_profile',
    profileDirectory: 'Default',
    debugPort: 9222,
    persistCookies: true,
    updatedAt: null,
  };
}

function getBrowserSettings(store) {
  try {
    const raw = store.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return { ...getDefaultSettings(), ...saved };
  } catch (e) {
    return getDefaultSettings();
  }
}

function saveBrowserSettings(store, partial) {
  const merged = { ...getBrowserSettings(store), ...partial, updatedAt: new Date().toISOString() };
  store.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

function findExecutable(browserDef) {
  if (!browserDef || browserDef.engine === 'bundled') return null;
  for (const p of browserDef.winPaths || []) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function detectInstalledBrowsers() {
  const list = [];
  for (const def of Object.values(BROWSER_DEFS)) {
    const execPath = findExecutable(def);
    const installed = def.engine === 'bundled' ? !!puppeteer : !!execPath;
    let firefoxReady = def.engine === 'firefox' ? !!playwrightFirefox : true;
    list.push({
      id: def.id,
      label: def.label,
      engine: def.engine,
      installed,
      executablePath: execPath || null,
      automationReady: installed && (def.engine !== 'firefox' || firefoxReady),
      note: def.engine === 'firefox' && !playwrightFirefox
        ? 'Install playwright: npm install playwright && npx playwright install firefox'
        : null,
    });
  }
  return list;
}

function getProfileDir(userDataPath, settings, profileKey) {
  const browserId = settings.browserId || 'chrome';
  if (settings.launchMode === 'system_profile') {
    const def = BROWSER_DEFS[browserId];
    return def?.systemUserDataDir?.() || path.join(userDataPath, 'native-browser-profiles', browserId, profileKey);
  }
  const dir = path.join(userDataPath, 'native-browser-profiles', browserId, profileKey);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function adaptPlaywrightPage(pwPage) {
  return {
    url: () => pwPage.url(),
    goto: async (url, opts = {}) => {
      await pwPage.goto(url, {
        waitUntil: opts.waitUntil === 'networkidle2' ? 'networkidle' : (opts.waitUntil || 'load'),
        timeout: opts.timeout || 120000,
      });
    },
    evaluate: (fn, ...args) => pwPage.evaluate(fn, ...args),
    $: async (selector) => {
      const loc = pwPage.locator(selector).first();
      if ((await loc.count()) === 0) return null;
      return {
        click: async (opts = {}) => {
          if (opts.clickCount === 3) {
            await loc.click({ clickCount: 3 });
          } else {
            await loc.click();
          }
        },
        type: async (text, opts = {}) => {
          await loc.pressSequentially(String(text), { delay: opts.delay || 25 });
        },
        uploadFile: async (filePath) => {
          await loc.setInputFiles(filePath);
        },
      };
    },
    keyboard: { press: (key) => pwPage.keyboard.press(key) },
    setUserAgent: async (ua) => {
      try { await pwPage.context().setExtraHTTPHeaders({ 'User-Agent': ua }); } catch (e) { /* ignore */ }
    },
  };
}

function wrapBrowserSession(rawBrowser, page, meta) {
  const closeFn = async () => {
    try {
      if (meta.engine === 'firefox') await rawBrowser.close();
      else await rawBrowser.close();
    } catch (e) { /* ignore */ }
    activeSessions.delete(meta.sessionKey);
  };

  return {
    browser: {
      isConnected: () => {
        if (meta.engine === 'firefox') return !!rawBrowser;
        return rawBrowser?.isConnected?.() ?? false;
      },
      close: closeFn,
      pages: async () => [page],
      newPage: async () => {
        if (meta.engine === 'firefox') {
          const p = await rawBrowser.newPage();
          return adaptPlaywrightPage(p);
        }
        return rawBrowser.newPage();
      },
    },
    page,
    engine: meta.engine,
    browserId: meta.browserId,
    profileDir: meta.profileDir,
    close: closeFn,
  };
}

async function connectViaCDP(debugPort = 9222) {
  if (!puppeteer) throw new Error('Puppeteer is required for CDP attach mode.');
  const browserURL = `http://127.0.0.1:${debugPort}`;
  const raw = await puppeteer.connect({ browserURL, defaultViewport: null });
  const pages = await raw.pages();
  const page = pages.find((p) => p.url() && p.url() !== 'about:blank') || pages[0] || await raw.newPage();
  return wrapBrowserSession(raw, page, {
    engine: 'attach',
    browserId: 'attach',
    profileDir: null,
    sessionKey: `attach:${debugPort}`,
  });
}

async function launchFirefoxBrowser({ execPath, profileDir, headless }) {
  if (!playwrightFirefox) {
    throw new Error('Firefox automation requires Playwright. Run: npm install playwright && npx playwright install firefox');
  }
  const context = await playwrightFirefox.launchPersistentContext(profileDir, {
    headless,
    executablePath: execPath || undefined,
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  });
  const pwPage = context.pages()[0] || await context.newPage();
  return wrapBrowserSession(context, adaptPlaywrightPage(pwPage), {
    engine: 'firefox',
    browserId: 'firefox',
    profileDir,
    sessionKey: `firefox:${profileDir}`,
  });
}

async function launchChromiumBrowser({ settings, execPath, profileDir, headless, profileKey }) {
  if (!puppeteer) throw new Error('Puppeteer is not installed. Run: npm install puppeteer');

  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1400,900',
  ];

  let userDataDir = profileDir;
  if (settings.launchMode === 'system_profile' && settings.profileDirectory) {
    args.push(`--profile-directory=${settings.profileDirectory}`);
  }

  const launchOpts = {
    headless,
    userDataDir,
    args,
    defaultViewport: { width: 1400, height: 900 },
  };

  if (execPath) launchOpts.executablePath = execPath;

  const raw = await puppeteer.launch(launchOpts);
  const pages = await raw.pages();
  const page = pages[0] || await raw.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );

  return wrapBrowserSession(raw, page, {
    engine: execPath ? 'native-chromium' : 'bundled',
    browserId: settings.browserId,
    profileDir,
    sessionKey: `${settings.browserId}:${profileKey}`,
  });
}

async function launchNativeBrowser({
  store,
  userDataPath,
  profileKey = 'default',
  headless = false,
  reuseActive = true,
} = {}) {
  const settings = getBrowserSettings(store);
  const sessionKey = settings.launchMode === 'attach'
    ? `attach:${settings.debugPort || 9222}`
    : `${settings.browserId}:${profileKey}`;

  if (reuseActive) {
    const existing = activeSessions.get(sessionKey);
    if (existing?.browser?.isConnected?.()) return existing;
  }

  let session;

  if (settings.launchMode === 'attach') {
    session = await connectViaCDP(settings.debugPort || 9222);
  } else {
    const def = BROWSER_DEFS[settings.browserId] || BROWSER_DEFS.chrome;
    const execPath = def.engine === 'bundled' ? null : findExecutable(def);
    if (def.engine !== 'bundled' && !execPath) {
      throw new Error(`${def.label} not found. Install it or choose another browser in Settings → Native Browser.`);
    }
    const profileDir = getProfileDir(userDataPath, settings, profileKey);

    if (def.engine === 'firefox') {
      session = await launchFirefoxBrowser({ execPath, profileDir, headless });
    } else {
      session = await launchChromiumBrowser({
        settings, execPath, profileDir, headless, profileKey,
      });
    }
  }

  activeSessions.set(sessionKey, session);
  return session;
}

async function openUrlInNativeBrowser(store, userDataPath, url, { profileKey = 'default', newTab = true } = {}) {
  const session = await launchNativeBrowser({ store, userDataPath, profileKey, headless: false });
  if (newTab && session.browser.newPage) {
    try {
      const page = await session.browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
      return { success: true, url: page.url(), browserId: session.browserId };
    } catch (e) { /* fall through */ }
  }
  await session.page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  return { success: true, url: session.page.url(), browserId: session.browserId };
}

function getAttachInstructions(browserId) {
  const def = BROWSER_DEFS[browserId] || BROWSER_DEFS.chrome;
  const exe = findExecutable(def) || `<path-to-${browserId}>`;
  const port = 9222;
  return {
    port,
    command: `"${exe}" --remote-debugging-port=${port}`,
    steps: [
      `Close all ${def.label} windows`,
      `Run: "${exe}" --remote-debugging-port=${port}`,
      `Log in to your sites in that browser window`,
      `In Social Imperialism Settings, set Launch Mode to "Attach to running browser" and port ${port}`,
      'Click Connect — automation reuses your live session and cookies',
    ],
  };
}

function launchBrowserWithDebugging(browserId, port = 9222) {
  const def = BROWSER_DEFS[browserId] || BROWSER_DEFS.chrome;
  const exe = findExecutable(def);
  if (!exe) throw new Error(`${def.label} not installed`);
  const child = spawn(exe, [`--remote-debugging-port=${port}`, '--no-first-run'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return { success: true, executablePath: exe, port, pid: child.pid };
}

async function closeBrowserSession(profileKey = null) {
  if (profileKey) {
    for (const [key, session] of activeSessions.entries()) {
      if (key.endsWith(`:${profileKey}`) || key === profileKey) {
        await session.close?.();
        activeSessions.delete(key);
      }
    }
    return;
  }
  for (const [, session] of activeSessions.entries()) {
    try { await session.close?.(); } catch (e) { /* ignore */ }
  }
  activeSessions.clear();
}

function getBrowserStatus(store, userDataPath) {
  const settings = getBrowserSettings(store);
  const browsers = detectInstalledBrowsers();
  const selected = browsers.find((b) => b.id === settings.browserId);
  const profiles = [];
  if (userDataPath) {
    const base = path.join(userDataPath, 'native-browser-profiles');
    if (fs.existsSync(base)) {
      for (const bid of fs.readdirSync(base)) {
        const bidPath = path.join(base, bid);
        if (!fs.statSync(bidPath).isDirectory()) continue;
        for (const pk of fs.readdirSync(bidPath)) {
          const full = path.join(bidPath, pk);
          try {
            profiles.push({
              browserId: bid,
              profileKey: pk,
              hasCookies: fs.existsSync(full) && fs.readdirSync(full).length > 2,
            });
          } catch (e) { /* skip */ }
        }
      }
    }
  }
  return {
    puppeteerReady: !!puppeteer,
    playwrightFirefoxReady: !!playwrightFirefox,
    settings,
    browsers,
    selectedBrowser: selected || null,
    activeSessions: [...activeSessions.keys()],
    savedProfiles: profiles,
    attachInstructions: getAttachInstructions(settings.browserId),
  };
}

module.exports = {
  STORAGE_KEY,
  BROWSER_DEFS,
  getBrowserSettings,
  saveBrowserSettings,
  detectInstalledBrowsers,
  launchNativeBrowser,
  openUrlInNativeBrowser,
  connectViaCDP,
  closeBrowserSession,
  getAttachInstructions,
  launchBrowserWithDebugging,
  getBrowserStatus,
  getProfileDir,
};