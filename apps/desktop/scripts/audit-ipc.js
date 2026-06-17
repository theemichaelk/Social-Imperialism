#!/usr/bin/env node
/**
 * CLI audit: map each sidebar HTML page → ipcRenderer.invoke channels → registered handlers.
 * Run: node scripts/audit-ipc.js
 */
const fs = require('fs');
const path = require('path');
const {
  NAV_SECTIONS,
  extractInvokeChannels,
} = require('../services/pageHealthCheck');

const ROOT = path.join(__dirname, '..');

function scanIndexHandlers() {
  const indexSrc = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
  const fromIndex = new Set();
  const re = /ipcMain\.handle\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(indexSrc)) !== null) fromIndex.add(m[1]);

  const serviceDir = path.join(ROOT, 'services');
  fs.readdirSync(serviceDir).filter((f) => f.endsWith('Ipc.js') || f === 'pageHealthCheck.js').forEach((file) => {
    const src = fs.readFileSync(path.join(serviceDir, file), 'utf8');
    while ((m = re.exec(src)) !== null) fromIndex.add(m[1]);
  });

  return fromIndex;
}

function main() {
  const registered = scanIndexHandlers();
  let totalMissing = 0;

  console.log('Social Imperialism — Sidebar IPC Audit\n');

  NAV_SECTIONS.forEach((section) => {
    const htmlPath = path.join(ROOT, section.html);
    if (!fs.existsSync(htmlPath)) {
      console.log(`[BROKEN] ${section.label}: missing ${section.html}`);
      totalMissing += 1;
      return;
    }

    const channels = extractInvokeChannels(fs.readFileSync(htmlPath, 'utf8'));
    const missing = channels.filter((ch) => !registered.has(ch));

    const status = missing.length ? 'BROKEN' : 'OK';
    console.log(`[${status}] ${section.label} (${section.html}) — ${channels.length} invoke(s)`);
    if (missing.length) {
      missing.forEach((ch) => console.log(`    ✗ ${ch}`));
      totalMissing += missing.length;
    }
  });

  console.log(`\nRegistered handlers (static scan): ${registered.size}`);
  console.log(totalMissing === 0 ? '\nAll sidebar pages fully wired.' : `\n${totalMissing} missing handler(s) found.`);
  process.exit(totalMissing > 0 ? 1 : 0);
}

main();