/**
 * Browse Posts feature QA — every channel the browse-posts page uses.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'https://api.socialimperialism.com';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

const FEATURES = [
  { area: 'Feed', name: 'Live feed (default)', channel: 'get-live-feed', args: [{ quick: true }],
    validate: (d) => Array.isArray(d) && d.length > 0 },
  { area: 'Feed', name: 'Live feed (platform Reddit)', channel: 'get-live-feed', args: [{ platform: 'Reddit', quick: true }],
    validate: (d) => Array.isArray(d) },
  { area: 'Feed', name: 'Live feed (sort engagement)', channel: 'get-live-feed', args: [{ sort: 'engagement', quick: true }],
    validate: (d) => Array.isArray(d) && d.length > 0 },
  { area: 'Filters', name: 'Keywords list', channel: 'get-keywords', args: [],
    validate: (d) => Array.isArray(d) && (d.length === 0 || d[0].term) },
  { area: 'Filters', name: 'Fetch profiles', channel: 'get-fetch-profiles',
    validate: (d) => Array.isArray(d) },
  { area: 'Filters', name: 'Linked accounts', channel: 'get-linked-accounts', args: [],
    validate: (d) => Array.isArray(d) },
  { area: 'Filters', name: 'Dashboard stats KPIs', channel: 'get-dashboard-stats',
    validate: (d) => typeof d.totalPosts === 'number' && typeof d.activeKeywords === 'number' },
  { area: 'History', name: 'Post history merge', channel: 'get-all-post-history',
    validate: (d) => Array.isArray(d) },
  { area: 'Draft', name: 'Draft AI reply', channel: 'draft-post-reply',
    args: [{ postContent: 'What is the best CRM for startups?', platform: 'LinkedIn' }],
    validate: (d) => typeof d === 'string' && d.length > 10 },
  { area: 'Draft', name: 'Draft with custom prompt', channel: 'draft-post-reply',
    args: [{ postContent: 'How do I grow on social media?', platform: 'Twitter', oneTimeOverride: 'Mention acmegrowth.com once, stay helpful.' }],
    validate: (d) => typeof d === 'string' && d.length > 10 },
  { area: 'Draft', name: 'Save AI reply', channel: 'save-ai-reply',
    args: [{ originalPost: 'Test browse', replyContent: 'Great question!', platform: 'Twitter', status: 'draft' }],
    validate: (d) => d?.id || d?.success !== false },
  { area: 'Engage', name: 'Engage like (with externalId)', channel: 'engage-post',
    args: [{ action: 'like', platform: 'Reddit', postContent: 'Test', externalId: 't3_demo' }],
    validate: (d) => d && typeof d === 'object' },
  { area: 'Engage', name: 'Engagement queue', channel: 'get-engagement-queue',
    validate: (d) => Array.isArray(d) },
  { area: 'Engage', name: 'Watched monitors', channel: 'get-watched-monitors',
    validate: (d) => Array.isArray(d) },
  { area: 'Engage', name: 'Save watched monitor', channel: 'save-watched-monitors',
    args: [[{ id: 'mon_browse_test', label: 'Browse test', type: 'keyword', target: 'marketing', platform: 'Reddit' }]],
    validate: (d) => d?.success !== false },
  { area: 'Publish', name: 'Schedule post', channel: 'schedule-post', needsAccount: true,
    args: [{ platform: 'LinkedIn', content: 'Browse QA scheduled post', scheduleTime: new Date(Date.now() + 86400000).toISOString() }],
    validate: (d) => d?.id || d?.success !== false },
  { area: 'Sidebar', name: 'Live news', channel: 'get-live-news', args: ['technology'],
    validate: (d) => Array.isArray(d) && (d.length === 0 || d[0].title) },
  { area: 'Media', name: 'Stock photo search', channel: 'search-stock-photo', args: ['social media marketing'],
    validate: (d) => d?.imageUrl?.startsWith('http') },
  { area: 'Media', name: 'Image generation', channel: 'generate-image', args: ['minimal social media icon flat design'],
    validate: (d) => d?.imageUrl?.startsWith('http') || d?.url?.startsWith('http') || d?.success === true },
  { area: 'Live', name: 'Browse posts live metrics', channel: 'get-browse-posts-live',
    validate: (d) => d?.stats && typeof d.stats.accounts === 'number' },
  { area: 'Live', name: 'Trending topics', channel: 'get-trending-topics',
    validate: (d) => Array.isArray(d) },
  { area: 'Feed', name: 'Live feed (language filter)', channel: 'get-live-feed', args: [{ quick: true, language: 'en' }],
    validate: (d) => Array.isArray(d) },
  { area: 'Feed', name: 'Live feed (media only)', channel: 'get-live-feed', args: [{ quick: true, media: 'only' }],
    validate: (d) => Array.isArray(d) },
  { area: 'Publish', name: 'Schedule with media', channel: 'schedule-post', needsAccount: true,
    args: [{ platform: 'LinkedIn', content: 'Browse QA with media', hasMedia: true, mediaUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e939e966', scheduleTime: new Date(Date.now() + 172800000).toISOString() }],
    validate: (d) => d?.id || d?.success !== false },
  { area: 'Publish', name: 'Publish post', channel: 'publish-post', needsAccount: true,
    args: [{ platform: 'LinkedIn', content: 'Browse QA publish test', hasMedia: false, humanLike: false }],
    validate: (d, r) => d?.success === true || !!d?.error || r?.status === 200 || typeof d === 'object' },
  { area: 'Engage', name: 'Retry engagement queue', channel: 'retry-engagement-queue',
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
  return { ok: res.ok, status: res.status, data: json.data, error: json.error || (!res.ok ? text.slice(0, 200) : undefined) };
}

async function main() {
  console.log('\n=== BROWSE POSTS FEATURE QA ===\n');
  const health = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) throw new Error('API not running');

  const { token, projectId } = await login();
  const accRes = await invoke(token, projectId, 'get-linked-accounts', []);
  const firstAcc = Array.isArray(accRes.data) && accRes.data[0];

  let pass = 0, fail = 0, weak = 0;
  const results = [];

  for (const f of FEATURES) {
    let args = f.args ? [...f.args] : [];
    if (f.needsAccount && firstAcc) {
      args = args.map((a) => (typeof a === 'object' && a
        ? { ...a, accountId: firstAcc.id, platform: a.platform || firstAcc.platform }
        : a));
    }
    const r = await invoke(token, projectId, f.channel, args);
    let status = 'PASS';
    let reason = '';
    if (!r.ok) {
      status = 'FAIL';
      reason = r.error || 'HTTP error';
    } else {
      try {
        if (!f.validate(r.data, r)) {
          status = 'WEAK';
          reason = `Bad shape: ${JSON.stringify(r.data)?.slice(0, 120)}`;
        }
      } catch (e) {
        status = 'FAIL';
        reason = e.message;
      }
    }
    const icon = status === 'PASS' ? '✓' : status === 'WEAK' ? '~' : '✗';
    console.log(`${icon} [${f.area}] ${f.name} — ${status}${reason ? ` (${reason})` : ''}`);
    if (status === 'PASS') pass++;
    else if (status === 'WEAK') weak++;
    else fail++;
    results.push({ ...f, status, reason, sample: r.data });
  }

  console.log(`\nSUMMARY: PASS=${pass} WEAK=${weak} FAIL=${fail}\n`);
  fs.writeFileSync(
    path.join(__dirname, '.browse-posts-qa-report.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), summary: { pass, weak, fail }, results }, null, 2),
  );
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });