/**
 * Setup Wizard feature QA — all channels used by /onboarding
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'https://api.socialimperialism.com';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

const FEATURES = [
  { area: 'Step 1', name: 'Setup status', channel: 'get-setup-status',
    validate: (d) => typeof d.nextStep === 'number' && d.apiMetrics },
  { area: 'Step 1', name: 'API status check', channel: 'check-api-status',
    validate: (d) => Object.keys(d).length >= 5 },
  { area: 'Step 1', name: 'Save brand (save-settings)', channel: 'save-settings',
    args: [[{ id: 'wiz_qa_test', brandName: 'Wizard QA Brand', domain: 'wizardqa.com', description: 'QA test brand', tone: 'Professional', status: 'Active' }]],
    validate: (d) => d?.success !== false },
  { area: 'Step 1', name: 'Set active campaign', channel: 'set-active-campaign', args: ['wiz_qa_test'],
    validate: (d) => d?.success !== false },
  { area: 'Step 1', name: 'Get active campaign', channel: 'get-active-campaign',
    validate: (d) => d?.brandName || d?.id },
  { area: 'Step 2', name: 'Generate keywords', channel: 'generate-keywords',
    args: [{ brandName: 'Wizard QA Brand', domain: 'wizardqa.com', description: 'B2B SaaS marketing' }],
    validate: (d) => Array.isArray(d) ? d.length > 0 : Array.isArray(d?.keywords) },
  { area: 'Step 2', name: 'Save keywords', channel: 'save-keywords',
    args: [[{ term: 'social media automation', platforms: ['Twitter', 'Reddit', 'LinkedIn'] }, { term: 'B2B marketing', platforms: ['LinkedIn'] }]],
    validate: (d) => d?.success !== false && d?.count >= 1 },
  { area: 'Step 2', name: 'Get keywords', channel: 'get-keywords',
    validate: (d) => Array.isArray(d) && d.length > 0 },
  { area: 'Step 2', name: 'Keyword API status', channel: 'get-keyword-api-status',
    validate: (d) => typeof d === 'object' },
  { area: 'Step 3', name: 'Feed preview (quick)', channel: 'get-live-feed', args: [{ quick: true }],
    validate: (d) => Array.isArray(d) },
  { area: 'Step 3', name: 'First full scan', channel: 'trigger-full-auto-search',
    validate: (d) => d?.success !== false },
  { area: 'Step 4', name: 'Linked accounts count', channel: 'get-linked-accounts',
    validate: (d) => Array.isArray(d) },
  { area: 'Step 4', name: 'Start worker', channel: 'start-worker',
    validate: (d) => d?.success !== false },
  { area: 'Step 4', name: 'Set onboarding complete', channel: 'set-onboarding-complete', args: [true],
    validate: (d) => d?.success !== false },
  { area: 'Step 4', name: 'Setup status after complete', channel: 'get-setup-status',
    validate: (d) => d.onboardingComplete === true || d.complete === true },
  { area: 'Step 1', name: 'Save brand guidelines', channel: 'save-brand-guidelines',
    args: [{ disallowedTopics: 'politics', sampleMessages: 'We help B2B teams grow.', affiliateLinks: 'https://wizardqa.com' }],
    validate: (d) => d?.success !== false || typeof d === 'object' },
  { area: 'Step 2', name: 'Global custom prompt', channel: 'generate-global-custom-prompt',
    validate: (d) => !!(d?.prompt || d?.customPrompt) || typeof d === 'object' },
  { area: 'Step 4', name: 'Save auto-rules', channel: 'save-auto-rules',
    args: [{ enabled: true, oneClickAutoSearchEnabled: true, autoSearchFrequency: 'daily', beFirstMonitorFrequency: '10m' }],
    validate: (d) => d?.success !== false || typeof d === 'object' },
  { area: 'Step 4', name: 'Save auto-search settings', channel: 'save-auto-search-settings',
    args: [{ dailyEnabled: true, frequency: 'daily', beFirstMonitorFrequency: '10m' }],
    validate: (d) => d?.success !== false || typeof d === 'object' },
  { area: 'Step 4', name: 'Save watched monitors', channel: 'save-watched-monitors',
    args: [[{ id: 'mon_wiz_qa', label: 'Wizard QA monitor', type: 'keyword', target: 'marketing', platform: 'Reddit' }]],
    validate: (d) => d?.success !== false },
  { area: 'Step 4', name: 'Get auto-rules', channel: 'get-auto-rules',
    validate: (d) => typeof d === 'object' },
  { area: 'Live', name: 'Section live (onboarding)', channel: 'get-section-live', args: ['onboarding'],
    validate: (d) => d?.stats && typeof d.stats === 'object' },
  { area: 'Step 2', name: 'Global keys', channel: 'get-global-keys',
    validate: (d) => typeof d === 'object' },
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
  const text = await res.text();
  let json = {};
  if (text) {
    try { json = JSON.parse(text); } catch { json = { error: text.slice(0, 200) }; }
  }
  return { ok: res.ok, data: json.data, error: json.error };
}

async function main() {
  console.log('\n=== SETUP WIZARD FEATURE QA ===\n');
  const health = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) throw new Error('API not running');

  const { token, projectId } = await login();
  let pass = 0, fail = 0, weak = 0;

  for (const f of FEATURES) {
    const r = await invoke(token, projectId, f.channel, f.args || []);
    let status = 'PASS';
    let reason = '';
    if (!r.ok) { status = 'FAIL'; reason = r.error || 'HTTP error'; }
    else {
      try { if (!f.validate(r.data)) { status = 'WEAK'; reason = JSON.stringify(r.data)?.slice(0, 100); } }
      catch (e) { status = 'FAIL'; reason = e.message; }
    }
    const icon = status === 'PASS' ? '✓' : status === 'WEAK' ? '~' : '✗';
    console.log(`${icon} [${f.area}] ${f.name} — ${status}${reason ? ` (${reason})` : ''}`);
    if (status === 'PASS') pass++; else if (status === 'WEAK') weak++; else fail++;
  }

  console.log(`\nSUMMARY: PASS=${pass} WEAK=${weak} FAIL=${fail}\n`);
  fs.writeFileSync(path.join(__dirname, '.setup-wizard-qa-report.json'), JSON.stringify({ summary: { pass, weak, fail } }, null, 2));
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });