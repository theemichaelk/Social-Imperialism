/**
 * Growth Lab (reddit-ai) feature QA — all channels used by /reddit-ai
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

const FEATURES = [
  { area: 'Lab', name: 'Reddit AI status', channel: 'get-reddit-ai-status',
    validate: (d) => typeof d === 'object' && (d.modules || d.log) },
  { area: 'Lab', name: 'Reddit settings', channel: 'get-reddit-ai-settings',
    validate: (d) => typeof d === 'object' && d.modules },
  { area: 'Lab', name: 'Save settings', channel: 'save-reddit-ai-settings',
    args: [{ modules: { 'subreddit-ascent': { enabled: true, autoRun: false } } }],
    validate: (d) => d?.success !== false || d?.settings },
  { area: 'Lab', name: 'Module queue', channel: 'get-reddit-ai-queue', args: ['subreddit-ascent'],
    validate: (d) => d?.queue !== undefined && Array.isArray(d.queue) },
  { area: 'Lab', name: 'Run module', channel: 'run-reddit-ai-module', args: ['subreddit-ascent'],
    validate: (d) => d?.success === true || d?.actionsQueued !== undefined },
  { area: 'Lab', name: 'Dismiss action (noop)', channel: 'dismiss-reddit-ai-action', args: ['nonexistent_qa_id'],
    validate: (d) => typeof d === 'object' },
  { area: 'Leads', name: 'Get leads', channel: 'get-leads',
    validate: (d) => Array.isArray(d) },
  { area: 'Live', name: 'Section live', channel: 'get-section-live', args: ['reddit-ai'],
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
  console.log('\n=== REDDIT AI (GROWTH LAB) FEATURE QA ===\n');
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
    path.join(__dirname, '.reddit-ai-qa-report.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), summary: { pass, weak, fail } }, null, 2),
  );
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });