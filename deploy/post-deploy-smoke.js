/**
 * Fail deploy if production still throws coreRequire or wrong API version.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../apps/api/.env') });

const API = process.argv[2] || process.env.API_URL || 'https://api.socialimperialism.com';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;
const MIN_VERSION = process.argv[3] || '1.2.11';

function versionGte(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return true;
}

(async () => {
  const health = await fetch(`${API}/health`).then((r) => r.json());
  console.log('health', health.version, health.ok ? 'ok' : 'FAIL');
  if (!health.ok) throw new Error('health not ok');
  if (!versionGte(health.version, MIN_VERSION)) {
    throw new Error(`API version ${health.version} < expected ${MIN_VERSION}`);
  }

  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const { token, project } = await login.json();
  if (!token) throw new Error(`login failed: ${login.status}`);

  const smokeChannels = [
    ['get-setup-status', []],
    ['get-section-live', ['onboarding']],
    ['run-imperial-pipeline', [{ pipeline: 'content', topic: 'smoke', brandName: 'Smoke', quick: true }]],
    ['run-auto-rules-now', [{ quick: true }]],
    ['get-imperial-pipeline-result', []],
  ];
  for (const [channel, args] of smokeChannels) {
    const res = await fetch(`${API}/api/invoke/${channel}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-project-id': project?.id,
      },
      body: JSON.stringify({ args }),
    });
    const json = await res.json();
    const err = json.error || '';
    if (err.includes('coreRequire')) throw new Error(`${channel} still fails with coreRequire: ${err.slice(0, 120)}`);
    if (!res.ok || json.error) throw new Error(`${channel} failed: ${err || res.status}`);
    console.log(channel, 'OK');
  }
  console.log('Post-deploy smoke OK');
})().catch((e) => {
  console.error('Post-deploy smoke FAILED:', e.message);
  process.exit(1);
});