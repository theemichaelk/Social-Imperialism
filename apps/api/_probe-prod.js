require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const API = process.env.PROD_API || 'https://api.socialimperialism.com';
const WEB = process.env.PROD_WEB || 'https://www.socialimperialism.com';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD || 'Kingme05$';

async function main() {
  console.log('API health:', await fetch(`${API}/health`).then((r) => r.json()));
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  console.log('API login status:', loginRes.status);
  const loginJson = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok) {
    console.log('API login error:', loginJson);
    return;
  }
  const token = loginJson.token;
  const projectId = loginJson.project?.id;
  console.log('Logged in, project:', projectId);

  const webLogin = await fetch(`${WEB}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  console.log('WEB proxy login status:', webLogin.status, await webLogin.text().then((t) => t.slice(0, 120)));

  const live = await fetch(`${API}/api/invoke/get-section-live`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-project-id': projectId,
    },
    body: JSON.stringify({ args: ['dashboard'] }),
  });
  console.log('get-section-live:', live.status, await live.json().then((j) => JSON.stringify(j.data?.stats || j.error).slice(0, 200)));
}

main().catch(console.error);