require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const API = 'https://api.socialimperialism.com';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  }).then((r) => r.json());

  const token = login.token;
  const good = login.project?.id;
  const bad = 'cmqlrti3j0005beqg8032fe6b';

  for (const pid of [good, bad, '']) {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (pid) headers['x-project-id'] = pid;

    const r = await fetch(`${API}/api/invoke/get-dashboard-stats`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ args: [] }),
    }).then((res) => res.json());

    console.log(`project ${pid || '(default)'}:`, JSON.stringify(r.data || r.error));
  }
}

main().catch(console.error);