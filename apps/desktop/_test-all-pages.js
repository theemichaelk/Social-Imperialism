/**
 * Run all page-level backend tests and produce a combined report.
 * Usage: node _test-all-pages.js [--quick]
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TESTS = [
  { name: 'Dashboard', script: '_test-dashboard.js', report: '.dashboard-test-report.json' },
  { name: 'Browse Posts', script: '_test-browse-posts.js', report: '.browse-posts-test-report.json' },
  { name: 'Content Hub', script: '_test-content-hub.js', report: '.content-hub-test-report.json' },
  { name: 'Setup Wizard', script: '_test-setup-wizard.js', report: '.setup-wizard-test-report.json' },
  { name: 'Content Calendar', script: '_test-content-calendar.js', report: '.content-calendar-test-report.json' },
];

const quick = process.argv.includes('--quick');
const combined = [];
let ok = 0;
let partial = 0;
let fail = 0;

console.log('\n=== SOCIAL IMPERIALISM — ALL PAGE TESTS ===\n');

TESTS.forEach(({ name, script, report }) => {
  console.log(`--- ${name} (${script}) ---`);
  const scriptPath = path.join(ROOT, script);
  if (!fs.existsSync(scriptPath)) {
    console.log(`✗ Script missing: ${script}\n`);
    fail += 1;
    combined.push({ page: name, status: 'MISSING', script });
    return;
  }

  const env = { ...process.env };
  if (quick) env.SI_TEST_QUICK = '1';

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: quick ? 90000 : 300000,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const reportPath = path.join(ROOT, report);
  let features = [];
  if (fs.existsSync(reportPath)) {
    try { features = JSON.parse(fs.readFileSync(reportPath, 'utf8')); } catch (e) { /* ignore */ }
  }

  const counts = { OK: 0, PARTIAL: 0, FAIL: 0 };
  features.forEach((f) => {
    const st = f.status || 'FAIL';
    counts[st] = (counts[st] || 0) + 1;
    if (st === 'OK') ok += 1;
    else if (st === 'PARTIAL') partial += 1;
    else fail += 1;
  });

  const pageStatus = result.status !== 0 ? 'ERROR'
    : counts.FAIL > 0 ? 'FAIL'
    : counts.PARTIAL > 0 ? 'PARTIAL'
    : 'OK';

  console.log(`Page result: ${pageStatus} (OK:${counts.OK} PARTIAL:${counts.PARTIAL} FAIL:${counts.FAIL})\n`);
  combined.push({ page: name, status: pageStatus, counts, features, exitCode: result.status });
});

const summary = {
  timestamp: new Date().toISOString(),
  pages: TESTS.length,
  featuresOk: ok,
  featuresPartial: partial,
  featuresFail: fail,
  results: combined,
};

const outPath = path.join(ROOT, '.all-pages-test-report.json');
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

console.log('=== SUMMARY ===');
console.log(`Features — OK: ${ok} | Partial: ${partial} | Fail: ${fail}`);
console.log(`Combined report: ${outPath}\n`);

process.exit(fail > 0 ? 1 : 0);