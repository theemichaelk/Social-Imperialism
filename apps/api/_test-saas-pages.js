/**
 * SaaS page smoke tests — auth + invoke per menu route.
 * Usage: node _test-saas-pages.js [--pass N]
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../desktop/.env') });

const API = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD || 'Kingme05$';

const PAGES = [
  { name: 'Dashboard', channels: ['get-dashboard-stats', 'get-live-feed', 'get-trending-topics'] },
  { name: 'Browse Posts', channels: ['get-live-feed', 'draft-post-reply'] },
  { name: 'Content Hub', channels: ['get-linked-accounts', 'generate-ai'] },
  { name: 'Setup Wizard', channels: ['get-setup-status', 'get-active-campaign'] },
  { name: 'Calendar', channels: ['get-scheduled-posts', 'get-calendar-status', 'get-best-post-times'] },
  { name: 'Engagement', channels: ['get-engagement-lists', 'get-linked-accounts'] },
  { name: 'AI Replies', channels: ['get-ai-replies-hub', 'get-ai-replies'] },
  { name: 'Keywords', channels: ['get-keywords', 'get-keyword-api-status'] },
  { name: 'SEO Tools', channels: ['get-seo-tools-list', 'run-seo-tool'] },
  { name: 'Growth Lab', channels: ['get-reddit-ai-status', 'get-reddit-ai-queue', 'scan-reddit-now'] },
  { name: 'Quora Ops', channels: ['discover-best-questions', 'get-unanswered-questions', 'get-qa-settings'] },
  { name: 'Automations', channels: ['get-automation-flow', 'get-automation-templates', 'get-automation-status', 'get-automation-builder-data'] },
  { name: 'Auto-Rules', channels: ['get-auto-rules', 'get-auto-rules-status', 'get-watched-monitors', 'get-worker-status'] },
  { name: 'Account Hub', channels: ['get-linked-accounts', 'get-account-hub-status'] },
  { name: 'Acct Creator', channels: ['get-profile-kits', 'get-proxy-pool', 'get-account-creator-status'] },
  { name: 'Settings', channels: ['get-global-keys', 'check-api-status', 'get-billing-plan', 'get-settings'] },
];

const CHANNEL_ARGS = {
  'get-live-feed': [{}],
  'draft-post-reply': [{ post: { content: 'Test post about marketing', platform: 'Twitter' }, postContent: 'Test post about marketing' }],
  'generate-ai': ['Say hello in 5 words'],
  'run-seo-tool': [{ toolId: 'reddit-topics', payload: { keyword: 'marketing' } }],
  'get-reddit-ai-queue': ['subreddit-ascent'],
};

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Login failed');
  return { token: json.token, projectId: json.project?.id };
}

async function invoke(token, projectId, channel, args = []) {
  const res = await fetch(`${API}/api/invoke/${channel}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-project-id': projectId || '',
    },
    body: JSON.stringify({ args }),
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, data: json.data, error: json.error };
}

async function runPass(passNum) {
  console.log(`\n=== SAAS TEST PASS ${passNum} ===\n`);
  const { token, projectId } = await login();
  console.log(`✓ Login OK (project: ${projectId})\n`);

  const health = await fetch(`${API}/health`).then((r) => r.json());
  if (!health.ok) throw new Error('API health failed');
  console.log('✓ API health OK\n');

  let ok = 0;
  let partial = 0;
  let fail = 0;
  const results = [];

  for (const page of PAGES) {
    const pageResults = [];
    for (const ch of page.channels) {
      const args = CHANNEL_ARGS[ch] || [];
      const r = await invoke(token, projectId, ch, args);
      let status = 'OK';
      if (!r.ok) {
        status = r.status === 404 ? 'FAIL' : 'PARTIAL';
        if (r.status === 404) fail++;
        else partial++;
      } else {
        ok++;
      }
      pageResults.push({ channel: ch, status, error: r.error });
      const icon = status === 'OK' ? '✓' : status === 'PARTIAL' ? '~' : '✗';
      console.log(`  ${icon} ${page.name} → ${ch}${r.error ? ` (${r.error})` : ''}`);
    }
    const pageFail = pageResults.filter((x) => x.status === 'FAIL').length;
    const pageStatus = pageFail ? 'FAIL' : pageResults.some((x) => x.status === 'PARTIAL') ? 'PARTIAL' : 'OK';
    results.push({ page: page.name, status: pageStatus, channels: pageResults });
    console.log(`Page: ${page.name} → ${pageStatus}\n`);
  }

  const channelsRes = await fetch(`${API}/api/channels`, {
    headers: { Authorization: `Bearer ${token}`, 'x-project-id': projectId || '' },
  }).then((r) => r.json());
  console.log(`Registered channels: ${channelsRes.count}\n`);
  console.log(`Pass ${passNum} — OK: ${ok} | Partial: ${partial} | Fail: ${fail}\n`);

  return { ok, partial, fail, results, channelCount: channelsRes.count };
}

async function main() {
  const passArg = process.argv.find((a) => a.startsWith('--pass'));
  const passes = passArg ? parseInt(passArg.split('=')[1] || '2', 10) : 2;

  const summaries = [];
  for (let i = 1; i <= passes; i++) {
    summaries.push(await runPass(i));
  }

  const totalFail = summaries.reduce((a, s) => a + s.fail, 0);
  const outPath = path.join(__dirname, '.saas-pages-test-report.json');
  require('fs').writeFileSync(outPath, JSON.stringify({ timestamp: new Date().toISOString(), passes: summaries }, null, 2));
  console.log(`Report: ${outPath}`);
  console.log(`\n=== FINAL: ${passes} passes, total failures: ${totalFail} ===\n`);
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Test runner error:', e.message);
  process.exit(1);
});