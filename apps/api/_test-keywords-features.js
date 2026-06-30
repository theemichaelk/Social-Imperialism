/**
 * Keywords feature QA — all channels used by /keywords
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'https://api.socialimperialism.com';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

const QA_TERM = `qa-kw-${Date.now()}`;

const FEATURES = [
  { area: 'Keywords', name: 'Get keywords', channel: 'get-keywords',
    validate: (d) => Array.isArray(d) },
  { area: 'Keywords', name: 'Save keyword (merge)', channel: 'save-keywords',
    args: [{ merge: true, keywords: [{ term: QA_TERM, platforms: ['LinkedIn'], intent: 'mentions' }] }],
    validate: (d) => d?.success === true },
  { area: 'Keywords', name: 'Keyword persists', channel: 'get-keywords',
    validate: (d) => Array.isArray(d) && d.some((k) => k.term === QA_TERM) },
  { area: 'Keywords', name: 'Generate keywords', channel: 'generate-keywords',
    args: [{ brandName: 'QA Brand', domain: 'qa.com' }],
    validate: (d) => Array.isArray(d) && d.length > 0 },
  { area: 'Keywords', name: 'Research keyword', channel: 'research-keyword', args: ['content marketing'],
    validate: (d) => typeof d === 'object' },
  { area: 'Keywords', name: 'Global custom prompt', channel: 'generate-global-custom-prompt',
    validate: (d) => d?.prompt || d?.customPrompt },
  { area: 'Keywords', name: 'Keyword API status', channel: 'get-keyword-api-status',
    validate: (d) => typeof d === 'object' },
  { area: 'Keywords', name: 'Active campaign', channel: 'get-active-campaign',
    validate: (d) => d && (d.id || d.brandName) },
  { area: 'Keywords', name: 'Delete keyword', channel: 'delete-keyword', args: [{ id: 'nonexistent_qa_kw' }],
    validate: (d) => d?.success === true },
  { area: 'Live', name: 'Section live', channel: 'get-section-live', args: ['keywords'],
    validate: (d) => d?.stats && typeof d.stats === 'object' },
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
  console.log('\n=== KEYWORDS FEATURE QA ===\n');
  const health = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) throw new Error('API not running');

  const { token, projectId } = await login();
  let pass = 0, fail = 0, weak = 0;
  let savedId = '';

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
    if (f.name === 'Keyword persists' && Array.isArray(r.data)) {
      savedId = r.data.find((k) => k.term === QA_TERM)?.id || '';
    }
    const icon = status === 'PASS' ? '✓' : status === 'WEAK' ? '~' : '✗';
    console.log(`${icon} [${f.area}] ${f.name} — ${status}${reason ? ` (${reason})` : ''}`);
    if (status === 'PASS') pass++;
    else if (status === 'WEAK') weak++;
    else fail++;
  }

  if (savedId) {
    await invoke(token, projectId, 'delete-keyword', [savedId]);
  }

  console.log(`\nSUMMARY: PASS=${pass} WEAK=${weak} FAIL=${fail}\n`);
  fs.writeFileSync(
    path.join(__dirname, '.keywords-qa-report.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), summary: { pass, weak, fail } }, null, 2),
  );
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });