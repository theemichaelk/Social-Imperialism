/**
 * Pre-build check: packages/core must be bundleable for Electron.
 */
const fs = require('fs');
const path = require('path');

const coreSrc = path.join(__dirname, '../../../packages/core/src/campaignManager.js');
if (!fs.existsSync(coreSrc)) {
  console.error('[desktop] Missing monorepo packages/core — build from repo root.');
  process.exit(1);
}
console.log('[desktop] packages/core present for packaging');