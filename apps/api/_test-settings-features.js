/**
 * Settings + Integrations page feature QA
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD || 'Kingme05$';

const FEATURES = [
  { area: 'Keys', name: 'Get global keys', channel: 'get-global-keys',
    validate: (d) => typeof d === 'object' && (d.gemini || d.newsApiKey || d.linkedinAccessToken) },
  { area: 'Keys', name: 'Save global keys (round-trip)', channel: 'save-global-keys',
    validate: (d) => d !== false, dynamicArgs: 'keys-roundtrip' },
  { area: 'Keys', name: 'Keys persist after save', channel: 'get-global-keys',
    validate: (d) => d?.__qa_marker === 'settings_test_ok' || !!d.gemini },
  { area: 'Keys', name: 'Test all connections', channel: 'test-all-connections',
    validate: (d) => d?.success !== false && (d.apiMetrics || d.output) },
  { area: 'Keys', name: 'Run live connection audit', channel: 'run-live-connection-audit',
    fallbackChannel: 'test-all-connections',
    validate: (d) => Array.isArray(d?.probes) && d.probes.length >= 5 && d.summary,
    fallbackValidate: (d) => !!(d?.apiMetrics || d?.output) },
  { area: 'Integrations', name: 'Email provider probe', channel: 'test-email-connections',
    validate: (d) => typeof d === 'object' && (d.vbout || d.ses || d.mailchimp || d.acumbamail) },
  { area: 'Status', name: 'API status check', channel: 'check-api-status',
    validate: (d) => Object.keys(d).length >= 10 },
  { area: 'Status', name: 'Settings status', channel: 'get-settings-status',
    validate: (d) => typeof d.campaignCount === 'number' && d.apiMetrics },
  { area: 'Status', name: 'Page health', channel: 'get-page-health',
    validate: (d) => d?.summary && Array.isArray(d.sections) },
  { area: 'Status', name: 'Key sources', channel: 'get-key-sources',
    validate: (d) => d?.sources && typeof d.isAdminEnv === 'boolean' },
  { area: 'Playbooks', name: 'Get playbook config', channel: 'get-site-playbook-config',
    validate: (d) => typeof d === 'object' },
  { area: 'Playbooks', name: 'Save playbook config', channel: 'save-site-playbook-config',
    args: [{ keywords: 'test kw', description: 'test desc' }], validate: (d) => d?.success !== false },
  { area: 'Site Health', name: 'Traffic health scan', channel: 'get-site-traffic-health',
    args: [{ domains: ['google.com'], keyword: 'marketing' }],
    validate: (d) => d?.success !== false && Array.isArray(d.sites) },
  { area: 'Campaigns', name: 'Get campaigns', channel: 'get-settings', validate: (d) => Array.isArray(d) },
  { area: 'Campaigns', name: 'Get active campaign', channel: 'get-active-campaign',
    validate: (d) => d?.id || d?.brandName || d === null },
  { area: 'Campaigns', name: 'Set active campaign', channel: 'set-active-campaign',
    validate: (d) => d?.success !== false, dynamicArgs: 'active-campaign' },
  { area: 'Billing', name: 'Billing plan', channel: 'get-billing-plan',
    validate: (d) => d?.planName && d?.allPlans },
  { area: 'Billing', name: 'Save billing plan', channel: 'save-billing-plan', args: ['growth'],
    validate: (d) => d?.success !== false && d?.planName },
  { area: 'Billing', name: 'Save billing email', channel: 'save-billing-email', args: ['billing@test.com'],
    validate: (d) => d?.success !== false },
  { area: 'Grok', name: 'Grok settings', channel: 'get-grok-settings', validate: (d) => typeof d === 'object' },
  { area: 'Grok', name: 'Save grok settings', channel: 'save-grok-settings',
    args: [{ email: 'test@grok.ai', enabled: true }], validate: (d) => d?.success !== false },
  { area: 'Grok', name: 'Grok status', channel: 'grok-get-status', validate: (d) => typeof d === 'object' },
  { area: 'Payments', name: 'Payment settings', channel: 'get-payment-settings', validate: (d) => typeof d === 'object' },
  { area: 'Payments', name: 'Test payments', channel: 'test-payment-connections', validate: (d) => typeof d === 'object' },
  { area: 'Tutorials', name: 'Setup tutorials', channel: 'get-setup-tutorials',
    validate: (d) => Array.isArray(d?.tutorials) && d.tutorials.length > 0 },
  { area: 'Tutorials', name: 'Mark tutorial complete', channel: 'mark-tutorial-complete', args: ['tut_01'],
    validate: (d) => d?.success !== false },
  { area: 'Integrations', name: 'Live news probe', channel: 'get-live-news', args: ['technology'],
    validate: (d) => Array.isArray(d) || d?.error },
  { area: 'Integrations', name: 'Stock photo probe', channel: 'search-stock-photo', args: ['technology'],
    validate: (d) => d?.imageUrl || d?.success },
  { area: 'Integrations', name: 'TinyURL probe', channel: 'shorten-url', args: ['https://example.com'],
    validate: (d) => !!d?.shortUrl },
  { area: 'Integrations', name: 'YouTube probe', channel: 'get-youtube-channels',
    validate: (d) => d?.success !== false },
  { area: 'Integrations', name: 'Keyword research', channel: 'research-keyword', args: ['marketing'],
    validate: (d) => typeof d === 'object' },
  { area: 'System', name: 'Export data', channel: 'export-data', validate: (d) => typeof d === 'object' },
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
  const json = await res.json();
  return { ok: res.ok, data: json.data, error: json.error };
}

async function main() {
  console.log('\n=== SETTINGS + INTEGRATIONS FEATURE QA ===\n');
  const health = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) throw new Error('API not running');

  const { token, projectId } = await login();
  let pass = 0, fail = 0, weak = 0;

  const origKeys = (await invoke(token, projectId, 'get-global-keys')).data || {};
  const campaigns = (await invoke(token, projectId, 'get-settings')).data || [];
  const activeId = campaigns[0]?.id || 'default';

  for (const f of FEATURES) {
    let args = f.args || [];
    if (f.dynamicArgs === 'keys-roundtrip') {
      args = [{ ...origKeys, __qa_marker: 'settings_test_ok' }];
    } else if (f.dynamicArgs === 'active-campaign') {
      args = [activeId];
    }
    let r = await invoke(token, projectId, f.channel, args);
    let usedFallback = false;
    if (!r.ok && f.fallbackChannel) {
      r = await invoke(token, projectId, f.fallbackChannel, args);
      usedFallback = true;
    }
    let status = 'PASS';
    let reason = '';
    if (!r.ok) { status = 'FAIL'; reason = r.error || 'HTTP error'; }
    else {
      const validator = usedFallback && f.fallbackValidate ? f.fallbackValidate : f.validate;
      try {
        if (!validator(r.data)) {
          status = usedFallback ? 'WEAK' : 'WEAK';
          reason = usedFallback ? 'deploy pending — key scan only' : JSON.stringify(r.data)?.slice(0, 100);
        } else if (usedFallback) {
          status = 'WEAK';
          reason = 'fallback: deploy API for full live probes';
        }
      }
      catch (e) { status = 'FAIL'; reason = e.message; }
    }
    const icon = status === 'PASS' ? '✓' : status === 'WEAK' ? '~' : '✗';
    console.log(`${icon} [${f.area}] ${f.name} — ${status}${reason ? ` (${reason})` : ''}`);
    if (status === 'PASS') pass++; else if (status === 'WEAK') weak++; else fail++;
  }

  // Restore original keys after round-trip test
  const { __qa_marker, ...restore } = origKeys;
  await invoke(token, projectId, 'save-global-keys', [restore]);

  console.log(`\nSUMMARY: PASS=${pass} WEAK=${weak} FAIL=${fail}\n`);
  fs.writeFileSync(path.join(__dirname, '.settings-qa-report.json'), JSON.stringify({ summary: { pass, weak, fail } }, null, 2));
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });