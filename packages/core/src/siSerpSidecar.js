/**
 * Ensures local OpenSERP is running before Social Imperialism SERP API calls.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { pickBaseUrl } = require('./siSerpClient');

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
let ensureInFlight = null;
let lastEnsureAt = 0;

function autostartEnabled() {
  const flag = (process.env.SI_SERP_AUTOSTART || process.env.OPENSERP_AUTOSTART || 'true').trim().toLowerCase();
  return !(flag === '0' || flag === 'false' || flag === 'off');
}

function isLocalBaseUrl(baseUrl) {
  try {
    return LOCAL_HOSTS.has(new URL(baseUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function probeHealth(baseUrl, timeoutMs = 5000) {
  try {
    const res = await axios.get(`${baseUrl.replace(/\/$/, '')}/health`, { timeout: timeoutMs });
    return res.status === 200;
  } catch {
    return false;
  }
}

function desktopRoot() {
  return path.resolve(__dirname, '..', '..', '..', 'apps', 'desktop');
}

function startScriptCandidates() {
  const root = desktopRoot();
  return [
    path.join(root, 'scripts', 'start-si-serp-desktop.ps1'),
    path.resolve('C:\\Users\\PC54\\openserp-study', 'openserp.exe'),
    path.resolve('E:\\OneDrive\\Documents\\Factory AI.02.20.26\\Quantum-Page-AI\\tools\\quantum-serp\\openserp.exe'),
    path.join(root, 'tools', 'openserp', 'openserp.exe'),
    path.resolve('E:\\OneDrive\\Documents\\Factory AI.02.20.26\\Autonomus Ghost\\tools\\openserp\\openserp.exe'),
  ];
}

function spawnSidecarStart() {
  for (const candidate of startScriptCandidates()) {
    if (candidate.endsWith('.ps1') && fs.existsSync(candidate)) {
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', candidate],
        { detached: true, stdio: 'ignore', windowsHide: true }
      );
      child.unref();
      return;
    }
    if (candidate.endsWith('.exe') && fs.existsSync(candidate)) {
      const dir = path.dirname(candidate);
      const child = spawn(candidate, ['serve', '-a', '127.0.0.1', '-p', '7000'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        cwd: dir,
      });
      child.unref();
      return;
    }
  }
  throw new Error('OpenSERP start script/binary missing - run: npm run si-serp:setup');
}

async function waitForHealthy(baseUrl, attempts = 24, intervalMs = 1500) {
  for (let i = 0; i < attempts; i++) {
    if (await probeHealth(baseUrl)) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`OpenSERP did not become healthy at ${baseUrl}`);
}

/**
 * @param {Record<string, string>} [keys]
 */
async function ensureSiSerpSidecar(keys = {}) {
  if (!autostartEnabled()) return;

  const base = pickBaseUrl(keys) || (process.env.SI_SERP_BASE_URL || process.env.OPENSERP_BASE_URL || '').trim().replace(/\/$/, '');
  if (!base || !isLocalBaseUrl(base)) return;

  if (await probeHealth(base)) return;

  const now = Date.now();
  if (now - lastEnsureAt < 5000 && ensureInFlight) {
    await ensureInFlight;
    return;
  }

  if (!ensureInFlight) {
    lastEnsureAt = now;
    ensureInFlight = (async () => {
      spawnSidecarStart();
      await waitForHealthy(base);
    })().finally(() => {
      ensureInFlight = null;
    });
  }

  await ensureInFlight;
}

module.exports = {
  ensureSiSerpSidecar,
  probeHealth,
  isLocalBaseUrl,
};