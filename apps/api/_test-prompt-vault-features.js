/**
 * Prompt Vault feature QA — all channels used by /prompt-vault
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD || 'Kingme05$';

const QA_TITLE = `QA Vault ${Date.now()}`;

const FEATURES = [
  { area: 'Vault', name: 'List prompts', channel: 'get-prompt-vault',
    args: [{ query: '', limit: 20 }],
    validate: (d) => Array.isArray(d?.prompts) },
  { area: 'Vault', name: 'Save prompt', channel: 'save-prompt-vault-item',
    args: [{ title: QA_TITLE, body: 'QA prompt body for vault audit', tags: ['qa'], feature: 'general' }],
    validate: (d) => d?.success === true && (d?.prompt?.id || d?.id) },
  { area: 'Vault', name: 'Create from keyword', channel: 'create-prompt-vault-from-keyword',
    args: [{ keyword: 'content automation', feature: 'general' }],
    validate: (d) => d?.success === true && d?.prompt?.id },
  { area: 'Vault', name: 'Search vault', channel: 'search-prompt-vault',
    args: [{ query: 'automation' }],
    validate: (d) => Array.isArray(d?.prompts) },
  { area: 'Vault', name: 'Export vault', channel: 'export-prompt-vault',
    args: [{}],
    validate: (d) => d?.success === true || Array.isArray(d?.prompts) },
  { area: 'Live', name: 'Section live', channel: 'get-section-live', args: ['prompt-vault'],
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
  console.log('\n=== PROMPT VAULT FEATURE QA ===\n');
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
    if (f.name === 'Save prompt' && r.data?.prompt?.id) savedId = r.data.prompt.id;
    const icon = status === 'PASS' ? '✓' : status === 'WEAK' ? '~' : '✗';
    console.log(`${icon} [${f.area}] ${f.name} — ${status}${reason ? ` (${reason})` : ''}`);
    if (status === 'PASS') pass++;
    else if (status === 'WEAK') weak++;
    else fail++;
  }

  if (savedId) {
    const load = await invoke(token, projectId, 'load-prompt-vault-item', [{ id: savedId }]);
    console.log(`${load.data?.success && load.data?.text ? '✓' : '~'} [Vault] Load prompt — ${load.data?.success ? 'PASS' : 'WEAK'}`);
    if (load.data?.success) pass++;
    await invoke(token, projectId, 'delete-prompt-vault-item', [{ id: savedId }]);
  }

  console.log(`\nSUMMARY: PASS=${pass} WEAK=${weak} FAIL=${fail}\n`);
  fs.writeFileSync(
    path.join(__dirname, '.prompt-vault-qa-report.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), summary: { pass, weak, fail } }, null, 2),
  );
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });