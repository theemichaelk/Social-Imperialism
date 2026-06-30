/**
 * Static audit of every HTML page — sidebar, IPC wiring, syntax, nav coverage.
 * Run: node _audit-all-pages.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  NAV_SECTIONS,
  extractInvokeChannels,
  getRegisteredIpcChannels,
} = require('./services/pageHealthCheck');

const ROOT = __dirname;
const ALL_HTML = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const NAV_HTML = new Set(NAV_SECTIONS.map((s) => s.html));
const EXEMPT_NO_SIDEBAR = new Set(['login.html', 'extracted.html']);

function collectRegisteredIpc() {
  const channels = new Set();
  const files = [
    'index.js',
    'registerParityHandlers.js',
    ...fs.readdirSync(path.join(ROOT, 'services')).filter((f) => f.endsWith('.js')).map((f) => `services/${f}`),
    path.join(ROOT, '../../packages/core/src/campaignManager.js'),
    path.join(ROOT, '../../packages/core/src/coreHandlers.js'),
    path.join(ROOT, '../../packages/core/src/indexHandlers.js'),
    path.join(ROOT, '../../packages/core/src/handlerRegistry.js'),
  ];
  const re = /ipcMain\.handle\(\s*['"]([^'"]+)['"]/g;
  files.forEach((rel) => {
    const fp = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
    if (!fs.existsSync(fp)) return;
    const content = fs.readFileSync(fp, 'utf8');
    let m;
    while ((m = re.exec(content)) !== null) channels.add(m[1]);
  });
  return channels;
}

function checkInlineSyntax(file) {
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const scripts = [];
  const re = /<script>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (m[1].trim()) scripts.push(m[1]);
  }
  if (!scripts.length) return { ok: true, detail: 'no inline script blocks' };
  const tmp = path.join(ROOT, '.audit-syntax-tmp.js');
  try {
    fs.writeFileSync(tmp, scripts.join('\n'), 'utf8');
    execSync(`node -c "${tmp}"`, { stdio: 'pipe' });
    return { ok: true, detail: `${scripts.length} script block(s) OK` };
  } catch (e) {
    return { ok: false, detail: e.stderr?.toString().split('\n')[0] || e.message };
  } finally {
    try { fs.unlinkSync(tmp); } catch (err) { /* ignore */ }
  }
}

function auditPage(file) {
  const fp = path.join(ROOT, file);
  const content = fs.readFileSync(fp, 'utf8');
  const issues = [];
  const hints = [];

  const hasSidebar = content.includes('mountAppSidebar') || content.includes('sidebar-nav.css');
  if (!EXEMPT_NO_SIDEBAR.has(file) && !hasSidebar) {
    issues.push('Missing sidebar-nav integration');
  }

  const isNavPage = NAV_HTML.has(file) || file === 'scheduler.html';
  if (!isNavPage && !EXEMPT_NO_SIDEBAR.has(file)) {
    hints.push('Not in sidebar NAV_SECTIONS (may be legacy/dev page)');
  }

  if (file === 'scheduler.html' && !content.includes('calendar.html')) {
    issues.push('Scheduler should redirect to calendar.html');
  }

  const ipcChannels = extractInvokeChannels(content);
  const registered = collectRegisteredIpc();
  const missingIpc = ipcChannels.filter((ch) => !registered.has(ch));

  const syntax = checkInlineSyntax(file);
  if (!syntax.ok) issues.push(`JS syntax: ${syntax.detail}`);

  let status = 'ok';
  if (issues.length) status = 'broken';
  else if (hints.length || missingIpc.length) status = 'warn';

  return {
    file,
    status,
    hasSidebar,
    ipcCallCount: ipcChannels.length,
    missingIpc,
    syntax: syntax.ok ? 'OK' : 'FAIL',
    issues,
    hints,
  };
}

const registered = collectRegisteredIpc();
const results = ALL_HTML.map(auditPage);
const summary = {
  total: results.length,
  ok: results.filter((r) => r.status === 'ok').length,
  warn: results.filter((r) => r.status === 'warn').length,
  broken: results.filter((r) => r.status === 'broken').length,
  navSections: NAV_SECTIONS.length,
  registeredIpcCount: registered.size,
  timestamp: new Date().toISOString(),
};

console.log('\n=== SOCIAL IMPERIALISM — ALL PAGES AUDIT ===\n');
console.log(`Pages: ${summary.total} | OK: ${summary.ok} | Warn: ${summary.warn} | Broken: ${summary.broken}`);
console.log(`Nav sections: ${summary.navSections} | Registered IPC: ${summary.registeredIpcCount}\n`);

results.forEach((r) => {
  const icon = r.status === 'ok' ? '✓' : r.status === 'warn' ? '~' : '✗';
  console.log(`${icon} ${r.file} [${r.status}] sidebar=${r.hasSidebar} ipc=${r.ipcCallCount} syntax=${r.syntax}`);
  r.issues.forEach((i) => console.log(`    ✗ ${i}`));
  r.missingIpc.forEach((ch) => console.log(`    ~ unregistered IPC: ${ch}`));
  r.hints.forEach((h) => console.log(`    · ${h}`));
});

const reportPath = path.join(ROOT, '.all-pages-audit.json');
fs.writeFileSync(reportPath, JSON.stringify({ summary, pages: results, navSections: NAV_SECTIONS }, null, 2));
console.log(`\nReport saved: ${reportPath}\n`);