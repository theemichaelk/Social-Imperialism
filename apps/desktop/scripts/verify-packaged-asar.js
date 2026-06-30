/**
 * Post-build audit: critical monorepo modules must exist inside app.asar.
 * Run automatically via postbuild, or: npm run audit:desktop-packaged
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const desktopRoot = path.join(__dirname, '..');
const asarPath = path.join(desktopRoot, 'dist', 'win-unpacked', 'resources', 'app.asar');
const unpackedExe = path.join(desktopRoot, 'dist', 'win-unpacked', 'Social Imperialism.exe');

function fail(msg) {
  console.error(`[audit:desktop-packaged] ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(asarPath)) {
  fail(`Missing ${asarPath} — run "npm run build" in apps/desktop first.`);
}

let asar;
try {
  asar = require('@electron/asar');
} catch {
  fail('Install @electron/asar (bundled with electron-builder) to verify packaged output.');
}

const files = new Set(asar.listPackage(asarPath));
const required = [
  '\\coreRequire.js',
  '\\index.js',
  '\\registerParityHandlers.js',
  '\\packages\\core\\src\\campaignManager.js',
  '\\packages\\core\\src\\guardianGatekeeper.js',
  '\\packages\\core\\src\\sovereignThreatCapture.js',
  '\\packages\\core\\src\\contentHumanization.js',
  '\\packages\\core\\src\\grokDefaults.js',
  '\\packages\\core\\src\\jobRunner.js',
];

const missing = required.filter((f) => !files.has(f));
if (missing.length) {
  fail(`Missing from app.asar:\n  ${missing.join('\n  ')}`);
}

if (!fs.existsSync(unpackedExe)) {
  fail(`Missing unpacked executable: ${unpackedExe}`);
}

const probe = spawnSync(
  unpackedExe,
  [
    '-e',
    `const path=require('path');
const { coreRequire } = require(path.join(process.resourcesPath,'app.asar','coreRequire.js'));
const ok = !!coreRequire('src/campaignManager').registerCampaignManagerHandlers;
if (!ok) process.exit(2);
console.log('packaged-core-require-ok');`,
  ],
  {
    cwd: desktopRoot,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    encoding: 'utf8',
    timeout: 30000,
  }
);

if (probe.status !== 0) {
  fail(`Packaged coreRequire runtime probe failed (exit ${probe.status}): ${probe.stderr || probe.stdout}`);
}

if (!String(probe.stdout).includes('packaged-core-require-ok')) {
  fail(`Unexpected probe output: ${probe.stdout || probe.stderr}`);
}

console.log(`[audit:desktop-packaged] OK — ${required.length} critical paths, ${files.size} asar entries, runtime probe passed`);