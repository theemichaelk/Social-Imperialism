#!/usr/bin/env node
/**
 * Install local OpenSERP binary for Social Imperialism desktop.
 * Prefers the patched build from openserp-study, then Quantum-Page-AI tools.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_ROOT = path.resolve(__dirname, '..');
const INSTALL_DIR = path.join(DESKTOP_ROOT, 'tools', 'openserp');
const EXE_DEST = path.join(INSTALL_DIR, 'openserp.exe');
const CONFIG_DEST = path.join(INSTALL_DIR, 'config.yaml');
const ENV_PATH = path.join(DESKTOP_ROOT, '.env');
const BASE_URL = 'http://127.0.0.1:7000';

const SOURCE_CANDIDATES = [
  'C:\\Users\\PC54\\openserp-study\\openserp.exe',
  'C:\\Users\\PC54\\openserp-study\\config.yaml',
  'E:\\OneDrive\\Documents\\Factory AI.02.20.26\\Quantum-Page-AI\\tools\\quantum-serp\\openserp.exe',
  'E:\\OneDrive\\Documents\\Factory AI.02.20.26\\Quantum-Page-AI\\tools\\quantum-serp\\config.yaml',
];

function upsertEnv(key, value) {
  const lines = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8').split('\n') : [];
  let found = false;
  const out = lines.map((line) => {
    if (line.trim().startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    if (out.length && out[out.length - 1] !== '') out.push('');
    out.push('# Social Imperialism SERP — local OpenSERP sidecar');
    out.push(`${key}=${value}`);
  }
  fs.writeFileSync(ENV_PATH, `${out.join('\n').replace(/\n+$/, '\n')}`, 'utf8');
}

fs.mkdirSync(INSTALL_DIR, { recursive: true });

const exeSource = SOURCE_CANDIDATES.find((p) => p.endsWith('.exe') && fs.existsSync(p));
if (!exeSource) {
  console.error('No openserp.exe found. Build at C:\\Users\\PC54\\openserp-study first.');
  process.exit(1);
}

fs.copyFileSync(exeSource, EXE_DEST);
console.log(`Copied: ${exeSource} -> ${EXE_DEST}`);

const cfgSource = SOURCE_CANDIDATES.find((p) => p.endsWith('config.yaml') && fs.existsSync(p));
if (cfgSource) {
  fs.copyFileSync(cfgSource, CONFIG_DEST);
  console.log(`Copied config: ${cfgSource}`);
}

upsertEnv('SI_SERP_BASE_URL', BASE_URL);
upsertEnv('SI_SERP_DEFAULT_ENGINE', 'bing');
upsertEnv('SI_SERP_AUTOSTART', 'true');

console.log(`Configured ${ENV_PATH}`);
console.log(`SI_SERP_BASE_URL=${BASE_URL}`);
console.log('Start: npm run si-serp:start');
console.log('Always-on: npm run si-serp:install-autostart');