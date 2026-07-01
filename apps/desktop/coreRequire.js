/**
 * Resolve @si/core sources in dev (monorepo), packaged Electron, and EB SaaS.
 * Self-contained — must not require any sibling module (safe for ../coreRequire imports).
 */
const path = require('path');
const fs = require('fs');

const CORE_PROBE = path.join('src', 'campaignManager.js');

function existsCoreRoot(root) {
  return root && fs.existsSync(path.join(root, CORE_PROBE));
}

function collectCoreRootCandidates() {
  const seen = new Set();
  const roots = [];
  const add = (candidate) => {
    if (!candidate) return;
    const normalized = path.normalize(candidate);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    if (existsCoreRoot(normalized)) roots.push(normalized);
  };

  add(path.join(__dirname, '..', '..', 'packages', 'core'));
  add(path.join(__dirname, 'packages', 'core'));
  add(path.join(process.cwd(), 'packages', 'core'));
  add('/var/app/current/packages/core');

  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    add(path.join(dir, 'packages', 'core'));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (process.resourcesPath) {
    add(path.join(process.resourcesPath, 'packages', 'core'));
    add(path.join(process.resourcesPath, 'app.asar', 'packages', 'core'));
  }

  return roots;
}

let cachedRoot = null;

function getCoreRoot() {
  if (cachedRoot) return cachedRoot;
  const roots = collectCoreRootCandidates();
  if (!roots.length) {
    throw new Error(`Cannot locate packages/core (checked from ${__dirname})`);
  }
  cachedRoot = roots[0];
  return cachedRoot;
}

function coreRequire(relativePath) {
  const sub = String(relativePath || '').replace(/^\.\//, '');
  const root = getCoreRoot();
  const target = sub.startsWith('src/')
    ? path.join(root, sub)
    : path.join(root, 'src', sub);
  return require(target);
}

function loadCoreModule(subpath) {
  try {
    return coreRequire(subpath);
  } catch (err) {
    const normalized = String(subpath || '').replace(/^\.\//, '').replace(/^src\//, '');
    const fallback = path.join(__dirname, '..', '..', 'packages', 'core', 'src', normalized);
    return require(fallback);
  }
}

module.exports = { coreRequire, getCoreRoot, loadCoreModule, collectCoreRootCandidates };