#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { createRequire } = await import('module');
const require = createRequire(import.meta.url);
const { resolveKeys } = require('../services/keys.js');
const { serpSearch, getSerpProviderStatusAsync } = require('../../../packages/core/src/serpProvider.js');
const { ensureSiSerpSidecar } = require('../../../packages/core/src/siSerpSidecar.js');

const base = (process.env.SI_SERP_BASE_URL || 'http://127.0.0.1:7000').replace(/\/$/, '');
const keys = resolveKeys({});
const engines = ['bing', 'yahoo', 'duckduckgo'];

console.log(`Probing ${base} via Social Imperialism SERP client ...`);

await ensureSiSerpSidecar(keys);

try {
  const health = await axios.get(`${base}/health`, { timeout: 8000 });
  console.log('OK: /health', health.data?.status || health.status);
} catch (e) {
  console.error('FAIL: /health', e.message);
  process.exit(1);
}

const status = await getSerpProviderStatusAsync(keys);
console.log('Provider:', status.active, '| configured:', status.configured, '| healthy:', status.healthy);

if (!status.configured) {
  console.error('FAIL: SI_SERP_BASE_URL not configured');
  process.exit(1);
}

let failed = 0;
for (const engine of engines) {
  try {
    const res = await serpSearch(keys, { query: 'social media automation', engine, limit: 3 });
    const count = res.data?.length ?? 0;
    if (!res.success || count === 0) {
      console.log(`WARN: ${engine} - ${res.error || res.note || 'no results'}`);
      failed++;
    } else {
      console.log(`OK: ${engine} - ${count} result(s) via ${res.provider}`);
    }
  } catch (e) {
    console.log(`FAIL: ${engine} - ${e.message}`);
    failed++;
  }
}

try {
  const google = await serpSearch(keys, { query: 'social media automation', engine: 'google', limit: 2 });
  if (!google.success || google.data?.length === 0) {
    console.log(`WARN: google - ${google.error || 'captcha or empty (expected without proxies)'}`);
  } else {
    console.log(`OK: google - ${google.data.length} result(s)`);
  }
} catch (e) {
  console.log(`WARN: google - ${e.message}`);
}

if (failed > 1) {
  console.error('\nToo many engine failures');
  process.exit(1);
}
console.log('\nSocial Imperialism SERP live verification passed');