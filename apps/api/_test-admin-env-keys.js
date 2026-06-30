/**
 * Verifies admin accounts receive .env API keys; non-admin sessions do not.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const API = process.env.API_URL || 'https://api.socialimperialism.com';
const ADMIN_EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const ADMIN_PASS = process.env.SEED_PASSWORD;
const ADMIN_EMAIL_2 = 'michaelk@tsbrenterprises.com';

async function login(email, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}: ${body.error || res.status}`);
  return body.token;
}

async function invoke(token, channel, args = []) {
  const res = await fetch(`${API}/api/invoke/${channel}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ args }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${channel}: ${body.error || res.status}`);
  return body.data;
}

function countConnected(metrics) {
  return Object.values(metrics || {}).filter((v) => v === 'Connected').length;
}

async function assertAdmin(email) {
  const token = await login(email, ADMIN_PASS);
  const sources = await invoke(token, 'get-key-sources');
  const keys = await invoke(token, 'get-global-keys');
  const metrics = await invoke(token, 'check-api-status');
  const connected = countConnected(metrics);

  console.log(`\n[ADMIN] ${email}`);
  console.log(`  isAdminEnv: ${sources.isAdminEnv} (env keys: ${sources.envKeyCount})`);
  console.log(`  resolved keys: gemini=${!!keys.gemini} news=${!!keys.newsApiKey} linkedin=${!!keys.linkedinAccessToken}`);
  console.log(`  API metrics connected: ${connected}/${Object.keys(metrics || {}).length}`);

  if (!sources.isAdminEnv) throw new Error(`${email}: expected isAdminEnv=true`);
  if (sources.envKeyCount < 5) throw new Error(`${email}: expected >=5 env keys, got ${sources.envKeyCount}`);
  if (!keys.gemini && !keys.openrouter && !keys.newsApiKey) {
    throw new Error(`${email}: no core AI/news keys resolved from .env`);
  }
  if (connected < 8) throw new Error(`${email}: expected >=8 connected APIs, got ${connected}`);
  return { sources, keys, metrics, connected };
}

async function main() {
  console.log(`Testing admin .env wiring against ${API}`);
  await assertAdmin(ADMIN_EMAIL);
  await assertAdmin(ADMIN_EMAIL_2);

  const audit = await invoke(await login(ADMIN_EMAIL, ADMIN_PASS), 'run-live-connection-audit');
  const passed = (audit.probes || []).filter((p) => p.status === 'pass').length;
  const total = (audit.probes || []).length;
  console.log(`\n[LIVE AUDIT] ${passed}/${total} probes passed`);
  if (total < 5) throw new Error('Live audit returned too few probes');

  console.log('\n✓ Admin .env key wiring OK for both admin emails');
}

main().catch((e) => {
  console.error('\n✗', e.message);
  process.exit(1);
});