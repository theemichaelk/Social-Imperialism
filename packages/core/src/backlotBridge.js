/**
 * Backlot living storyboard bridge — OpenMontage disk-derived production board.
 * https://github.com/calesthio/OpenMontage (python -m backlot)
 */
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { resolveOpenMontageRoot, resolvePythonBin } = require('./openMontageBridge');

const DEFAULT_PORT = 4750;

function backlotPort() {
  const raw = process.env.BACKLOT_PORT || String(DEFAULT_PORT);
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : DEFAULT_PORT;
}

function httpGetJson(urlPath, port = backlotPort(), timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}${urlPath}`, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          reject(new Error(`Backlot JSON parse failed: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Backlot request timeout')); });
  });
}

async function isBacklotRunning(port = backlotPort()) {
  try {
    const res = await httpGetJson('/api/health', port, 2000);
    return res.status === 200 && res.data?.ok === true;
  } catch {
    return false;
  }
}

function startBacklotServer(port = backlotPort()) {
  const omRoot = resolveOpenMontageRoot();
  if (!omRoot) return { success: false, error: 'OpenMontage not cloned — run deploy/setup-openmontage.ps1' };

  const py = resolvePythonBin();
  const child = spawn(py, ['-m', 'backlot', 'serve', '--port', String(port)], {
    cwd: omRoot,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  return { success: true, pid: child.pid, port };
}

async function waitForBacklot(port = backlotPort(), deadlineMs = 15000) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (await isBacklotRunning(port)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function ensureBacklotRunning() {
  const port = backlotPort();
  if (await isBacklotRunning(port)) {
    return { success: true, port, url: `http://127.0.0.1:${port}/`, alreadyRunning: true };
  }
  const started = startBacklotServer(port);
  if (!started.success) return started;
  const up = await waitForBacklot(port);
  if (!up) return { success: false, error: 'Backlot server did not start in time' };
  return { success: true, port, url: `http://127.0.0.1:${port}/`, alreadyRunning: false };
}

async function listBacklotProjects(port = backlotPort()) {
  try {
    const res = await httpGetJson('/api/projects', port);
    if (res.status !== 200) return [];
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

async function getBacklotBoardState(projectId, port = backlotPort()) {
  if (!projectId) return { success: false, error: 'projectId required' };
  try {
    const res = await httpGetJson(`/api/project/${encodeURIComponent(projectId)}/state`, port, 10000);
    if (res.status === 404) return { success: false, error: 'Project not found on Backlot board' };
    if (res.status !== 200) return { success: false, error: `Backlot HTTP ${res.status}` };
    return { success: true, projectId, state: res.data, boardUrl: `http://127.0.0.1:${port}/p/${projectId}` };
  } catch (e) {
    return { success: false, error: e.message || 'Backlot unreachable' };
  }
}

async function getBacklotStatus() {
  const omRoot = resolveOpenMontageRoot();
  const port = backlotPort();
  const running = await isBacklotRunning(port);
  const projects = running ? await listBacklotProjects(port) : [];
  return {
    success: true,
    available: !!omRoot,
    running,
    port,
    baseUrl: running ? `http://127.0.0.1:${port}/` : null,
    openMontageRoot: omRoot,
    projectCount: projects.length,
    projects: projects.slice(0, 12),
    note: omRoot
      ? (running
        ? 'Backlot observes projects/ on disk — pipeline checkpoints update the board live.'
        : 'Start Backlot to watch pipeline stages, script, scene plan, and assets as production runs.')
      : 'Clone OpenMontage to enable the Backlot living storyboard.',
  };
}

async function openBacklotBoard(projectId = null) {
  const ensured = await ensureBacklotRunning();
  if (!ensured.success) return ensured;
  const base = ensured.url.replace(/\/$/, '');
  const boardUrl = projectId ? `${base}/p/${encodeURIComponent(projectId)}` : base;
  return {
    success: true,
    boardUrl,
    port: ensured.port,
    projectId: projectId || null,
    message: projectId
      ? `Backlot board ready for project "${projectId}"`
      : 'Backlot library ready — all projects',
  };
}

function resolveSiProjectDir(projectId) {
  const omRoot = resolveOpenMontageRoot();
  if (!omRoot || !projectId) return null;
  const dir = path.join(omRoot, 'projects', projectId);
  return fs.existsSync(path.join(dir, 'project.json')) ? dir : (fs.existsSync(dir) ? dir : null);
}

module.exports = {
  DEFAULT_PORT,
  backlotPort,
  isBacklotRunning,
  startBacklotServer,
  ensureBacklotRunning,
  getBacklotStatus,
  getBacklotBoardState,
  openBacklotBoard,
  listBacklotProjects,
  resolveSiProjectDir,
};