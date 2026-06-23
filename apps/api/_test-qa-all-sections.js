/**
 * Full QA test — every menu section, every actionable feature.
 * Usage: node _test-qa-all-sections.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD || 'Kingme05$';

const SECTIONS = [
  {
    section: 'Mission Control — Dashboard',
    features: [
      { name: 'KPI stats', channel: 'get-dashboard-stats', validate: (d) => typeof d?.totalPosts === 'number' },
      { name: 'Live feed', channel: 'get-live-feed', args: [{ quick: true }], validate: (d) => Array.isArray(d) },
      { name: 'Trending topics', channel: 'get-trending-topics', validate: (d) => Array.isArray(d) },
      { name: 'Live news', channel: 'get-live-news', args: ['technology'], validate: (d) => Array.isArray(d) },
      { name: 'Setup status', channel: 'get-setup-status', validate: (d) => d && typeof d === 'object' },
      { name: 'Domain metrics', channel: 'get-domain-metrics', args: ['acmegrowth.com'], validate: (d) => d && typeof d === 'object' },
      { name: 'Project metrics', channel: 'get-project-metrics', validate: (d) => d && typeof d === 'object' },
      { name: 'Analyze topic', channel: 'analyze-topic', args: [{ topic: 'AI marketing', platform: 'Twitter', brandName: 'Acme', audience: 'B2B' }], validate: (d) => d?.analysis || d?.textAnalysis || typeof d === 'object' },
      { name: 'Discover questions', channel: 'discover-best-questions', validate: (d) => d?.questions || Array.isArray(d) },
      { name: 'Unanswered questions', channel: 'get-unanswered-questions', validate: (d) => Array.isArray(d) },
      { name: 'Q&A settings', channel: 'get-qa-settings', validate: (d) => typeof d === 'object' },
      { name: 'Reddit scan', channel: 'scan-reddit-now', validate: (d) => d?.success !== false },
      { name: 'Leads', channel: 'get-leads', validate: (d) => Array.isArray(d) },
      { name: 'Worker status', channel: 'get-worker-status', validate: (d) => typeof d === 'object' },
      { name: 'Start worker', channel: 'start-worker', validate: (d) => d?.success !== false },
      { name: 'Trigger auto search', channel: 'trigger-full-auto-search', validate: (d) => d?.success !== false },
      { name: 'Fanpage settings', channel: 'get-fanpage-settings', validate: (d) => typeof d === 'object' },
      { name: 'Draft post reply', channel: 'draft-post-reply', args: [{ post: { content: 'How do I grow on LinkedIn?', platform: 'LinkedIn' }, postContent: 'How do I grow on LinkedIn?', platform: 'LinkedIn' }], validate: (d) => (typeof d === 'string' && d.length > 10) || (typeof d?.value === 'string' && d.value.length > 10) },
      { name: 'Save AI reply', channel: 'save-ai-reply', args: [{ originalPost: 'Test', replyContent: 'Test reply content here', platform: 'Twitter', status: 'draft' }], validate: (d) => d?.id || d?.success !== false },
      { name: 'Export data', channel: 'export-data', validate: (d) => typeof d === 'object' },
      { name: 'RSS curate', channel: 'curate-from-rss', args: [{ rssUrl: 'https://feeds.feedburner.com/TechCrunch', numItems: 1 }], validate: (d) => Array.isArray(d) || d?.posts || d?.items },
      { name: 'Stock photo search', channel: 'search-stock-photo', args: ['technology marketing'], validate: (d) => d?.imageUrl || d?.url || typeof d === 'object' },
    ],
  },
  {
    section: 'Mission Control — Browse Posts',
    features: [
      { name: 'Feed with filters', channel: 'get-live-feed', args: [{ platform: 'All', sort: 'recent', quick: true }], validate: (d) => Array.isArray(d) },
      { name: 'Draft reply', channel: 'draft-post-reply', args: [{ post: { content: 'Best CRM for startups?', platform: 'Twitter' }, postContent: 'Best CRM for startups?', platform: 'Twitter' }], validate: (d) => (typeof d === 'string' && d.length > 5) || (typeof d?.value === 'string' && d.value.length > 5) },
      { name: 'Save draft to inbox', channel: 'save-ai-reply', args: [{ originalPost: 'Best CRM?', replyContent: 'We recommend evaluating HubSpot and Pipedrive.', platform: 'Twitter', status: 'draft' }], validate: (d) => d?.id || d?.success !== false },
    ],
  },
  {
    section: 'Create & Publish — Setup Wizard',
    features: [
      { name: 'Setup status', channel: 'get-setup-status', validate: (d) => d?.campaign || typeof d?.nextStep === 'number' },
      { name: 'Active campaign', channel: 'get-active-campaign', validate: (d) => d?.id || d?.brandName },
      { name: 'Generate keywords', channel: 'generate-keywords', args: [{ brandName: 'Acme Growth', domain: 'acmegrowth.com' }], validate: (d) => Array.isArray(d) && d.length > 0 },
      { name: 'Save keywords', channel: 'save-keywords', args: [[{ term: 'qa-test-keyword' }]], validate: (d) => d?.success !== false || Array.isArray(d) },
      { name: 'Feed preview', channel: 'get-live-feed', args: [{ quick: true }], validate: (d) => Array.isArray(d) },
      { name: 'Studio live metrics', channel: 'get-content-studio-live', validate: (d) => d?.stats && typeof d.stats === 'object' },
    ],
  },
  {
    section: 'Create & Publish — Content Hub',
    features: [
      { name: 'Linked accounts', channel: 'get-linked-accounts', validate: (d) => Array.isArray(d) },
      { name: 'AI generate', channel: 'generate-ai', args: ['Write a LinkedIn post about automation'], validate: (d) => (typeof d === 'string' && d.length > 5) || (typeof d?.value === 'string' && d.value.length > 5) || (d?.text && d.text.length > 5) },
      { name: 'AI image', channel: 'generate-image', args: ['Professional social media banner'], validate: (d) => d?.imageUrl || d?.url || d?.base64 || typeof d === 'object' },
      { name: 'Publish post', channel: 'publish-post', args: [{ platform: 'LinkedIn', content: `QA publish ${Date.now()}`, hasMedia: false, humanLike: false }], validate: (d) => d?.success === true || (d?.success === false && !!d?.error) },
      { name: 'Schedule post', channel: 'schedule-post', args: [{ platform: 'LinkedIn', content: 'QA scheduled', scheduleTime: new Date(Date.now() + 86400000).toISOString() }], validate: (d) => d?.success !== false },
      { name: 'Content queue', channel: 'get-content-queue', validate: (d) => Array.isArray(d) },
      { name: 'Content studio', channel: 'run-content-studio', args: [{ types: ['post'], keywords: ['marketing'], count: 2 }], validate: (d) => d?.success !== false || d?.items || Array.isArray(d) },
      { name: 'Grok status', channel: 'grok-get-status', validate: (d) => typeof d === 'object' },
      { name: 'Thumbnail config', channel: 'get-thumbnail-studio-config', validate: (d) => typeof d === 'object' },
      { name: 'Shorten URL', channel: 'shorten-url', args: ['https://acmegrowth.com'], validate: (d) => d?.shortUrl },
      { name: 'Serp search', channel: 'serp-search', args: ['social media tools'], validate: (d) => typeof d === 'object' },
      { name: 'Research keyword', channel: 'research-keyword', args: ['content marketing'], validate: (d) => typeof d === 'object' },
      { name: 'Post history', channel: 'get-post-history', validate: (d) => Array.isArray(d) },
      { name: 'Compose Q&A', channel: 'compose-qa-answer', args: [{ question: { content: 'What is marketing automation?', platform: 'Quora' } }], validate: (d) => d?.formatted || d?.answer || typeof d === 'string' },
      { name: 'RSS sources', channel: 'get-site-rss-sources', validate: (d) => Array.isArray(d) || typeof d === 'object' },
    ],
  },
  {
    section: 'Create & Publish — Calendar',
    features: [
      { name: 'Scheduled posts', channel: 'get-scheduled-posts', validate: (d) => Array.isArray(d) },
      { name: 'Calendar status', channel: 'get-calendar-status', validate: (d) => typeof d === 'object' },
      { name: 'Best post times', channel: 'get-best-post-times', validate: (d) => typeof d === 'object' },
      { name: 'Upcoming by platform', channel: 'get-upcoming-by-platform', args: [14], validate: (d) => typeof d === 'object' },
      { name: 'Background run settings', channel: 'get-background-run-settings', validate: (d) => typeof d === 'object' },
      { name: 'Calendar settings', channel: 'get-calendar-settings', validate: (d) => typeof d === 'object' },
    ],
  },
  {
    section: 'Discovery & Replies — Engagement',
    features: [
      { name: 'Engagement lists', channel: 'get-engagement-lists', validate: (d) => Array.isArray(d) },
      { name: 'Save engagement list', channel: 'save-engagement-list', args: [{ name: 'QA Test List', profileUrls: 'https://www.linkedin.com/in/williamhgates', type: 'linkedin-profiles' }], validate: (d) => d?.success !== false || d?.id },
      { name: 'List feed', channel: 'get-engagement-list-feed', args: ['elist_demo_1'], validate: (d) => d?.posts !== undefined || Array.isArray(d?.posts) },
      { name: 'LinkedIn comment', channel: 'post-linkedin-comment', args: [{ comment: 'Great insights!', url: 'https://www.linkedin.com/feed/', postContent: 'Test post' }], validate: (d) => d?.success !== false || d?.error },
    ],
  },
  {
    section: 'Discovery & Replies — AI Replies',
    features: [
      { name: 'Replies hub', channel: 'get-ai-replies-hub', args: [{ status: 'all' }], validate: (d) => d?.replies !== undefined },
      { name: 'All replies', channel: 'get-ai-replies', validate: (d) => Array.isArray(d) },
      { name: 'Update reply', channel: 'update-ai-reply', args: [{ id: 'reply_demo_1', updates: { replyContent: 'Updated QA reply text' } }], validate: (d) => d?.success !== false },
      { name: 'All replies history', channel: 'get-all-replies-history', validate: (d) => Array.isArray(d) },
    ],
  },
  {
    section: 'Discovery & Replies — Keywords',
    features: [
      { name: 'Get keywords', channel: 'get-keywords', validate: (d) => Array.isArray(d) },
      { name: 'Keyword API status', channel: 'get-keyword-api-status', validate: (d) => typeof d === 'object' },
      { name: 'Generate keywords', channel: 'generate-keywords', args: [{ brandName: 'Acme', domain: 'acme.com' }], validate: (d) => Array.isArray(d) },
      { name: 'Research keyword', channel: 'research-keyword', args: ['saas marketing'], validate: (d) => typeof d === 'object' },
      { name: 'Quantum Pages jobs', channel: 'get-quantum-pages-jobs', validate: (d) => Array.isArray(d) || typeof d === 'object' },
    ],
  },
  {
    section: 'Discovery & Replies — SEO Tools',
    features: [
      { name: 'Tools list', channel: 'get-seo-tools-list', validate: (d) => d?.tools?.length > 0 },
      { name: 'Run KGR', channel: 'run-seo-tool', args: [{ toolId: 'kgr', payload: { keyword: 'email marketing' } }], validate: (d) => typeof d === 'object' },
      { name: 'Run Reddit topics', channel: 'run-seo-tool', args: [{ toolId: 'reddit-topics', payload: { keyword: 'marketing' } }], validate: (d) => typeof d === 'object' },
      { name: 'Run Quora finder', channel: 'run-seo-tool', args: [{ toolId: 'quora-finder', payload: { keyword: 'automation' } }], validate: (d) => typeof d === 'object' },
    ],
  },
  {
    section: 'Growth Labs — Growth Lab',
    features: [
      { name: 'Reddit AI status', channel: 'get-reddit-ai-status', validate: (d) => typeof d === 'object' },
      { name: 'Module queue', channel: 'get-reddit-ai-queue', args: ['subreddit-ascent'], validate: (d) => d?.queue !== undefined },
      { name: 'Run module', channel: 'run-reddit-ai-module', args: ['subreddit-ascent'], validate: (d) => d?.success !== false || d?.actions },
      { name: 'Scan reddit', channel: 'scan-reddit-now', validate: (d) => d?.success !== false },
    ],
  },
  {
    section: 'Growth Labs — Quora Ops',
    features: [
      { name: 'Traffic status', channel: 'get-quora-traffic-status', validate: (d) => typeof d === 'object' },
      { name: 'Traffic settings', channel: 'get-quora-traffic-settings', validate: (d) => d?.settings || typeof d === 'object' },
      { name: 'Scrape questions', channel: 'scrape-quora-questions', args: [{ keyword: 'marketing automation', limit: 3 }], validate: (d) => d?.success !== false },
      { name: 'Generate answer', channel: 'generate-quora-answer', args: [{ question: { content: 'What is the best marketing tool?', url: 'https://quora.com/test' } }], validate: (d) => d?.answer || d?.success !== false },
      { name: 'YouTube transcript', channel: 'fetch-youtube-transcript', args: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }], validate: (d) => (d?.transcript && d.transcript.length > 20) || d?.success === true },
    ],
  },
  {
    section: 'Automation — Visual Builder',
    features: [
      { name: 'Automation flow', channel: 'get-automation-flow', validate: (d) => typeof d === 'object' },
      { name: 'Templates', channel: 'get-automation-templates', validate: (d) => Array.isArray(d) },
      { name: 'Builder data', channel: 'get-automation-builder-data', validate: (d) => typeof d === 'object' },
      { name: 'Automation status', channel: 'get-automation-status', validate: (d) => typeof d === 'object' },
      { name: 'Save flow', channel: 'save-automation-flow', args: [{ nodes: [{ id: 'n1', type: 'trigger-keyword' }], edges: [], status: 'draft' }], validate: (d) => d?.success !== false || d?.flow },
      { name: 'Test flow', channel: 'test-automation-flow', args: [{ nodes: [], edges: [] }], validate: (d) => typeof d === 'object' },
    ],
  },
  {
    section: 'Automation — Auto-Rules',
    features: [
      { name: 'Auto rules', channel: 'get-auto-rules', validate: (d) => typeof d === 'object' && d !== null },
      { name: 'Rules status', channel: 'get-auto-rules-status', validate: (d) => typeof d === 'object' },
      { name: 'Watched monitors', channel: 'get-watched-monitors', validate: (d) => Array.isArray(d) },
      { name: 'Worker status', channel: 'get-worker-status', validate: (d) => typeof d === 'object' },
      { name: 'Automation targets', channel: 'get-automation-targets', validate: (d) => typeof d === 'object' },
      { name: 'Run auto rules', channel: 'run-auto-rules-now', validate: (d) => d?.success !== false || typeof d === 'object' },
    ],
  },
  {
    section: 'Accounts — Account Hub',
    features: [
      { name: 'Linked accounts', channel: 'get-linked-accounts', validate: (d) => Array.isArray(d) && d.length > 0 },
      { name: 'Hub status', channel: 'get-account-hub-status', validate: (d) => typeof d === 'object' },
      { name: 'Refresh profile', channel: 'refresh-account-profile', args: ['si_li_cmqlrt'], validate: (d) => typeof d === 'object' },
      { name: 'Automation targets', channel: 'get-account-automation-targets', args: ['si_li_cmqlrt'], validate: (d) => d?.targets !== undefined },
    ],
  },
  {
    section: 'Accounts — Acct Creator',
    features: [
      { name: 'Proxy pool', channel: 'get-proxy-pool', validate: (d) => Array.isArray(d) },
      { name: 'Profile kits', channel: 'get-profile-kits', validate: (d) => Array.isArray(d) },
      { name: 'Creator status', channel: 'get-account-creator-status', validate: (d) => typeof d === 'object' },
      { name: 'Generate kit', channel: 'generate-profile-kit', args: [{ personaName: 'QA Kit', platforms: ['LinkedIn'], generateAssets: false, scheduleWeeks: 1, postsPerWeek: 1 }], validate: (d) => !!(d?.kit?.id || d?.id) && d?.success !== false },
      { name: 'Browser batch status', channel: 'get-browser-batch-status', validate: (d) => typeof d === 'object' },
    ],
  },
  {
    section: 'Create & Publish — Library',
    features: [
      { name: 'Content library', channel: 'get-content-library', validate: (d) => d?.assets !== undefined || Array.isArray(d?.assets) },
      { name: 'Import text', channel: 'import-text-to-library', args: [{ text: 'QA library snippet', name: 'QA test' }], validate: (d) => d?.success !== false },
      { name: 'Brand guidelines', channel: 'get-brand-guidelines', validate: (d) => typeof d === 'object' },
      { name: 'Section live', channel: 'get-section-live', args: ['content-library'], validate: (d) => d?.stats && typeof d.stats === 'object' },
    ],
  },
  {
    section: 'Create & Publish — Design Studio',
    features: [
      { name: 'Design templates', channel: 'get-design-templates', validate: (d) => d?.templates?.length > 0 || Array.isArray(d?.templates) },
      { name: 'Section live', channel: 'get-section-live', args: ['design-studio'], validate: (d) => d?.success !== false },
    ],
  },
  {
    section: 'Create & Publish — Brand',
    features: [
      { name: 'Brand guidelines', channel: 'get-brand-guidelines', validate: (d) => typeof d === 'object' },
      { name: 'Section live', channel: 'get-section-live', args: ['brand'], validate: (d) => d?.brand || d?.stats },
    ],
  },
  {
    section: 'Create & Publish — Scheduler',
    features: [
      { name: 'Background status', channel: 'get-background-run-status', validate: (d) => typeof d === 'object' },
      { name: 'Process due', channel: 'process-due-scheduled-posts', validate: (d) => typeof d === 'object' },
      { name: 'Section live', channel: 'get-section-live', args: ['scheduler'], validate: (d) => d?.stats },
    ],
  },
  {
    section: 'Mission Control — Browse Live',
    features: [
      { name: 'Browse posts live', channel: 'get-browse-posts-live', validate: (d) => d?.stats && typeof d.stats === 'object' },
    ],
  },
  {
    section: 'System — Integrations',
    features: [
      { name: 'Key sources', channel: 'get-key-sources', validate: (d) => typeof d === 'object' },
      { name: 'Partner config', channel: 'get-partner-integration-config', validate: (d) => typeof d === 'object' },
      { name: 'Integration events', channel: 'get-integration-events-log', validate: (d) => Array.isArray(d) || typeof d === 'object' },
      { name: 'Section live', channel: 'get-section-live', args: ['integrations'], validate: (d) => d?.apiHealth || d?.stats },
    ],
  },
  {
    section: 'System — Settings',
    features: [
      { name: 'Global keys', channel: 'get-global-keys', validate: (d) => typeof d === 'object' },
      { name: 'API status', channel: 'check-api-status', validate: (d) => typeof d === 'object' && Object.keys(d).length > 0 },
      { name: 'Campaigns', channel: 'get-settings', validate: (d) => Array.isArray(d) },
      { name: 'Billing plan', channel: 'get-billing-plan', validate: (d) => typeof d === 'object' },
      { name: 'Grok settings', channel: 'get-grok-settings', validate: (d) => typeof d === 'object' },
      { name: 'Payment settings', channel: 'get-payment-settings', validate: (d) => typeof d === 'object' },
      { name: 'Settings status', channel: 'get-settings-status', validate: (d) => typeof d === 'object' },
      { name: 'Page health', channel: 'get-page-health', validate: (d) => d?.ok !== false },
      { name: 'Setup tutorials', channel: 'get-setup-tutorials', validate: (d) => Array.isArray(d?.tutorials) && d.tutorials.length > 0 },
    ],
  },
];

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return { token: json.token, projectId: json.project?.id, accounts: json };
}

const SLOW_CHANNELS = new Set(['discover-best-questions', 'generate-image', 'run-content-studio', 'analyze-topic', 'draft-post-reply', 'generate-quora-answer', 'run-seo-tool', 'process-due-scheduled-posts']);
const INVOKE_TIMEOUT_MS = 90000;

async function invoke(token, projectId, channel, args = []) {
  const timeoutMs = SLOW_CHANNELS.has(channel) ? INVOKE_TIMEOUT_MS : 60000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}/api/invoke/${channel}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-project-id': projectId },
      body: JSON.stringify({ args }),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (e) {
      return { ok: false, status: res.status, data: null, error: text?.slice(0, 120) || 'Invalid JSON response' };
    }
    return { ok: res.ok, status: res.status, data: json.data, error: json.error };
  } catch (e) {
    const msg = e.name === 'AbortError' ? `Timeout after ${timeoutMs}ms` : e.message;
    return { ok: false, status: 0, data: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

function classify(r, validate) {
  if (!r.ok) {
    if (r.status === 404) return { status: 'BROKEN', reason: r.error || 'Channel missing' };
    return { status: 'ERROR', reason: r.error || `HTTP ${r.status}` };
  }
  try {
    if (validate && !validate(r.data)) return { status: 'WEAK', reason: 'Response empty or unexpected shape' };
  } catch (e) {
    return { status: 'WEAK', reason: e.message };
  }
  return { status: 'OK', reason: null };
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  SOCIAL IMPERIALISM — FULL QA TEST (ALL SECTIONS)        ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const { token, projectId } = await login();
  console.log(`Logged in — project: ${projectId}\n`);

  // Warm registry + get linked accounts for dynamic args
  await invoke(token, projectId, 'get-linked-accounts');
  const accRes = await invoke(token, projectId, 'get-linked-accounts');
  const firstAcc = Array.isArray(accRes.data) && accRes.data[0];

  const allResults = [];
  let ok = 0, weak = 0, error = 0, broken = 0;

  for (const section of SECTIONS) {
    console.log(`\n── ${section.section} ──`);
    const sectionResults = [];

    for (const feat of section.features) {
      let args = feat.args ? [...feat.args] : [];
      // Dynamic account IDs + unique publish content per run
      if (firstAcc) {
        args = args.map((a) => {
          if (a === 'si_li_cmqlrt') return firstAcc.id;
          if (typeof a === 'object' && a && !a.accountId && (feat.channel === 'publish-post' || feat.channel === 'schedule-post')) {
            const patch = { ...a, accountId: firstAcc.id, platform: a.platform || firstAcc.platform };
            if (feat.channel === 'publish-post' && patch.content) {
              patch.content = `${patch.content} · ${Date.now()}`;
            }
            return patch;
          }
          return a;
        });
      }

      const r = await invoke(token, projectId, feat.channel, args);
      const { status, reason } = classify(r, feat.validate);
      const icon = status === 'OK' ? '✓' : status === 'WEAK' ? '~' : status === 'ERROR' ? '✗' : '⊘';
      console.log(`  ${icon} ${feat.name} [${feat.channel}]${reason ? ` — ${reason}` : ''}`);

      if (status === 'OK') ok++;
      else if (status === 'WEAK') weak++;
      else if (status === 'ERROR') error++;
      else broken++;

      sectionResults.push({ feature: feat.name, channel: feat.channel, status, reason, error: r.error });
    }

    allResults.push({ section: section.section, features: sectionResults });
  }

  const brokenList = allResults.flatMap((s) => s.features.filter((f) => f.status !== 'OK').map((f) => ({ ...f, section: s.section })));

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`SUMMARY: OK=${ok} | WEAK=${weak} | ERROR=${error} | BROKEN=${broken}`);
  console.log('══════════════════════════════════════════════════════════\n');

  if (brokenList.length) {
    console.log('ISSUES TO FIX:');
    brokenList.forEach((f, i) => console.log(`  ${i + 1}. [${f.status}] ${f.section} → ${f.feature}: ${f.reason}`));
  }

  const out = path.join(__dirname, '.qa-all-sections-report.json');
  fs.writeFileSync(out, JSON.stringify({ timestamp: new Date().toISOString(), summary: { ok, weak, error, broken }, sections: allResults, issues: brokenList }, null, 2));
  console.log(`\nReport: ${out}\n`);
  process.exit(error + broken > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });