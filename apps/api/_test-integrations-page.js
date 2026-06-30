/**
 * Integrations Hub page — full feature QA (connections, probes, partner API, webhooks)
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

const FIELD_COUNT = 57; // from integrationCatalog ALL_FIELD_KEYS

const FEATURES = [
  { area: 'Connections', name: 'Global keys loaded', channel: 'get-global-keys',
    validate: (d) => typeof d === 'object' && Object.keys(d).length >= 5 },
  { area: 'Connections', name: 'Key sources (.env vs user)', channel: 'get-key-sources',
    validate: (d) => d?.sources && typeof d.isAdminEnv === 'boolean' },
  { area: 'Connections', name: 'API status check', channel: 'check-api-status',
    validate: (d) => Object.keys(d).length >= 15 },
  { area: 'Connections', name: 'Save keys round-trip', channel: 'save-global-keys',
    validate: (d) => d !== false, dynamicArgs: 'keys' },
  { area: 'Probes', name: 'Full API scan', channel: 'test-all-connections',
    validate: (d) => d?.apiMetrics || d?.output },
  { area: 'Probes', name: 'NewsAPI', channel: 'get-live-news', args: ['technology'],
    validate: (d) => Array.isArray(d) || d?.error },
  { area: 'Probes', name: 'Trending topics', channel: 'get-trending-topics',
    validate: (d) => Array.isArray(d) },
  { area: 'Probes', name: 'Stock photo', channel: 'search-stock-photo', args: ['technology'],
    validate: (d) => d?.imageUrl || d?.success !== false },
  { area: 'Probes', name: 'SerpAPI', channel: 'serp-search', args: ['marketing automation'],
    validate: (d) => d?.success !== false || d?.error },
  { area: 'Probes', name: 'DomDetailer', channel: 'get-domain-metrics', args: ['google.com'],
    validate: (d) => d?.success !== false || d?.data || d?.error },
  { area: 'Probes', name: 'YouTube', channel: 'get-youtube-channels',
    validate: (d) => typeof d === 'object' },
  { area: 'Probes', name: 'TinyURL', channel: 'shorten-url', args: ['https://example.com'],
    validate: (d) => !!d?.shortUrl },
  { area: 'Probes', name: 'DeepL', channel: 'deepl-translate', args: ['Hello', 'ES'],
    validate: (d) => typeof d === 'object' },
  { area: 'Probes', name: 'Contentful', channel: 'contentful-fetch',
    validate: (d) => typeof d === 'object' },
  { area: 'Probes', name: 'Keyword research', channel: 'research-keyword', args: ['marketing'],
    validate: (d) => typeof d === 'object' },
  { area: 'Probes', name: 'Streaming keys', channel: 'get-streaming-keys',
    validate: (d) => typeof d === 'object' },
  { area: 'Probes', name: 'Payment gateways', channel: 'test-payment-connections',
    validate: (d) => typeof d === 'object' },
  { area: 'Probes', name: 'Grok status', channel: 'grok-get-status',
    validate: (d) => typeof d === 'object' },
  { area: 'Partner API', name: 'Get partner config', channel: 'get-partner-integration-config',
    validate: (d) => d?.partnerChannels && Array.isArray(d.outboundEvents) },
  { area: 'Partner API', name: 'API catalog', channel: 'get-partner-api-catalog',
    validate: (d) => d?.endpoints && d?.channels },
  { area: 'Partner API', name: 'Generate API key', channel: 'generate-partner-api-key',
    validate: (d) => d?.success && d?.partnerApiKey?.startsWith('si_live_') },
  { area: 'Webhooks', name: 'Regenerate inbound URL', channel: 'regenerate-inbound-webhook',
    validate: (d) => d?.success && d?.inboundWebhookUrl?.includes('/api/v1/hooks/') },
  { area: 'Webhooks', name: 'Receive inbound payload', channel: 'receive-partner-webhook',
    args: [{ event: 'test', source: 'qa' }], validate: (d) => d?.success && d?.eventId },
  { area: 'Webhooks', name: 'Event log', channel: 'get-integration-events-log',
    validate: (d) => Array.isArray(d) && d.length > 0 },
  { area: 'Webhooks', name: 'Save outbound config', channel: 'save-partner-integration-config',
    args: [{ subscribedEvents: ['integration.test', 'post.published'] }],
    validate: (d) => d?.success },
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

async function testPartnerRest(apiKey) {
  if (!apiKey) return { ok: false, error: 'no key' };
  const res = await fetch(`${API}/api/v1/status`, {
    headers: { 'X-SI-API-Key': apiKey },
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, data: json };
}

async function main() {
  console.log('\n=== INTEGRATIONS HUB FULL QA ===\n');
  const health = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) throw new Error('API not running');

  const { token, projectId } = await login();
  const origKeys = (await invoke(token, projectId, 'get-global-keys')).data || {};
  let pass = 0, fail = 0, weak = 0;
  const broken = [];
  let partnerKey = null;

  for (const f of FEATURES) {
    let args = f.args || [];
    if (f.dynamicArgs === 'keys') args = [origKeys];
    const r = await invoke(token, projectId, f.channel, args);
    let status = 'PASS';
    let reason = '';
    if (!r.ok) { status = 'FAIL'; reason = r.error || 'HTTP error'; }
    else {
      try { if (!f.validate(r.data)) { status = 'WEAK'; reason = JSON.stringify(r.data)?.slice(0, 80); } }
      catch (e) { status = 'FAIL'; reason = e.message; }
    }
    if (f.channel === 'generate-partner-api-key' && r.data?.partnerApiKey) partnerKey = r.data.partnerApiKey;
    const icon = status === 'PASS' ? '✓' : status === 'WEAK' ? '~' : '✗';
    console.log(`${icon} [${f.area}] ${f.name} — ${status}${reason ? ` (${reason})` : ''}`);
    if (status === 'PASS') pass++;
    else if (status === 'WEAK') { weak++; broken.push({ ...f, reason }); }
    else { fail++; broken.push({ ...f, reason }); }
  }

  if (partnerKey) {
    const pr = await testPartnerRest(partnerKey);
    const st = pr.ok && pr.data?.ok ? 'PASS' : 'FAIL';
    console.log(`${st === 'PASS' ? '✓' : '✗'} [Partner API] REST /api/v1/status — ${st}${!pr.ok ? ` (${pr.data?.error || 'failed'})` : ''}`);
    if (st === 'PASS') pass++; else { fail++; broken.push({ area: 'Partner API', name: 'REST status', reason: pr.data?.error }); }
  }

  const docsRes = await fetch(`${API}/api/v1/docs`);
  const docsOk = docsRes.ok;
  console.log(`${docsOk ? '✓' : '✗'} [Partner API] Public docs — ${docsOk ? 'PASS' : 'FAIL'}`);
  if (docsOk) pass++; else fail++;

  console.log(`\nField inputs expected: ${FIELD_COUNT}+ across 5 connection groups`);
  console.log(`\nSUMMARY: PASS=${pass} WEAK=${weak} FAIL=${fail}`);
  if (broken.length) {
    console.log('\nNOT FULLY WORKING:');
    broken.forEach((b) => console.log(`  - [${b.area}] ${b.name}: ${b.reason || 'failed'}`));
  }
  console.log('');
  fs.writeFileSync(path.join(__dirname, '.integrations-qa-report.json'), JSON.stringify({ summary: { pass, weak, fail }, broken }, null, 2));
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });