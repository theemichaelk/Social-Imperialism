/**
 * Setup Wizard + connection fields QA (admin)
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const API = process.env.API_URL || 'https://api.socialimperialism.com';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

const WIZARD_FEATURES = [
  { step: 'Status', name: 'Setup status', channel: 'get-setup-status',
    validate: (d) => typeof d.nextStep === 'number' && d.apiMetrics },
  { step: 'Brand', name: 'Get settings', channel: 'get-settings', validate: (d) => Array.isArray(d) },
  { step: 'Brand', name: 'Active campaign', channel: 'get-active-campaign',
    validate: (d) => d?.id || d?.brandName || d === null },
  { step: 'Brand', name: 'Generate keywords', channel: 'generate-keywords',
    args: [{ brandName: 'Acme Growth', domain: 'acmegrowth.com' }],
    validate: (d) => (Array.isArray(d) && d.length) || d?.keywords?.length },
  { step: 'Connections', name: 'Global keys (all fields)', channel: 'get-global-keys',
    validate: (d) => d.gemini && d.newsApiKey && d.linkedinAccessToken },
  { step: 'Connections', name: 'Key sources admin', channel: 'get-key-sources',
    validate: (d) => d.isAdminEnv && d.envKeyCount >= 20 },
  { step: 'Connections', name: 'API status', channel: 'check-api-status',
    validate: (d) => Object.values(d).filter((v) => v === 'Connected').length >= 15 },
  { step: 'Connections', name: 'Live audit', channel: 'run-live-connection-audit',
    validate: (d) => d.summary && d.probes?.length >= 10 },
  { step: 'Keywords', name: 'Get keywords', channel: 'get-keywords', validate: (d) => Array.isArray(d) },
  { step: 'Feed', name: 'Live feed preview', channel: 'get-live-feed', args: [{ quick: true }],
    validate: (d) => Array.isArray(d) },
  { step: 'Feed', name: 'Trending topics', channel: 'get-trending-topics', validate: (d) => Array.isArray(d) },
  { step: 'Monitors', name: 'Watched monitors', channel: 'get-watched-monitors', validate: (d) => Array.isArray(d) },
  { step: 'Monitors', name: 'Auto rules', channel: 'get-auto-rules', validate: (d) => typeof d === 'object' },
  { step: 'Monitors', name: 'Global custom prompt', channel: 'generate-global-custom-prompt',
    validate: (d) => d?.prompt || d?.success !== false },
  { step: 'Create', name: 'Content studio live', channel: 'get-content-studio-live',
    validate: (d) => d?.stats && typeof d.stats.accounts === 'number' },
  { step: 'Create', name: 'Studio config', channel: 'get-content-studio-config',
    validate: (d) => d?.models?.length && d?.humanizationLevels?.length },
];

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Login failed');
  return body.token;
}

async function invoke(token, channel, args = []) {
  const res = await fetch(`${API}/api/invoke/${channel}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ args }),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { throw new Error(`${channel}: invalid JSON (${res.status})`); }
  if (!res.ok) throw new Error(body.error || `${channel} failed`);
  return body.data;
}

async function main() {
  console.log(`\n=== SETUP WIZARD QA @ ${API} ===\n`);
  const token = await login();
  const broken = [];
  let pass = 0;

  for (const f of WIZARD_FEATURES) {
    try {
      const data = await invoke(token, f.channel, f.args || []);
      if (!f.validate(data)) {
        broken.push({ ...f, reason: 'validation failed', sample: JSON.stringify(data).slice(0, 120) });
        console.log(`✗ [${f.step}] ${f.name}`);
      } else {
        pass += 1;
        console.log(`✓ [${f.step}] ${f.name}`);
      }
    } catch (e) {
      broken.push({ ...f, reason: e.message });
      console.log(`✗ [${f.step}] ${f.name} — ${e.message}`);
    }
  }

  const audit = await invoke(token, 'run-live-connection-audit');
  const issues = (audit.probes || []).filter((p) => p.status !== 'pass');
  console.log('\n--- Live probe issues ---');
  issues.forEach((p) => console.log(`  ${p.status.toUpperCase()}: ${p.label} — ${p.summary}`));

  console.log(`\nSUMMARY: PASS=${pass} BROKEN=${broken.length} PROBE_ISSUES=${issues.length}`);
  if (broken.length) {
    console.log('\nBroken features:');
    broken.forEach((b) => console.log(`  - [${b.step}] ${b.name}: ${b.reason}`));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });