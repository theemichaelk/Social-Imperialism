/**
 * Auto-append QP (Quick Path) Floci local storage env vars to apps/api/.env
 * when missing. Never overwrites non-empty existing values.
 *
 * Usage:
 *   node deploy/ensure-qp-env.js
 *   node deploy/ensure-qp-env.js --force-provider   # also set STORAGE_PROVIDER=floci if set to something else
 *   node deploy/ensure-qp-env.js --desktop          # also apps/desktop/.env
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MARKER = '# ─── QP: Social Imperialism local Floci storage ───';

const QP_DEFAULTS = {
  STORAGE_PROVIDER: 'floci',
  SI_STORAGE_PROVIDER: 'floci',
  FLOCI_ENDPOINT: 'http://127.0.0.1:4566',
  AWS_S3_ENDPOINT: 'http://127.0.0.1:4566',
  AWS_S3_FORCE_PATH_STYLE: 'true',
  FLOCI_DEFAULT_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  AWS_S3_ACCESS_KEY_ID: 'test',
  AWS_S3_SECRET_ACCESS_KEY: 'test',
  AWS_S3_BUCKET_NAME: 'social-imperialism',
  FLOCI_S3_BUCKET: 'social-imperialism',
  AWS_S3_REGION: 'us-east-1',
  AWS_S3_UPLOAD_PREFIX: 'social-imperialism/uploads',
  AWS_S3_PUBLIC_BASE_URL: 'http://127.0.0.1:4566/social-imperialism',
  WEB_URL: 'http://localhost:3000',
  ALLOWED_ORIGINS: 'http://localhost:3000',
  API_PORT: '4000',
  PORT: '4000',
};

// Keys that may already be set for production — only fill when empty/missing
const SOFT_KEYS = new Set([
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_ACCESS_KEY_ID',
  'AWS_S3_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET_NAME',
  'AWS_S3_REGION',
  'AWS_S3_UPLOAD_PREFIX',
  'AWS_S3_PUBLIC_BASE_URL',
  'WEB_URL',
  'ALLOWED_ORIGINS',
  'API_PORT',
  'PORT',
]);

function parseArgs(argv) {
  return {
    forceProvider: argv.includes('--force-provider'),
    desktop: argv.includes('--desktop'),
    dryRun: argv.includes('--dry-run'),
  };
}

function parseEnvFile(text) {
  const map = new Map();
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

function needsValue(existing, key, forceProvider) {
  const cur = existing.get(key);
  const empty = cur == null || String(cur).trim() === '';
  if (empty) return true;
  // Only STORAGE_* may be forced to floci; never clobber real AWS/R2 secrets.
  if (
    forceProvider
    && (key === 'STORAGE_PROVIDER' || key === 'SI_STORAGE_PROVIDER')
    && String(cur).toLowerCase() !== 'floci'
  ) {
    return true;
  }
  return false;
}

function ensureFile(envPath, opts) {
  const exists = fs.existsSync(envPath);
  let raw = exists ? fs.readFileSync(envPath, 'utf8') : '';
  // If missing entirely, seed from example when available
  if (!exists) {
    const example = path.join(path.dirname(envPath), '.env.example');
    if (fs.existsSync(example)) {
      raw = fs.readFileSync(example, 'utf8');
      console.log(`[qp] seeded ${path.relative(ROOT, envPath)} from .env.example`);
    }
  }

  const existing = parseEnvFile(raw);
  const unique = [];
  const seen = new Set();
  for (const [key, def] of Object.entries(QP_DEFAULTS)) {
    if (!needsValue(existing, key, opts.forceProvider)) continue;
    // Soft keys already non-empty are skipped by needsValue (empty only).
    // Critical FLOCI routing keys always eligible when empty or force-provider.
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push([key, def]);
  }
  void SOFT_KEYS; // documented: soft keys only fill when empty via needsValue

  if (!unique.length) {
    console.log(`[qp] ${path.relative(ROOT, envPath)} already has QP keys — no changes`);
    return { changed: false, added: [] };
  }

  // Remove empty assignments for keys we will rewrite
  let next = raw;
  for (const [key] of unique) {
    const re = new RegExp(`^${key}=.*$`, 'gm');
    next = next.replace(re, '');
  }
  next = next.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');

  const blockLines = [
    '',
    MARKER,
    '# Auto-managed by deploy/ensure-qp-env.js — local free Floci S3 (no Amplify/S3 burn).',
    '# Go-live: set STORAGE_PROVIDER=auto|r2|s3 and clear FLOCI_ENDPOINT / AWS_S3_ENDPOINT on EB.',
    ...unique.map(([k, v]) => `${k}=${v}`),
    '',
  ];

  if (!next.includes(MARKER)) {
    next = `${next}${next.endsWith('\n') || !next ? '' : '\n'}${blockLines.join('\n')}`;
  } else {
    // Append new keys under marker section end (simplest: append block again with only new keys)
    next = `${next}${next.endsWith('\n') ? '' : '\n'}${blockLines.join('\n')}`;
  }

  if (opts.dryRun) {
    console.log(`[qp] dry-run would add to ${path.relative(ROOT, envPath)}:`, unique.map(([k]) => k).join(', '));
    return { changed: false, added: unique.map(([k]) => k) };
  }

  fs.writeFileSync(envPath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
  console.log(`[qp] updated ${path.relative(ROOT, envPath)} — added/filled: ${unique.map(([k]) => k).join(', ')}`);
  return { changed: true, added: unique.map(([k]) => k) };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const targets = [path.join(ROOT, 'apps', 'api', '.env')];
  if (opts.desktop) targets.push(path.join(ROOT, 'apps', 'desktop', '.env'));

  let any = false;
  for (const t of targets) {
    const r = ensureFile(t, opts);
    if (r.changed) any = true;
  }
  process.exitCode = 0;
  if (!any) console.log('[qp] ready');
}

main();
