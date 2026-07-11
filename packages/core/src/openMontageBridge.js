/**
 * OpenMontage bridge — connects Imperial Video Studio to the OpenMontage runtime.
 * https://github.com/calesthio/OpenMontage
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const OM_REPO = 'https://github.com/calesthio/OpenMontage';

function resolveOpenMontageRoot() {
  const candidates = [
    process.env.OPENMONTAGE_ROOT,
    process.env.OPEN_MONTAGE_ROOT,
    path.join(__dirname, '../../../vendor/OpenMontage'),
    path.join(process.cwd(), 'vendor/OpenMontage'),
  ].filter(Boolean);
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, 'README.md')) && fs.existsSync(path.join(root, 'tools'))) {
      return path.resolve(root);
    }
  }
  return null;
}

function resolveFfmpegBin() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  try {
    const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8' });
    const line = String(which.stdout || '').split(/\r?\n/).find((l) => l.trim().endsWith('ffmpeg') || l.includes('ffmpeg.exe'));
    if (line?.trim()) return line.trim();
  } catch { /* ignore */ }
  const winGuess = path.join(
    process.env.LOCALAPPDATA || '',
    'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe',
  );
  if (fs.existsSync(winGuess)) return winGuess;
  return 'ffmpeg';
}

function resolvePythonBin() {
  if (process.env.OPENMONTAGE_PYTHON && fs.existsSync(process.env.OPENMONTAGE_PYTHON)) {
    return process.env.OPENMONTAGE_PYTHON;
  }
  const venvPy = resolveOpenMontageRoot();
  if (venvPy) {
    const winVenv = path.join(venvPy, '.venv/Scripts/python.exe');
    const nixVenv = path.join(venvPy, '.venv/bin/python');
    if (fs.existsSync(winVenv)) return winVenv;
    if (fs.existsSync(nixVenv)) return nixVenv;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function hasRemotionComposer(root) {
  return fs.existsSync(path.join(root, 'remotion-composer/package.json'))
    && fs.existsSync(path.join(root, 'remotion-composer/node_modules'));
}

function hasPythonDeps(root) {
  const py = resolvePythonBin();
  const probe = spawnSync(py, ['-c', 'from tools.tool_registry import registry; registry.discover()'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000,
  });
  return probe.status === 0;
}

function mapSiKeysToOpenMontageEnv(keys = {}) {
  const out = {};
  const map = [
    ['falKey', 'FAL_KEY'],
    ['openai', 'OPENAI_API_KEY'],
    ['openAiKey', 'OPENAI_API_KEY'],
    ['gemini', 'GOOGLE_API_KEY'],
    ['googleApiKey', 'GOOGLE_API_KEY'],
    ['xai', 'XAI_API_KEY'],
    ['grok', 'XAI_API_KEY'],
    ['unsplashAccessKey', 'UNSPLASH_ACCESS_KEY'],
    ['pexelsKey', 'PEXELS_API_KEY'],
    ['pixabayKey', 'PIXABAY_API_KEY'],
    ['elevenlabsKey', 'ELEVENLABS_API_KEY'],
    ['runwayKey', 'RUNWAY_API_KEY'],
    ['heygenKey', 'HEYGEN_API_KEY'],
    ['serpApiKey', 'SERPAPI_API_KEY'],
  ];
  for (const [si, om] of map) {
    if (keys[si]) out[om] = keys[si];
  }
  return out;
}

function syncOpenMontageEnv(keys = {}) {
  const root = resolveOpenMontageRoot();
  if (!root) return { success: false, error: 'OpenMontage not found — run deploy/setup-openmontage.ps1' };
  const mapped = mapSiKeysToOpenMontageEnv(keys);
  const envPath = path.join(root, '.env');
  let existing = '';
  try { existing = fs.readFileSync(envPath, 'utf8'); } catch { /* new */ }
  const lines = existing.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
  const kv = new Map();
  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx > 0) kv.set(line.slice(0, idx).trim(), line.slice(idx + 1));
  }
  for (const [k, v] of Object.entries(mapped)) {
    if (v) kv.set(k, v);
  }
  const body = [...kv.entries()].map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  fs.writeFileSync(envPath, body, 'utf8');
  return { success: true, path: envPath, keysSynced: Object.keys(mapped).length };
}

function getOpenMontageStatus(keys = {}) {
  const root = resolveOpenMontageRoot();
  const ffmpeg = resolveFfmpegBin();
  const ffmpegOk = spawnSync(ffmpeg, ['-version'], { encoding: 'utf8', timeout: 10000 }).status === 0;
  const python = resolvePythonBin();
  const pythonOk = spawnSync(python, ['--version'], { encoding: 'utf8', timeout: 10000 }).status === 0;
  const remotion = root ? hasRemotionComposer(root) : false;
  const pythonDeps = root && pythonOk ? hasPythonDeps(root) : false;
  const hasFal = !!(keys.falKey || process.env.FAL_KEY);
  const composeReady = !!(ffmpegOk);
  const pipelineReady = !!(root && ffmpegOk && pythonOk && (pythonDeps || remotion));
  const lastBananaReady = !!(pipelineReady && hasFal && remotion);
  const issues = [];
  if (!root) issues.push('OpenMontage repo not cloned (vendor/OpenMontage or OPENMONTAGE_ROOT)');
  if (!ffmpegOk) issues.push('FFmpeg not installed — required for final.mp4 render (winget install Gyan.FFmpeg)');
  if (!pythonOk) issues.push('Python 3.10+ not found');
  if (root && !remotion) issues.push('Remotion composer not installed — run: deploy/setup-openmontage.ps1 (npm install in remotion-composer)');
  if (root && !pythonDeps && !remotion) {
    issues.push('OpenMontage Python tools not set up — run: deploy/setup-openmontage.ps1');
  }
  if (!hasFal) issues.push('FAL_KEY missing — Last Banana-style Kling v3 motion clips need fal.ai (Settings → Integrations)');
  const qualityTiers = {
    slideshow: composeReady,
    motionClips: composeReady && hasFal,
    lastBanana: lastBananaReady,
  };
  return {
    connected: !!root,
    ready: pipelineReady,
    composeReady,
    lastBananaReady,
    qualityTiers,
    hasFalKey: hasFal,
    repo: OM_REPO,
    root: root || null,
    ffmpeg: ffmpegOk,
    ffmpegPath: ffmpeg,
    python: pythonOk,
    pythonPath: python,
    remotionComposer: remotion,
    pythonToolRegistry: pythonDeps,
    issues,
    referenceDemo: 'the_last_banana_v3_github.mp4 — 6× Kling v3 clips (fal.ai) + Chirp3 narration + Remotion compose + captions',
    whyNotLastBanana: lastBananaReady ? null : [
      !hasFal && 'Add FAL_KEY for Kling v3 motion (not Ken Burns stills)',
      !remotion && 'Install remotion-composer for OpenMontage final compose',
      !ffmpegOk && 'Install FFmpeg',
      !root && 'Clone OpenMontage (deploy/setup-openmontage.ps1)',
    ].filter(Boolean),
    siGap: pipelineReady
      ? (lastBananaReady ? null : 'SI can render MP4; Last Banana parity needs FAL_KEY + Remotion + OpenMontage video_compose')
      : (root ? 'OpenMontage cloned but runtime incomplete' : 'Clone OpenMontage and install FFmpeg'),
  };
}

function runOpenMontageSetup(opts = {}) {
  const path = require('path');
  const fs = require('fs');
  const repoRoot = path.join(__dirname, '../../../');
  const isWin = process.platform === 'win32';

  if (isWin) {
    const script = path.join(repoRoot, 'deploy/setup-openmontage.ps1');
    if (!fs.existsSync(script)) return { success: false, error: 'deploy/setup-openmontage.ps1 not found' };
    const res = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], {
      encoding: 'utf8',
      timeout: opts.timeoutMs || 600000,
      cwd: repoRoot,
    });
    return {
      success: res.status === 0,
      method: 'setup-openmontage.ps1',
      stdout: (res.stdout || '').slice(-2000),
      error: res.status !== 0 ? (res.stderr || res.stdout || 'Setup failed').slice(0, 800) : null,
      status: getOpenMontageStatus(),
    };
  }

  let root = resolveOpenMontageRoot();
  if (!root && opts.clone !== false) {
    const vendor = path.join(repoRoot, 'vendor/OpenMontage');
    fs.mkdirSync(path.dirname(vendor), { recursive: true });
    const clone = spawnSync('git', ['clone', '--depth', '1', OM_REPO, vendor], {
      encoding: 'utf8',
      timeout: 300000,
    });
    if (clone.status !== 0) {
      return { success: false, error: clone.stderr || 'git clone failed' };
    }
    root = vendor;
  }
  if (!root) return { success: false, error: 'OpenMontage not found — set OPENMONTAGE_ROOT or clone vendor/OpenMontage' };

  const hasMake = spawnSync('make', ['--version'], { encoding: 'utf8', timeout: 5000 }).status === 0;
  if (hasMake && opts.preferMake !== false) {
    const make = spawnSync('make', ['setup'], { cwd: root, encoding: 'utf8', timeout: opts.timeoutMs || 600000 });
    if (make.status === 0) {
      return {
        success: true,
        method: 'make setup',
        root,
        stdout: (make.stdout || '').slice(-2000),
        status: getOpenMontageStatus(),
      };
    }
  }

  const shellScript = path.join(repoRoot, 'deploy/setup-openmontage.sh');
  if (fs.existsSync(shellScript)) {
    const sh = spawnSync('bash', [shellScript], {
      encoding: 'utf8',
      timeout: opts.timeoutMs || 600000,
      cwd: repoRoot,
      env: { ...process.env, OPENMONTAGE_ROOT: root },
    });
    return {
      success: sh.status === 0,
      method: 'setup-openmontage.sh (no make)',
      root,
      stdout: (sh.stdout || '').slice(-2000),
      error: sh.status !== 0 ? (sh.stderr || sh.stdout || 'setup-openmontage.sh failed').slice(0, 800) : null,
      status: getOpenMontageStatus(),
    };
  }

  const py = path.join(root, '.venv/bin/python');
  const pyBin = fs.existsSync(py) ? py : 'python3';
  const steps = [
    spawnSync(pyBin, ['-m', 'venv', '.venv'], { cwd: root, encoding: 'utf8', timeout: 120000 }),
    spawnSync(path.join(root, '.venv/bin/pip'), ['install', '-r', 'requirements.txt'], { cwd: root, shell: true, encoding: 'utf8', timeout: 300000 }),
  ];
  const failed = steps.find((s) => s.status !== 0);
  return {
    success: !failed,
    method: 'manual venv/pip (no make)',
    root,
    error: failed ? (failed.stderr || 'manual setup failed').slice(0, 800) : null,
    status: getOpenMontageStatus(),
  };
}

function runOpenMontagePreflight() {
  const root = resolveOpenMontageRoot();
  if (!root) return { success: false, error: 'OpenMontage root not found' };
  const py = resolvePythonBin();
  const script = `
from tools.tool_registry import registry
import json
registry.discover()
print(json.dumps(registry.provider_menu_summary(), indent=2))
`;
  const res = spawnSync(py, ['-c', script], { cwd: root, encoding: 'utf8', timeout: 60000 });
  if (res.status !== 0) {
    return { success: false, error: res.stderr || res.stdout || 'Preflight failed', status: res.status };
  }
  try {
    return { success: true, menu: JSON.parse(res.stdout) };
  } catch (e) {
    return { success: true, raw: res.stdout };
  }
}

module.exports = {
  OM_REPO,
  resolveOpenMontageRoot,
  resolveFfmpegBin,
  resolvePythonBin,
  mapSiKeysToOpenMontageEnv,
  syncOpenMontageEnv,
  getOpenMontageStatus,
  runOpenMontageSetup,
  runOpenMontagePreflight,
};