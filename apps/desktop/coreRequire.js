/**
 * Resolve @si/core sources in dev (monorepo) and packaged Electron builds.
 */
const path = require('path');
const fs = require('fs');

let coreRoot = null;

function getCoreRoot() {
  if (coreRoot) return coreRoot;
  const candidates = [
    path.join(__dirname, 'packages', 'core'),
    path.join(__dirname, '..', '..', 'packages', 'core'),
    path.join(process.resourcesPath || '', 'packages', 'core'),
  ];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, 'src', 'campaignManager.js'))) {
      coreRoot = root;
      return coreRoot;
    }
  }
  throw new Error(`Cannot locate packages/core (checked: ${candidates.join('; ')})`);
}

function coreRequire(relativePath) {
  const sub = String(relativePath || '').replace(/^\.\//, '');
  return require(path.join(getCoreRoot(), sub));
}

module.exports = { coreRequire, getCoreRoot };