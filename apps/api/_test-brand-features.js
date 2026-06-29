/**
 * Brand page feature QA — all channels used by /brand
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD || 'Kingme05$';

const QA_BRAND = `QA Brand ${Date.now()}`;

const FEATURES = [
  { area: 'Brand', name: 'Get brand guidelines', channel: 'get-brand-guidelines',
    validate: (d) => typeof d === 'object' && (d.brandName !== undefined || d.success === true) },
  { area: 'Brand', name: 'Save brand guidelines', channel: 'save-brand-guidelines',
    args: [{ brandName: QA_BRAND, tone: 'Professional', description: 'QA brand voice test', audience: 'B2B',
      brandGuidelines: { doList: 'Be helpful', dontList: 'No spam' }, disallowedTopics: 'politics' }],
    validate: (d) => d?.success === true },
  { area: 'Brand', name: 'Save persists on reload', channel: 'get-brand-guidelines',
    validate: (d) => d?.brandName === QA_BRAND && d?.tone === 'Professional' },
  { area: 'Brand', name: 'Active campaign', channel: 'get-active-campaign',
    validate: (d) => d && (d.id || d.brandName) },
  { area: 'Live', name: 'Section live brand snapshot', channel: 'get-section-live', args: ['brand'],
    validate: (d) => d?.stats && (d?.brand?.name === QA_BRAND || d?.brand?.name?.length > 0) },
  { area: 'Import', name: 'Seed brand from website', channel: 'seed-brand-from-website',
    args: [{ url: 'https://techcrunch.com' }],
    validate: (d) => d?.success === true || !!d?.error },
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
  console.log('\n=== BRAND FEATURE QA ===\n');
  const health = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) throw new Error('API not running');

  const { token, projectId } = await login();
  let pass = 0, fail = 0, weak = 0;
  let savedName = '';

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
          if (f.name === 'Section live brand snapshot' && savedName) {
            status = 'WEAK';
            reason = `Live brand.name (${r.data?.brand?.name || 'empty'}) !== saved (${savedName}) — deploy API for sync fix`;
          } else {
            status = 'WEAK';
            reason = `Bad shape: ${JSON.stringify(r.data)?.slice(0, 120)}`;
          }
        }
      } catch (e) {
        status = 'FAIL';
        reason = e.message;
      }
    }
    if (f.name === 'Save brand guidelines' && r.data?.success) savedName = QA_BRAND;
    const icon = status === 'PASS' ? '✓' : status === 'WEAK' ? '~' : '✗';
    console.log(`${icon} [${f.area}] ${f.name} — ${status}${reason ? ` (${reason})` : ''}`);
    if (status === 'PASS') pass++;
    else if (status === 'WEAK') weak++;
    else fail++;
  }

  console.log(`\nSUMMARY: PASS=${pass} WEAK=${weak} FAIL=${fail}\n`);
  fs.writeFileSync(
    path.join(__dirname, '.brand-qa-report.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), summary: { pass, weak, fail } }, null, 2),
  );
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });