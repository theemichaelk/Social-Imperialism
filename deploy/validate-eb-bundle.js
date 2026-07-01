/**
 * Pre-deploy validation for EB API bundle — catches missing coreRequire / broken handler chain.
 * Usage: node deploy/validate-eb-bundle.js <stagingRoot>
 */
const fs = require('fs');
const path = require('path');

const stagingRoot = process.argv[2];
if (!stagingRoot || !fs.existsSync(stagingRoot)) {
  console.error('Usage: node deploy/validate-eb-bundle.js <stagingRoot>');
  process.exit(1);
}

const desktopRoot = path.join(stagingRoot, 'apps', 'desktop');
const servicesRoot = path.join(desktopRoot, 'services');
const coreRoot = path.join(stagingRoot, 'packages', 'core');
const errors = [];

function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

assert(fs.existsSync(path.join(stagingRoot, 'packages', 'core', 'src', 'handlerRegistry.js')), 'packages/core missing from bundle');
assert(fs.existsSync(path.join(servicesRoot, 'safeCoreRequire.js')), 'apps/desktop/services/safeCoreRequire.js missing');
assert(fs.existsSync(path.join(coreRoot, 'src', 'grokDefaults.js')), 'packages/core/src/grokDefaults.js missing');

const coreRequirePath = path.join(desktopRoot, 'coreRequire.js');
assert(fs.existsSync(coreRequirePath), 'apps/desktop/coreRequire.js missing — copy step failed');

process.chdir(stagingRoot);

try {
  const { loadCoreModule } = require(path.join(servicesRoot, 'safeCoreRequire'));
  const defaults = loadCoreModule('src/grokDefaults');
  assert(defaults?.GROK_DEFAULTS, 'safeCoreRequire could not load grokDefaults');
} catch (e) {
  errors.push(`safeCoreRequire probe failed: ${e.message}`);
}

try {
  require(path.join(servicesRoot, 'grokBrowserAutomation'));
} catch (e) {
  errors.push(`grokBrowserAutomation load failed: ${e.message}`);
}

(async () => {
  try {
    const { registerAllHandlers } = require(path.join(coreRoot, 'src', 'handlerRegistry'));
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
    errors.forEach((e) => console.error(' -', e));
    process.exit(1);
  }
  console.log('EB bundle validation OK');
})();