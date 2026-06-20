/**
 * Full desktop IPC parity test — every channel used by desktop HTML pages.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD || 'Kingme05$';

const DESKTOP_CHANNELS = {
  'dashboard.html': ['get-dashboard-stats','get-live-feed','get-trending-topics','get-live-news','get-setup-status','get-domain-metrics','get-project-metrics','analyze-topic','discover-best-questions','get-unanswered-questions','get-qa-settings','get-leads','scan-reddit-now','get-watched-monitors','get-worker-status','trigger-full-auto-search','get-fanpage-settings','curate-from-rss','export-data'],
  'content-hub.html': ['get-linked-accounts','publish-post','schedule-post','generate-ai','generate-image','search-stock-photo','curate-from-rss','get-content-queue','get-auto-content-settings','grok-get-status','compose-qa-answer','get-thumbnail-studio-config','run-content-studio','get-site-rss-sources','serp-search','shorten-url','research-keyword','get-post-history'],
  'account-creator.html': ['get-proxy-pool','get-profile-kits','get-account-creator-status','generate-profile-kit','get-browser-batch-status'],
  'account-hub.html': ['get-linked-accounts','get-account-hub-status','refresh-account-profile'],
  'calendar.html': ['get-scheduled-posts','get-calendar-status','get-best-post-times','get-background-run-settings'],
  'rules.html': ['get-auto-rules','get-auto-rules-status','get-watched-monitors','get-background-run-status','get-automation-targets'],
  'quora-traffic-ops.html': ['get-quora-traffic-status','get-quora-traffic-settings','scrape-quora-questions','generate-quora-answer'],
  'settings.html': ['get-global-keys','check-api-status','get-settings','get-billing-plan','get-grok-settings','get-payment-settings','get-settings-status','get-page-health'],
};

const CHANNEL_ARGS = {
  'get-live-feed': [{}],
  'analyze-topic': [{ topic: 'AI', platform: 'Twitter', brandName: 'Test', audience: 'B2B' }],
  'curate-from-rss': [{ rssUrl: 'https://feeds.feedburner.com/TechCrunch', numItems: 1 }],
  'generate-ai': ['Hello'],
  'research-keyword': ['marketing'],
  'scrape-quora-questions': [{ keyword: 'saas', limit: 2 }],
  'get-reddit-ai-queue': ['subreddit-ascent'],
  'run-seo-tool': [{ toolId: 'reddit-topics', payload: { keyword: 'marketing' } }],
  'get-upcoming-by-platform': [7],
  'publish-post': [{ platform: 'LinkedIn', accountId: 'demo_li', content: 'Parity test post', hasMedia: false, humanLike: false }],
  'schedule-post': [{ platform: 'LinkedIn', accountId: 'demo_li', content: 'Parity scheduled post', scheduleTime: new Date(Date.now() + 86400000).toISOString() }],
  'shorten-url': ['https://example.com'],
  'refresh-account-profile': ['demo_li'],
};

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
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-project-id': projectId || '' },
    body: JSON.stringify({ args }),
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, error: json.error };
}

async function main() {
  const { token, projectId } = await login();
  // Warm handler registry (channels list is empty until first invoke)
  await invoke(token, projectId, 'get-setup-status');
  const channelsRes = await fetch(`${API}/api/channels`, { headers: { Authorization: `Bearer ${token}`, 'x-project-id': projectId } }).then((r) => r.json());
  const registered = new Set(channelsRes.channels || []);

  let ok = 0, fail = 0;
  const results = [];

  for (const [page, channels] of Object.entries(DESKTOP_CHANNELS)) {
    const pageResults = [];
    for (const ch of channels) {
      const inRegistry = registered.has(ch);
      let invokeOk = false;
      if (inRegistry) {
        const r = await invoke(token, projectId, ch, CHANNEL_ARGS[ch] || []);
        invokeOk = r.ok;
        if (r.ok) ok++; else fail++;
      } else {
        fail++;
      }
      pageResults.push({ channel: ch, registered: inRegistry, invokeOk });
      console.log(`${inRegistry && invokeOk ? '✓' : '✗'} ${page} → ${ch}${!inRegistry ? ' (missing)' : !invokeOk ? ' (error)' : ''}`);
    }
    results.push({ page, channels: pageResults });
  }

  console.log(`\nRegistered: ${registered.size} | OK: ${ok} | Fail: ${fail}`);
  const out = path.join(__dirname, '.saas-full-parity-report.json');
  fs.writeFileSync(out, JSON.stringify({ timestamp: new Date().toISOString(), registered: registered.size, ok, fail, results }, null, 2));
  console.log(`Report: ${out}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });