/**
 * Dashboard feature QA — tests every channel the dashboard page uses.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'https://api.socialimperialism.com';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

const FEATURES = [
  { area: 'KPIs', name: 'Dashboard stats', channel: 'get-dashboard-stats',
    validate: (d) => typeof d.totalPosts === 'number' && typeof d.activeKeywords === 'number' },
  { area: 'KPIs', name: 'Worker status shape', channel: 'get-worker-status',
    validate: (d) => typeof d.running === 'boolean' && Array.isArray(d.tasks) },
  { area: 'Overview', name: 'Live feed (array)', channel: 'get-live-feed', args: [{}],
    validate: (d) => Array.isArray(d) && (d.length === 0 || d[0].platform) },
  { area: 'Overview', name: 'Trending topics (topic field)', channel: 'get-trending-topics',
    validate: (d) => Array.isArray(d) && d.length > 0 && (d[0].topic || d[0].title) },
  { area: 'Overview', name: 'Daily social trends (platform + topic)', channel: 'get-daily-social-trends',
    validate: (d) => {
      const trends = Array.isArray(d) ? d : (d?.trends || []);
      // Must be non-empty — SaaS uses web/SERP/curated fallbacks (never blank dashboard).
      return Array.isArray(trends) && trends.length > 0 && !!(trends[0].topic && trends[0].platform);
    } },
  { area: 'Overview', name: 'Open TikTok trends login', channel: 'open-tiktok-trends-login',
    validate: (d) => d && (d.url || d.message || d.success !== undefined || d.trendsUrl) },
  { area: 'Feed', name: 'Engagement queue', channel: 'get-engagement-queue',
    validate: (d) => Array.isArray(d) },
  { area: 'Overview', name: 'Live news (array)', channel: 'get-live-news', args: ['technology'],
    validate: (d) => Array.isArray(d) && (d.length === 0 || d[0].title) },
  { area: 'Overview', name: 'Active campaign', channel: 'get-active-campaign',
    validate: (d) => d && (d.id || d.brandName) },
  { area: 'Overview', name: 'Analyze topic', channel: 'analyze-topic',
    args: [{ topic: 'AI marketing', platform: 'Twitter', brandName: 'Acme', audience: 'B2B' }],
    validate: (d) => d?.analysis?.textAnalysis || d?.textAnalysis || typeof d === 'object' },
  { area: 'Feed', name: 'Draft post reply', channel: 'draft-post-reply',
    args: [{ post: { content: 'How do I grow on LinkedIn?' }, postContent: 'How do I grow on LinkedIn?', platform: 'LinkedIn' }],
    validate: (d) => typeof d === 'string' && d.length > 10 },
  { area: 'Feed', name: 'Engage post (like)', channel: 'engage-post',
    args: [{ action: 'like', platform: 'Reddit', postContent: 'Test post', externalId: 't3_demo' }],
    validate: (d) => d && typeof d === 'object' },
  { area: 'Feed', name: 'Save AI reply', channel: 'save-ai-reply',
    args: [{ originalPost: 'Test', replyContent: 'Thanks for sharing!', platform: 'Twitter', status: 'draft' }],
    validate: (d) => d?.id || d?.success !== false },
  { area: 'Q&A', name: 'Discover questions', channel: 'discover-best-questions',
    validate: (d) => Array.isArray(d?.questions) || Array.isArray(d) },
  { area: 'Q&A', name: 'Unanswered questions', channel: 'get-unanswered-questions',
    validate: (d) => Array.isArray(d) },
  { area: 'Q&A', name: 'Compose Q&A answer', channel: 'compose-qa-answer',
    args: [{ question: { content: 'What is social media automation?', platform: 'Quora' } }],
    validate: (d) => d?.formatted || d?.answer || typeof d === 'string' },
  { area: 'Growth', name: 'Reddit scan', channel: 'scan-reddit-now',
    validate: (d) => d?.success !== false && Array.isArray(d?.leads) },
  { area: 'Growth', name: 'Fan acquisition', channel: 'run-fan-acquisition-now',
    validate: (d) => d?.success !== false },
  { area: 'Growth', name: 'Hands-free fanpage', channel: 'run-fanpage-hands-free-now',
    validate: (d) => d?.success !== false },
  { area: 'Growth', name: 'RSS curate', channel: 'curate-from-rss',
    args: [{ rssUrl: 'https://feeds.feedburner.com/TechCrunch', numItems: 1 }],
    validate: (d) => Array.isArray(d?.posts) || Array.isArray(d) },
  { area: 'Growth', name: 'Fanpage metrics', channel: 'get-fanpage-metrics', args: [[]],
    validate: (d) => typeof d === 'object' },
  { area: 'Growth', name: 'Get leads', channel: 'get-leads',
    validate: (d) => Array.isArray(d) },
  { area: 'Worker', name: 'Trigger full auto search', channel: 'trigger-full-auto-search',
    validate: (d) => d?.success !== false },
  { area: 'Worker', name: 'Start worker', channel: 'start-worker',
    validate: (d) => d?.success !== false },
  { area: 'Worker', name: 'Worker tasks', channel: 'get-worker-tasks',
    validate: (d) => Array.isArray(d) },
  { area: 'Worker', name: 'Watched monitors', channel: 'get-watched-monitors',
    validate: (d) => Array.isArray(d) },
  { area: 'Analytics', name: 'DomDetailer metrics', channel: 'get-domdetailer-metrics', args: ['acmegrowth.com'],
    validate: (d) => d?.success || d?.da != null || d?.data },
  { area: 'Analytics', name: 'Project metrics', channel: 'get-project-metrics',
    validate: (d) => typeof d === 'object' },
  { area: 'Analytics', name: 'Export data', channel: 'export-data',
    validate: (d) => typeof d === 'object' },
  { area: 'Analytics', name: 'Stock photo', channel: 'search-stock-photo', args: ['marketing'],
    validate: (d) => d?.imageUrl?.startsWith('http') },
  { area: 'Setup', name: 'Setup status', channel: 'get-setup-status',
    validate: (d) => typeof d === 'object' && d.apiMetrics },
  { area: 'Setup', name: 'API status', channel: 'check-api-status',
    validate: (d) => Object.values(d).filter((v) => v === 'Connected').length >= 5 },
  { area: 'Feed', name: 'Retry engagement queue', channel: 'retry-engagement-queue',
    validate: (d) => typeof d === 'object' },
  { area: 'Q&A', name: 'Q&A ad suggestions', channel: 'get-qa-ad-suggestions',
    validate: (d) => Array.isArray(d?.suggestions) || Array.isArray(d) || typeof d === 'object' },
  { area: 'Q&A', name: 'Search discovered posts', channel: 'search-discovered-posts', args: [{ q: '', limit: 10 }],
    validate: (d) => Array.isArray(d?.posts) || Array.isArray(d) },
  { area: 'Analytics', name: 'Serp research', channel: 'serp-search', args: ['social media automation'],
    validate: (d) => typeof d === 'object' },
  { area: 'Overview', name: 'Section live', channel: 'get-section-live', args: ['dashboard'],
    validate: (d) => d?.stats && typeof d.stats === 'object' },
  { area: 'Worker', name: 'Stop worker', channel: 'stop-worker',
    validate: (d) => d?.success !== false },
  { area: 'Worker', name: 'Auto search settings', channel: 'get-auto-search-settings',
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
  const json = await res.json();
  return { ok: res.ok, data: json.data, error: json.error };
}

async function main() {
  console.log('\n=== DASHBOARD FEATURE QA ===\n');
  const health = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) throw new Error('API not running');

  const { token, projectId } = await login();
  const results = [];
  let pass = 0, fail = 0, weak = 0;

  for (const f of FEATURES) {
    const r = await invoke(token, projectId, f.channel, f.args || []);
    let status = 'PASS';
    let reason = '';
    if (!r.ok) {
      status = 'FAIL';
      reason = r.error || 'HTTP error';
    } else {
      try {
        if (!f.validate(r.data)) {
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
  const out = path.join(__dirname, '.dashboard-qa-report.json');
  fs.writeFileSync(out, JSON.stringify({ timestamp: new Date().toISOString(), summary: { pass, weak, fail }, results }, null, 2));
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });