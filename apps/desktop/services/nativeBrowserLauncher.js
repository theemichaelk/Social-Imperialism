/**
 * Native browser launcher — Chrome, Edge, Opera via async nodriver (stealth CDP).
 * Persistent profiles save cookies between sessions; optional attach to running browser via CDP.
 */
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const nodriverBridge = require('./nodriverBridge');

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
    label: 'Stealth Chromium (nodriver)',
    engine: 'bundled',
    winPaths: [],
    systemUserDataDir: null,
    debugArg: '--remote-debugging-port',
  },
};

const activeSessions = new Map();
let nodriverStatusCache = { nodriverReady: false };

async function refreshNodriverStatus() {
  nodriverStatusCache = await nodriverBridge.getStatus();
  return nodriverStatusCache;
}

function getDefaultSettings() {
  const installed = detectInstalledBrowsers();
  const firstReady = installed.find((b) => b.installed && b.automationReady);
  const firstInstalled = installed.find((b) => b.installed);
  const pick = firstReady || firstInstalled;
  return {
    browserId: pick?.id || 'edge',
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

function findWindowsBrowserViaRegistry(browserId) {
  if (process.platform !== 'win32') return null;
  const regKeys = {
    edge: [
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe',
      'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe',
    ],
    chrome: [
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
      'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
    ],
    opera: [
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\opera.exe',
    ],
  };
  for (const key of regKeys[browserId] || []) {
    try {
      const out = execFileSync('reg', ['query', key, '/ve'], { encoding: 'utf8', timeout: 5000 });
      const match = out.match(/REG_SZ\s+(.+)/);
      if (match) {
        const candidate = match[1].trim().replace(/^"(.*)"$/, '$1');
        if (candidate && fs.existsSync(candidate)) return candidate;
      }
    } catch (e) { /* try next */ }
  }
  const whereNames = { edge: 'msedge', chrome: 'chrome', opera: 'opera' };
  const exe = whereNames[browserId];
  if (exe) {
    try {
      const out = execFileSync('where', [exe], { encoding: 'utf8', timeout: 5000, shell: true });
      const line = out.split(/\r?\n/).map((l) => l.trim()).find((l) => /\.exe$/i.test(l));
      if (line && fs.existsSync(line)) return line;
    } catch (e) { /* ignore */ }
  }
  return null;
}

function findExecutable(browserDef) {
  if (!browserDef || browserDef.engine === 'bundled') return null;
  for (const p of browserDef.winPaths || []) {
    if (p && fs.existsSync(p)) return p;
  }
  return findWindowsBrowserViaRegistry(browserDef.id);
}

function resolveBrowserExecutable(browserId) {
  const def = BROWSER_DEFS[browserId] || BROWSER_DEFS.chrome;
  if (def.engine === 'bundled') {
    return { def, execPath: null, browserId: def.id };
  }
  const execPath = findExecutable(def);
  return { def, execPath, browserId: def.id };
}

function findFirstInstalledChromiumBrowser() {
  for (const id of ['edge', 'chrome', 'opera', 'chromium']) {
    const { def, execPath } = resolveBrowserExecutable(id);
    if (def.engine === 'bundled' && nodriverStatusCache.nodriverReady) {
      return { browserId: id, def, execPath: null };
    }
    if (execPath) return { browserId: id, def, execPath };
  }
  return null;
}

function detectInstalledBrowsers() {
  const nodriverReady = nodriverStatusCache.nodriverReady;
  const list = [];
  for (const def of Object.values(BROWSER_DEFS)) {
    const execPath = findExecutable(def);
    const installed = def.engine === 'bundled' ? nodriverReady : !!execPath;
    const firefoxReady = def.engine === 'firefox' ? false : nodriverReady;
    list.push({
      id: def.id,
      label: def.label,
      engine: def.engine,
      installed,
      executablePath: execPath || null,
      automationReady: installed && nodriverReady && def.engine !== 'firefox',
      note: def.engine === 'firefox'
        ? 'Firefox is not supported by nodriver — use Chrome or Edge for stealth automation.'
        : (!nodriverReady ? 'Install Python 3 and nodriver: pip install -r apps/desktop/services/stealthBrowser/requirements.txt' : null),
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

function wrapBrowserSession(browser, page, meta) {
  const closeFn = async () => {
    try { await browser.close(); } catch (e) { /* ignore */ }
    activeSessions.delete(meta.sessionKey);
  };

  return {
    browser: {
      isConnected: () => browser.isConnected(),
      close: closeFn,
      pages: async () => [page],
      newPage: async () => browser.newPage(),
    },
    page,
    engine: meta.engine,
    browserId: meta.browserId,
    profileDir: meta.profileDir,
    close: closeFn,
  };
}

async function connectViaCDP(debugPort = 9222) {
  const { browser, page } = await nodriverBridge.connect({ debugPort });
  return wrapBrowserSession(browser, page, {
    engine: 'attach',
    browserId: 'attach',
    profileDir: null,
    sessionKey: `attach:${debugPort}`,
  });
}

async function launchChromiumBrowser({ settings, execPath, profileDir, headless, profileKey }) {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1400,900',
  ];

  let profileDirectory = null;
  if (settings.launchMode === 'system_profile' && settings.profileDirectory) {
    profileDirectory = settings.profileDirectory;
  }

  const { browser, page } = await nodriverBridge.launch({
    headless,
    userDataDir: profileDir,
    executablePath: execPath || undefined,
    args,
    userAgent: ua,
    profileDirectory,
    defaultViewport: { width: 1400, height: 900 },
  });

  return wrapBrowserSession(browser, page, {
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
  await refreshNodriverStatus();

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
    let { def, execPath, browserId } = resolveBrowserExecutable(settings.browserId);
    if (def.engine === 'firefox') {
      throw new Error('Firefox automation is not supported with nodriver. Choose Chrome or Edge in Settings → Native Browser.');
    }
    if (def.engine !== 'bundled' && !execPath) {
      const fallback = findFirstInstalledChromiumBrowser();
      if (fallback) {
        def = fallback.def;
        execPath = fallback.execPath;
        browserId = fallback.browserId;
        settings = saveBrowserSettings(store, { browserId });
      }
    }
    if (def.engine !== 'bundled' && !execPath) {
      const hostHint = process.platform === 'linux'
        ? 'Grok browser automation requires the Social Imperialism desktop app on Windows (or a Windows API host with Edge/Chrome).'
        : 'Install Microsoft Edge or Google Chrome, or choose another browser in Settings → Native Browser.';
      throw new Error(`${def.label} not found. ${hostHint}`);
    }
    if (!nodriverStatusCache.nodriverReady) {
      throw new Error('Python nodriver is not ready. Install Python 3 and run: pip install -r apps/desktop/services/stealthBrowser/requirements.txt');
    }
    const profileDir = getProfileDir(userDataPath, settings, profileKey);
    session = await launchChromiumBrowser({
      settings: { ...settings, browserId }, execPath, profileDir, headless, profileKey,
    });
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
      return { success: true, url: await page.url(), browserId: session.browserId };
    } catch (e) { /* fall through */ }
  }
  await session.page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  return { success: true, url: await session.page.url(), browserId: session.browserId };
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

async function getBrowserStatus(store, userDataPath) {
  const status = await refreshNodriverStatus();
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
    nodriverReady: status.nodriverReady,
    puppeteerReady: status.nodriverReady,
    playwrightFirefoxReady: false,
    nodriver: status,
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
  findFirstInstalledChromiumBrowser,
  resolveBrowserExecutable,
  launchNativeBrowser,
  openUrlInNativeBrowser,
  connectViaCDP,
  closeBrowserSession,
  getAttachInstructions,
  launchBrowserWithDebugging,
  getBrowserStatus,
  getProfileDir,
};