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

async function runBacklotSimulate(opts = {}) {
  const omRoot = resolveOpenMontageRoot();
  if (!omRoot) return { success: false, error: 'OpenMontage not cloned — run deploy/setup-openmontage.ps1' };

  const py = resolvePythonBin();
  const projectId = opts.projectId || 'backlot-demo-run';
  const args = [path.join(omRoot, 'scripts', 'backlot_simulate_run.py'), '--project', projectId];
  if (opts.fast) args.push('--fast');

  const { spawnSync } = require('child_process');
  const res = spawnSync(py, args, {
    cwd: omRoot,
    encoding: 'utf8',
    timeout: opts.timeoutMs || 180000,
  });

  if (res.status !== 0) {
    return {
      success: false,
      error: (res.stderr || res.stdout || 'backlot_simulate_run failed').slice(0, 600),
    };
  }

  let board = null;
  if (opts.openBoard !== false) {
    board = await openBacklotBoard(projectId);
  }

  return {
    success: true,
    projectId,
    message: `Simulated production "${projectId}" written to disk — open Backlot to watch live or replay.`,
    boardUrl: board?.boardUrl || `http://127.0.0.1:${backlotPort()}/p/${projectId}`,
    output: (res.stdout || '').trim().split('\n').slice(-3).join('\n'),
  };
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
    readme: 'vendor/OpenMontage/backlot/README.md',
    cli: [
      'python -m backlot open',
      'python -m backlot open <project-id>',
      'python scripts/backlot_simulate_run.py',
    ],
    features: [
      'Stages light up as the pipeline runs',
      'Script lands as a screenplay page',
      'Scene filmstrip shimmers while assets generate',
      'Storyboard contact sheet — takes, prompts, cost, quality scores',
      'Creative gates hold until you approve',
      '▶ REPLAY RUN when production completes',
    ],
    chatVsBacklot: 'Chat tells you what the agent said. Backlot shows you what the production is actually doing.',
    note: omRoot
      ? (running
        ? 'Backlot derives everything from project files — no agent reporting, no manual UI updates.'
        : 'When a production starts, Backlot opens automatically. Start the server to watch live.')
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
  runBacklotSimulate,
  listBacklotProjects,
  resolveSiProjectDir,
};