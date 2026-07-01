/**
 * Pre-deploy validation for EB API bundle.
 * Usage: node deploy/validate-eb-bundle.js <stagingRoot>
 */
const fs = require('fs');
const path = require('path');

const stagingRoot = process.argv[2];
const repoRoot = path.join(__dirname, '..');

if (!stagingRoot || !fs.existsSync(stagingRoot)) {
  console.error('Usage: node deploy/validate-eb-bundle.js <stagingRoot>');
  process.exit(1);
}

const errors = [];

function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

const desktopRoot = path.join(stagingRoot, 'apps', 'desktop');
const servicesRoot = path.join(desktopRoot, 'services');
const coreRoot = path.join(stagingRoot, 'packages', 'core');

assert(fs.existsSync(path.join(coreRoot, 'src', 'handlerRegistry.js')), 'packages/core missing from bundle');
assert(fs.existsSync(path.join(servicesRoot, 'safeCoreRequire.js')), 'apps/desktop/services/safeCoreRequire.js missing');
assert(fs.existsSync(path.join(desktopRoot, 'coreRequire.js')), 'apps/desktop/coreRequire.js missing');

function walkJsFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsFiles(full, files);
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

for (const file of walkJsFiles(servicesRoot)) {
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes("require('../coreRequire')") || src.includes('require("../../coreRequire")')) {
    errors.push(`legacy coreRequire import in ${path.relative(stagingRoot, file)}`);
  }
}

const grokSrc = fs.readFileSync(path.join(servicesRoot, 'grokBrowserAutomation.js'), 'utf8');
if (!grokSrc.includes('safeCoreRequire')) {
  errors.push('grokBrowserAutomation.js must import ./safeCoreRequire');
}

try {
  const stagingCore = require(path.join(desktopRoot, 'coreRequire.js'));
  const defaults = stagingCore.loadCoreModule('src/grokDefaults');
  assert(defaults?.GROK_DEFAULTS, 'staging coreRequire.js could not load grokDefaults');
} catch (e) {
  errors.push(`staging coreRequire.js probe failed: ${e.message}`);
}

try {
  require(path.join(repoRoot, 'apps/desktop/services/grokBrowserAutomation'));
} catch (e) {
  errors.push(`grokBrowserAutomation load failed: ${e.message}`);
}

(async () => {
  try {
    const { registerAllHandlers } = require(path.join(repoRoot, 'packages/core/src/handlerRegistry'));
    const store = { getItem: () => null, setItem: () => {} };
    const { handlers } = await registerAllHandlers(store);
    const required = ['get-setup-status', 'get-section-live', 'check-api-status', 'save-settings'];
    for (const ch of required) {
      if (!handlers[ch]) errors.push(`handler missing after registry: ${ch}`);
    }
    assert(Object.keys(handlers).length >= 300, `expected 300+ handlers, got ${Object.keys(handlers).length}`);
  } catch (e) {
    errors.push(`registerAllHandlers failed: ${e.message}`);
  }

  if (errors.length) {
    console.error('EB bundle validation FAILED:');
    errors.forEach((err) => console.error(' -', err));
    process.exit(1);
  }
  console.log('EB bundle validation OK');
})();