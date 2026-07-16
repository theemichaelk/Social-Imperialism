/**
 * Smoke test for admin GSC/GA4 traffic routes (status always; snapshot if creds present).
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const API = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.SEED_EMAIL;
const PASS = process.env.SEED_PASSWORD;

async function main() {
  // Unit: local service status
  const { getConfigStatus, getAdminTrafficSnapshot } = require('./src/services/googleTraffic');
  const status = getConfigStatus();
  console.log('[local] configured=', status.configured, 'ready=', status.ready);
  console.log('[local] issues:', (status.issues || []).join(' | ') || 'none');

  if (!EMAIL || !PASS) {
    console.log('No SEED_EMAIL/PASSWORD — skip HTTP probe');
    // Offline snapshot when unconfigured should not throw
    const snap = await getAdminTrafficSnapshot({ days: 7 });
    if (snap.configured === false && !snap.error) {
      console.log('FAIL: expected error message when unconfigured');
      process.exit(1);
    }
    console.log('[local] unconfigured snapshot ok:', !!snap.error || snap.success === false);
    console.log('OK (local only)');
    return;
  }

  let login;
  try {
    login = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASS }),
    });
  } catch (e) {
    console.log('API unreachable at', API, '—', e.message);
    const snap = await getAdminTrafficSnapshot({ days: 7 });
    console.log('[local] snapshot configured=', snap.configured, 'success=', snap.success);
    console.log('OK (local service only)');
    return;
  }
  const lj = await login.json();
  if (!lj.token) {
    console.log('Login failed', login.status, lj);
    process.exit(1);
  }
  if (!lj.user?.isAdmin) {
    console.log('Seed user is not platform admin — status endpoint will 403');
  }
  const headers = { Authorization: `Bearer ${lj.token}`, 'Content-Type': 'application/json' };
  if (lj.project?.id) headers['x-project-id'] = lj.project.id;

  const st = await fetch(`${API}/api/admin/traffic/status`, { headers });
  const stj = await st.json();
  console.log('[http] status', st.status, 'ready=', stj.ready, 'configured=', stj.configured);

  const tr = await fetch(`${API}/api/admin/traffic?days=7`, { headers });
  const trj = await tr.json();
  console.log(
    '[http] traffic',
    tr.status,
    'success=',
    trj.success,
    'gsc=',
    trj.gsc?.success,
    'ga4=',
    trj.ga4?.success,
    'err=',
    trj.error || '',
  );
  if (tr.status === 403) {
    console.log('OK (forbidden for non-admin — expected if seed is not admin)');
    return;
  }
  if (tr.status !== 200) {
    console.log('FAIL unexpected status', tr.status, trj);
    process.exit(1);
  }
  console.log('OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
