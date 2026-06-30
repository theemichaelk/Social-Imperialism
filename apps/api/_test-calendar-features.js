/**
 * Calendar feature QA — all channels used by /calendar
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

const FEATURES = [
  { area: 'Calendar', name: 'Get scheduled posts', channel: 'get-scheduled-posts',
    validate: (d) => Array.isArray(d) },
  { area: 'Calendar', name: 'Calendar status', channel: 'get-calendar-status',
    validate: (d) => typeof d === 'object' && d !== null },
  { area: 'Calendar', name: 'Best post times', channel: 'get-best-post-times',
    validate: (d) => typeof d === 'object' },
  { area: 'Calendar', name: 'Schedule post', channel: 'schedule-post',
    args: [{ platform: 'LinkedIn', content: 'Calendar QA scheduled post', scheduleTime: new Date(Date.now() + 172800000).toISOString(), hasMedia: false }],
    validate: (d) => d?.id || d?.success !== false },
  { area: 'Calendar', name: 'Upcoming by platform', channel: 'get-upcoming-by-platform', args: [14],
    validate: (d) => typeof d === 'object' },
  { area: 'Calendar', name: 'Calendar settings', channel: 'get-calendar-settings',
    validate: (d) => typeof d === 'object' },
  { area: 'Calendar', name: 'Process due posts', channel: 'process-due-scheduled-posts',
    validate: (d) => typeof d === 'object' },
  { area: 'Calendar', name: 'Background run settings', channel: 'get-background-run-settings',
    validate: (d) => typeof d === 'object' },
  { area: 'Live', name: 'Section live', channel: 'get-section-live', args: ['calendar'],
    validate: (d) => d?.stats && typeof d.stats === 'object' },
  { area: 'Accounts', name: 'Linked accounts', channel: 'get-linked-accounts',
    validate: (d) => Array.isArray(d) },
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
  console.log('\n=== CALENDAR FEATURE QA ===\n');
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
    path.join(__dirname, '.calendar-qa-report.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), summary: { pass, weak, fail } }, null, 2),
  );
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });