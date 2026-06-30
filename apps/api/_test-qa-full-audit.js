/**
 * Full release audit — accuracy, sovereign scan, unit tests, production QA.
 * Usage: API_URL=https://api.socialimperialism.com node apps/api/_test-qa-full-audit.js
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const API = process.env.API_URL || 'https://api.socialimperialism.com';

const STEPS = [
  { name: 'Audit accuracy', cmd: 'npm', args: ['run', 'audit:accuracy'], cwd: ROOT },
  { name: 'Sovereign scan', cmd: 'npm', args: ['run', 'test:sovereign-scan'], cwd: ROOT },
  { name: 'Verified nodes', cmd: 'npm', args: ['run', 'test:verified-nodes'], cwd: ROOT },
  { name: 'Campaign manager', cmd: 'node', args: ['apps/api/_test-campaign-manager.js'], cwd: ROOT, env: { API_URL: API } },
  { name: 'QA all pages', cmd: 'node', args: ['apps/api/_test-qa-all-pages.js'], cwd: ROOT, env: { API_URL: API } },
  { name: 'QA all sections', cmd: 'node', args: ['apps/api/_test-qa-all-sections.js'], cwd: ROOT, env: { API_URL: API } },
];

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  SOCIAL IMPERIALISM v1.2.1 — FULL RELEASE AUDIT          ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`API: ${API}\n`);

const failures = [];

for (const step of STEPS) {
  process.stdout.write(`── ${step.name}… `);
  const env = { ...process.env, ...(step.env || {}) };
  const res = spawnSync(step.cmd, step.args, { cwd: step.cwd, env, encoding: 'utf8', shell: true });
  if (res.status === 0) {
    console.log('OK');
  } else {
    console.log('FAIL');
    failures.push({ step: step.name, code: res.status, stderr: (res.stderr || res.stdout || '').slice(-400) });
  }
}

if (failures.length) {
  console.log(`\nFAILED: ${failures.length} step(s)`);
  failures.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.step} (exit ${f.code})`);
    if (f.stderr) console.log(f.stderr);
  });
  process.exit(1);
}

console.log('\n✓ Full release audit passed — ready to ship v1.2.1\n');
process.exit(0);