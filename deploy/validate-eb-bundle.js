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

const grokSrc = fs.readFileSync(path.join(servicesRoot, 'grokBrowserAutomation.js'), 'utf8');
if (grokSrc.includes("require('../coreRequire')")) {
  errors.push('grokBrowserAutomation.js still uses legacy require(../coreRequire) — SaaS will break');
}
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