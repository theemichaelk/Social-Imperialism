/**
 * Clear sovereign false positives on production and verify connect-platform works.
 * Usage: node apps/api/_clear-sovereign-production.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const API = process.env.API_URL || 'https://api.socialimperialism.com';
const EMAIL = process.env.SEED_EMAIL;
const PASS = process.env.SEED_PASSWORD;

if (!EMAIL || !PASS) {
  console.error('Set SEED_EMAIL and SEED_PASSWORD in apps/api/.env (or env) before running.');
  process.exit(1);
}

async function main() {
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const login = await loginRes.json();
  if (!login.token) {
    console.error('Login failed:', login);
    process.exit(1);
  }
  console.log('Logged in as', EMAIL);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${login.token}`,
    'x-project-id': login.project?.id,
  };

  const clearRes = await fetch(`${API}/api/invoke/admin-clear-sovereign-false-positives`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ args: [{ adminEmail: EMAIL }] }),
  });
  const clear = await clearRes.json();
  console.log('Clear false positives:', clearRes.status, clear.message || clear.error || clear);

  const connectRes = await fetch(`${API}/api/invoke/connect-platform`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      args: [{
        platform: 'LinkedIn',
        method: 'credentials',
        email: 'michaelk@tsbrenterprises.com',
        password: 'test-password-field',
      }],
    }),
  });
  const connect = await connectRes.json();
  if (connect.code === 'SOVEREIGN_THREAT_CAPTURED') {
    console.error('FAIL: connect-platform still blocked by sovereign shield');
    process.exit(1);
  }
  console.log('connect-platform:', connectRes.status, connect.error || connect.success || 'ok (not sovereign-blocked)');
  console.log('DONE');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});