require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const API = process.env.PROD_API || 'https://api.socialimperialism.com';
const WEB = process.env.PROD_WEB || 'https://www.socialimperialism.com';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD || 'Kingme05$';

const DASHBOARD_CHANNELS = [
  ['get-dashboard-stats', []],
  ['get-section-live', ['dashboard']],
  ['get-active-campaign', []],
  ['get-setup-status', []],
  ['get-trending-topics', []],
  ['get-live-news', ['technology']],
  ['get-worker-status', []],
  ['get-linked-accounts', []],
  ['check-api-status', []],
];

async function invoke(token, projectId, channel, args = []) {
  const res = await fetch(`${API}/api/invoke/${channel}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-project-id': projectId,
    },
    body: JSON.stringify({ args }),
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, data: json.data, error: json.error };
}

async function invokeWeb(token, projectId, channel, args = []) {
  const res = await fetch(`${WEB}/api/invoke/${channel}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-project-id': projectId,
    },
    body: JSON.stringify({ args }),
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, data: json.data, error: json.error };
}

async function main() {
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const login = await loginRes.json();
  const token = login.token;
  const projectId = login.project?.id;
  console.log('Login project:', projectId, login.project?.name, login.project?.brandName);

  console.log('\n── Direct API (with x-project-id) ──');
  for (const [ch, args] of DASHBOARD_CHANNELS) {
    const r = await invoke(token, projectId, ch, args);
    const preview = ch === 'get-dashboard-stats' ? r.data
      : ch === 'get-section-live' ? r.data?.stats
      : ch === 'get-active-campaign' ? r.data
      : Array.isArray(r.data) ? `array(${r.data.length})` : typeof r.data;
    console.log(`${r.ok ? '✓' : '✗'} ${ch}`, r.error || JSON.stringify(preview).slice(0, 120));
  }

  console.log('\n── WWW proxy (with x-project-id) ──');
  for (const [ch, args] of [['get-dashboard-stats', []], ['get-section-live', ['dashboard']]]) {
    const r = await invokeWeb(token, projectId, ch, args);
    console.log(`${r.ok ? '✓' : '✗'} ${ch}`, r.error || JSON.stringify(ch === 'get-section-live' ? r.data?.stats : r.data).slice(0, 120));
  }

  console.log('\n── WWW proxy WITHOUT x-project-id (simulates stale browser) ──');
  const res = await fetch(`${WEB}/api/invoke/get-dashboard-stats`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ args: [] }),
  });
  const json = await res.json();
  console.log('get-dashboard-stats:', JSON.stringify(json.data).slice(0, 200));
}

main().catch(console.error);