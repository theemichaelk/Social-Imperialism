const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT, 'src', 'app', 'api');
const API_STASH = path.join(ROOT, 'src', 'app', '_api_export_stash');
const NEXT_DIR = path.join(ROOT, '.next');
const OUT_DIR = path.join(ROOT, 'out');

function rmSafe(target) {
  if (!fs.existsSync(target)) return;
  try {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch {
    execSync(`cmd /c rmdir /s /q "${target}"`, { stdio: 'ignore', shell: true });
  }
}

process.env.STATIC_EXPORT = '1';

// Avoid EINVAL/ENOENT failures when Next tries to purge a stale OneDrive cache.
rmSafe(NEXT_DIR);
rmSafe(OUT_DIR);

// API route handlers are incompatible with output: 'export' — stash during static build.
let stashed = false;
if (fs.existsSync(API_DIR)) {
  if (fs.existsSync(API_STASH)) fs.rmSync(API_STASH, { recursive: true, force: true });
  fs.renameSync(API_DIR, API_STASH);
  stashed = true;
}

function runExportBuild() {
  execSync('npx next build', { stdio: 'inherit', env: process.env, shell: true, cwd: ROOT });
}

try {
  try {
    runExportBuild();
  } catch (firstErr) {
    console.warn('\n[build-export] First attempt failed — cleaning .next/out and retrying once…');
    rmSafe(NEXT_DIR);
    rmSafe(OUT_DIR);
    runExportBuild();
  }
} finally {
  if (stashed && fs.existsSync(API_STASH)) {
    if (fs.existsSync(API_DIR)) fs.rmSync(API_DIR, { recursive: true, force: true });
    fs.renameSync(API_STASH, API_DIR);
  }
}