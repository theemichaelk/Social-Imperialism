/**
 * Blueprint feature checklist — verifies all major product areas.
 */
const API = process.env.API_URL || 'http://localhost:4000';
const EMAIL = 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

const CHECKS = [
  { area: '1 Project Setup', name: 'Active campaign', channel: 'get-active-campaign', validate: (d) => d?.brandName },
  { area: '1 Project Setup', name: 'Setup status', channel: 'get-setup-status', validate: (d) => d?.hasProject !== undefined },
  { area: '1 Project Setup', name: 'Brand guidelines', channel: 'save-brand-guidelines', args: [{ affiliateLinks: 'test' }], validate: (d) => d?.success },
  { area: '2 Keywords', name: 'Get keywords', channel: 'get-keywords', validate: (d) => Array.isArray(d) },
  { area: '2 Keywords', name: 'AI suggest keywords', channel: 'generate-keywords', args: [{ brandName: 'Test', domain: 'test.com' }], validate: (d) => Array.isArray(d) && d.length > 0 },
  { area: '2 Keywords', name: 'Global custom prompt', channel: 'generate-global-custom-prompt', validate: (d) => typeof d === 'object' },
  { area: '3 Browse Posts', name: 'Live feed', channel: 'get-live-feed', args: [{ quick: true }], validate: (d) => Array.isArray(d) },
  { area: '3 Browse Posts', name: 'Fetch profiles', channel: 'get-fetch-profiles', validate: (d) => Array.isArray(d) },
  { area: '4 AI Replies', name: 'Draft reply', channel: 'draft-post-reply', args: [{ postContent: 'What is the best marketing tool?', platform: 'Twitter' }], validate: (d) => typeof d === 'string' && d.length > 10, slow: true },
  { area: '4 AI Replies', name: 'AI replies hub', channel: 'get-ai-replies-hub', validate: (d) => typeof d === 'object' },
  { area: '5 Be First', name: 'Watched monitors', channel: 'get-watched-monitors', validate: (d) => Array.isArray(d) },
  { area: '5 Be First', name: 'Auto rules', channel: 'get-auto-rules', validate: (d) => typeof d === 'object' },
  { area: '5 Be First', name: 'Worker status', channel: 'get-worker-status', validate: (d) => typeof d === 'object' },
  { area: '6 Auto Search', name: 'Auto search settings', channel: 'get-auto-search-settings', validate: (d) => d?.frequency },
  { area: '6 Auto Search', name: 'Save auto search', channel: 'save-auto-search-settings', args: [{ dailyEnabled: true, frequency: 'daily' }], validate: (d) => d?.success },
  { area: '6 Auto Search', name: 'Full auto search', channel: 'trigger-full-auto-search', validate: (d) => d?.success !== false && d?.platformCount >= 10, slow: true },
  { area: '7 Q&A', name: 'Discover questions', channel: 'discover-best-questions', validate: (d) => d?.questions || Array.isArray(d), slow: true },
  { area: '7 Q&A', name: 'Unanswered tracker', channel: 'get-unanswered-questions', validate: (d) => Array.isArray(d) },
  { area: '7 Q&A', name: 'QA settings', channel: 'get-qa-settings', validate: (d) => d?.minViews != null },
  { area: '7 Q&A', name: 'Notifications', channel: 'get-notification-settings', validate: (d) => typeof d === 'object' },
  { area: '8 Content/RSS', name: 'Curate RSS', channel: 'curate-from-rss', args: [{ rssUrl: 'https://feeds.feedburner.com/TechCrunch', numItems: 1 }], validate: (d) => d?.posts || Array.isArray(d), slow: true },
  { area: '8 Content/RSS', name: 'Scheduled posts', channel: 'get-scheduled-posts', validate: (d) => Array.isArray(d) },
  { area: '8 Content/RSS', name: 'Content queue', channel: 'get-content-queue', validate: (d) => Array.isArray(d) },
  { area: '9 Fanpage', name: 'Fanpage settings', channel: 'get-fanpage-settings', validate: (d) => typeof d === 'object' },
  { area: '9 Fanpage', name: 'Fanpage metrics', channel: 'get-fanpage-metrics', args: [[]], validate: (d) => typeof d === 'object' },
  { area: '10 Platforms', name: 'API status', channel: 'check-api-status', validate: (d) => Object.keys(d).length > 5 },
  { area: '10 Platforms', name: 'Linked accounts', channel: 'get-linked-accounts', validate: (d) => Array.isArray(d) },
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
  return { ok: res.ok, data: json.data ?? json, error: json.error };
}

async function run() {
  console.log('\n=== BLUEPRINT FEATURE CHECKLIST ===\n');
  const { token, projectId } = await login();
  let pass = 0;
  let fail = 0;
  let area = '';

  for (const c of CHECKS) {
    if (c.area !== area) { area = c.area; console.log(`\n── ${area} ──`); }
    try {
      const { ok, data, error } = await invoke(token, projectId, c.channel, c.args || []);
      if (!ok) throw new Error(error);
      if (!c.validate(data)) throw new Error('validation failed');
      console.log(`  ✓ ${c.name}`);
      pass++;
    } catch (e) {
      console.log(`  ✗ ${c.name}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\n=== ${pass}/${CHECKS.length} PASS (${fail} fail) ===\n`);
  if (fail) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });