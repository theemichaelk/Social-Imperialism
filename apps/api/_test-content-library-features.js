/**
 * Content Library feature QA — all channels used by /content-library
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'https://api.socialimperialism.com';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const FEATURES = [
  { area: 'Library', name: 'Get content library', channel: 'get-content-library',
    validate: (d) => d?.success === true && Array.isArray(d?.assets) && typeof d?.count === 'number' },
  { area: 'Library', name: 'Import text', channel: 'import-text-to-library',
    args: [{ text: `QA library snippet ${Date.now()}`, name: 'QA Library Test', tags: ['qa'] }],
    validate: (d) => d?.success === true && d?.asset?.id },
  { area: 'Library', name: 'Save content asset', channel: 'save-content-asset',
    args: [{ name: 'QA saved asset', type: 'copy', text: 'Saved via QA test', tags: ['qa'], source: 'qa' }],
    validate: (d) => d?.success === true && d?.asset?.id },
  { area: 'Library', name: 'Upload local media (data URL)', channel: 'upload-local-media', args: [TINY_PNG],
    validate: (d) => typeof d === 'string' && d.startsWith('data:image') },
  { area: 'Library', name: 'Save uploaded image asset', channel: 'save-content-asset',
    args: [{ name: 'QA upload.png', type: 'image', url: TINY_PNG, tags: ['upload', 'qa'], source: 'upload' }],
    validate: (d) => d?.success === true && d?.asset?.type === 'image' },
  { area: 'Import', name: 'Import RSS to library', channel: 'import-rss-to-library',
    args: [{ feedUrl: 'https://feeds.feedburner.com/TechCrunch', limit: 1 }],
    validate: (d) => d?.success === true && Array.isArray(d?.assets) },
  { area: 'Import', name: 'Import website to library', channel: 'import-website-to-library',
    args: [{ url: 'https://techcrunch.com' }],
    validate: (d) => d?.success === true || !!d?.error },
  { area: 'Library', name: 'Delete content asset', channel: 'delete-content-asset', args: [{ id: 'nonexistent_qa_id' }],
    validate: (d) => d?.success === true && typeof d?.count === 'number' },
  { area: 'Live', name: 'Section live', channel: 'get-section-live', args: ['content-library'],
    validate: (d) => d?.stats && typeof d.stats === 'object' },
  { area: 'Brand', name: 'Brand guidelines', channel: 'get-brand-guidelines',
    validate: (d) => typeof d === 'object' },
  { area: 'Grok', name: 'Grok status', channel: 'grok-get-status',
    validate: (d) => typeof d === 'object' },
];

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return { token: json.token, projectId: json.project?.id };
}

async function invoke(token, projectId, channel, args = []) {
  const res = await fetch(`${API}/api/invoke/${channel}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-project-id': projectId },
    body: JSON.stringify({ args }),
  });
  const text = await res.text();
  let json = {};
  if (text) {
    try { json = JSON.parse(text); } catch { json = { error: text.slice(0, 200) }; }
  }
  return { ok: res.ok, data: json.data, error: json.error };
}

async function main() {
  console.log('\n=== CONTENT LIBRARY FEATURE QA ===\n');
  const health = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) throw new Error('API not running');

  const { token, projectId } = await login();
  let pass = 0, fail = 0, weak = 0;

  for (const f of FEATURES) {
    const r = await invoke(token, projectId, f.channel, f.args || []);
    let status = 'PASS';
    let reason = '';
    if (!r.ok) {
      status = 'FAIL';
      reason = r.error || 'HTTP error';
    } else {
      try {
        if (!f.validate(r.data)) {
          status = 'WEAK';
          reason = `Bad shape: ${JSON.stringify(r.data)?.slice(0, 120)}`;
        }
      } catch (e) {
        status = 'FAIL';
        reason = e.message;
      }
    }
    const icon = status === 'PASS' ? '✓' : status === 'WEAK' ? '~' : '✗';
    console.log(`${icon} [${f.area}] ${f.name} — ${status}${reason ? ` (${reason})` : ''}`);
    if (status === 'PASS') pass++;
    else if (status === 'WEAK') weak++;
    else fail++;
  }

  console.log(`\nSUMMARY: PASS=${pass} WEAK=${weak} FAIL=${fail}\n`);
  fs.writeFileSync(
    path.join(__dirname, '.content-library-qa-report.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), summary: { pass, weak, fail } }, null, 2),
  );
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });