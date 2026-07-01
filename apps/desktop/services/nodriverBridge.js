/**
 * Node bridge to async nodriver (Python) — stealth browser automation.
 * Pattern aligned with stealth-browser-mcp: nodriver + CDP, no Playwright/Puppeteer.
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const readline = require('readline');

const WORKER_DIR = path.join(__dirname, 'stealthBrowser');
const WORKER_SCRIPT = path.join(WORKER_DIR, 'nodriver_worker.py');
const REQUIREMENTS = path.join(WORKER_DIR, 'requirements.txt');

let workerProcess = null;
let workerReady = null;
let reqCounter = 0;
const pending = new Map();

function findPythonExecutable() {
  const candidates = [
    process.env.SI_PYTHON,
    process.env.PYTHON,
    'python',
    'python3',
    'py',
  ].filter(Boolean);

  for (const cmd of candidates) {
    try {
      const { execFileSync } = require('child_process');
      const out = execFileSync(cmd, ['--version'], { encoding: 'utf8', timeout: 5000 });
      if (/python/i.test(out)) return cmd;
    } catch (e) { /* next */ }
  }
  return null;
}

function ensureNodriverInstalled(pythonCmd) {
  try {
    const { execFileSync } = require('child_process');
    execFileSync(pythonCmd, ['-c', 'import nodriver'], { stdio: 'ignore', timeout: 10000 });
    return true;
  } catch (e) {
    try {
      const { execFileSync } = require('child_process');
      execFileSync(pythonCmd, ['-m', 'pip', 'install', '-r', REQUIREMENTS], {
        stdio: 'ignore',
        timeout: 180000,
      });
      execFileSync(pythonCmd, ['-c', 'import nodriver'], { stdio: 'ignore', timeout: 10000 });
      return true;
    } catch (installErr) {
      return false;
    }
  }
}

function startWorker() {
  if (workerProcess && !workerProcess.killed) return workerReady;

  const pythonCmd = findPythonExecutable();
  if (!pythonCmd) {
    workerReady = Promise.resolve({ nodriver: false, error: 'Python not found' });
    return workerReady;
  }

  if (!fs.existsSync(WORKER_SCRIPT)) {
    workerReady = Promise.resolve({ nodriver: false, error: 'nodriver_worker.py missing' });
    return workerReady;
  }

  ensureNodriverInstalled(pythonCmd);

  workerReady = new Promise((resolve) => {
    const args = pythonCmd === 'py' ? ['-3', WORKER_SCRIPT] : [WORKER_SCRIPT];
    workerProcess = spawn(pythonCmd, args, {
      cwd: WORKER_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const rl = readline.createInterface({ input: workerProcess.stdout });
    rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        const waiter = pending.get(msg.id);
        if (waiter) {
          pending.delete(msg.id);
          if (msg.ok) waiter.resolve(msg.result);
          else waiter.reject(new Error(msg.error || 'nodriver worker error'));
        }
      } catch (e) { /* ignore parse errors */ }
    });

    workerProcess.stderr.on('data', (chunk) => {
      const text = String(chunk || '');
      if (process.env.SI_NODRIVER_DEBUG) console.warn('[nodriver]', text.trim());
    });

    workerProcess.on('exit', () => {
      workerProcess = null;
      for (const [, waiter] of pending.entries()) {
        waiter.reject(new Error('nodriver worker exited'));
      }
      pending.clear();
    });

    callWorker('ping', {})
      .then((result) => resolve({ ...result, pythonCmd }))
      .catch((err) => resolve({ nodriver: false, error: err.message }));
  });

  return workerReady;
}

async function callWorker(method, params, timeoutMs = 180000) {
  await startWorker();
  if (!workerProcess || workerProcess.killed) {
    throw new Error('nodriver worker is not running. Install Python 3 and run: pip install -r apps/desktop/services/stealthBrowser/requirements.txt');
  }

  const id = `req_${++reqCounter}`;
  const payload = JSON.stringify({ id, method, params }) + '\n';

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`nodriver ${method} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });

    try {
      workerProcess.stdin.write(payload);
    } catch (e) {
      clearTimeout(timer);
      pending.delete(id);
      reject(e);
    }
  });
}

function fnToScript(fn) {
  if (typeof fn === 'string') return fn;
  if (typeof fn === 'function') {
    let src = fn.toString();
    const arrowIdx = src.indexOf('=>');
    if (arrowIdx !== -1) {
      const body = src.slice(arrowIdx + 2).trim();
      if (body.startsWith('{')) return `function${src.slice(src.indexOf('('))}`;
      return `function${src.slice(src.indexOf('('), arrowIdx)} { return ${body}; }`;
    }
    return src;
  }
  throw new Error('evaluate expects a function or script string');
}

function createPage(sessionId) {
  const page = {
    _sessionId: sessionId,
    _connected: true,

    async goto(url, opts = {}) {
      const result = await callWorker('goto', {
        sessionId,
        url,
        waitUntil: opts.waitUntil || 'load',
        timeout: opts.timeout || 120000,
      });
      return result;
    },

    url() {
      return callWorker('url', { sessionId }).then((r) => r.url);
    },

    async evaluate(fn, ...args) {
      const script = fnToScript(fn);
      const result = await callWorker('evaluate', { sessionId, script, args });
      return result.value;
    },

    async $(selector) {
      const result = await callWorker('query', { sessionId, selector });
      if (!result.found) return null;
      return {
        click: async (opts = {}) => callWorker('click', {
          sessionId,
          selector,
          clickCount: opts.clickCount || 1,
        }),
        type: async (text, opts = {}) => callWorker('type', {
          sessionId,
          selector,
          text: String(text),
          delay: opts.delay || 25,
        }),
        uploadFile: async (filePath) => callWorker('upload', {
          sessionId,
          selector,
          filePath,
        }),
      };
    },

    async type(selector, text, opts = {}) {
      return callWorker('page_type', {
        sessionId,
        selector,
        text: String(text),
        delay: opts.delay || 30,
      });
    },

    keyboard: {
      press: (key) => callWorker('press_key', { sessionId, key }),
    },

    setUserAgent: (ua) => callWorker('set_user_agent', { sessionId, userAgent: ua }),

    authenticate: ({ username, password }) => callWorker('authenticate', {
      sessionId,
      username,
      password,
    }),

    content: () => callWorker('content', { sessionId }).then((r) => r.content),

    waitForNavigation: (opts = {}) => callWorker('wait_for_navigation', {
      sessionId,
      timeout: opts.timeout || 30000,
    }).catch(() => {}),

    waitForFunction: (fn, opts = {}) => {
      const script = fnToScript(fn);
      return callWorker('wait_for_function', {
        sessionId,
        script,
        timeout: (opts && opts.timeout) || 120000,
      });
    },
  };

  return page;
}

function createBrowser(sessionId) {
  let closed = false;
  const browser = {
    _sessionId: sessionId,

    isConnected: () => !closed,

    async close() {
      if (closed) return;
      closed = true;
      await callWorker('close', { sessionId }).catch(() => {});
    },

    async pages() {
      await callWorker('pages', { sessionId });
      return [createPage(sessionId)];
    },

    async newPage() {
      await callWorker('new_page', { sessionId });
      return createPage(sessionId);
    },
  };

  return browser;
}

async function isReady() {
  try {
    const status = await startWorker();
    return !!(status.nodriver && status.browser);
  } catch (e) {
    return false;
  }
}

async function getStatus() {
  try {
    const status = await startWorker();
    return {
      nodriverReady: !!(status.nodriver && status.browser),
      nodriver: status.nodriver,
      browserFound: status.browser,
      python: status.python,
      pythonCmd: status.pythonCmd,
      error: status.error || null,
    };
  } catch (e) {
    return { nodriverReady: false, error: e.message };
  }
}

async function launch(opts = {}) {
  const ready = await getStatus();
  if (!ready.nodriverReady) {
    throw new Error(ready.error || 'nodriver stealth browser is not ready. Install Python 3 and nodriver.');
  }

  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await callWorker('spawn', {
    sessionId,
    headless: opts.headless === true || opts.headless === 'new',
    userDataDir: opts.userDataDir,
    executablePath: opts.executablePath,
    browserArgs: opts.args || [],
    userAgent: opts.userAgent,
    profileDirectory: opts.profileDirectory,
    viewportWidth: opts.defaultViewport?.width || 1400,
    viewportHeight: opts.defaultViewport?.height || 900,
    sandbox: false,
  });

  const browser = createBrowser(sessionId);
  const page = createPage(sessionId);
  return { browser, page, sessionId };
}

async function connect(opts = {}) {
  const ready = await getStatus();
  if (!ready.nodriverReady) {
    throw new Error(ready.error || 'nodriver stealth browser is not ready.');
  }

  const sessionId = `attach_${Date.now()}`;
  const debugPort = opts.debugPort
    || parseInt(String(opts.browserURL || '').split(':').pop(), 10)
    || 9222;

  await callWorker('connect', { sessionId, debugPort });
  const browser = createBrowser(sessionId);
  const page = createPage(sessionId);
  return { browser, page, sessionId };
}

async function shutdown() {
  if (workerProcess && !workerProcess.killed) {
    try {
      await callWorker('shutdown', {}, 5000);
    } catch (e) { /* ignore */ }
    try { workerProcess.kill(); } catch (e) { /* ignore */ }
  }
  workerProcess = null;
}

module.exports = {
  isReady,
  getStatus,
  launch,
  connect,
  createPage,
  createBrowser,
  shutdown,
  callWorker,
  findPythonExecutable,
  WORKER_DIR,
};