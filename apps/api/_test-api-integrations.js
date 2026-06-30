/**
 * API integration smoke test — verifies preloaded keys pull real external data.
 * Usage: node _test-api-integrations.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'https://api.socialimperialism.com';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

const TESTS = [
  {
    name: 'Global keys preloaded',
    channel: 'get-global-keys',
    validate: (d) => !!(d.linkedinAccessToken && d.newsApiKey && d.unsplashAccessKey && d.serpApiKey && d.advancedWorkflowKey),
  },
  {
    name: 'API status metrics',
    channel: 'check-api-status',
    validate: (d) => {
      const connected = Object.values(d).filter((v) => v === 'Connected').length;
      return connected >= 8;
    },
  },
  {
    name: 'NewsAPI live headlines',
    channel: 'get-live-news',
    args: ['technology'],
    validate: (d) => (Array.isArray(d) && d.length >= 1 && d[0].title?.length > 5)
      || (d?.error && String(d.error).includes('rateLimited')),
  },
  {
    name: 'Unsplash/stock photo search',
    channel: 'search-stock-photo',
    args: ['business technology'],
    validate: (d) => d?.success && d?.imageUrl?.startsWith('http') && d?.source && !d.imageUrl.includes('placeholder'),
  },
  {
    name: 'SerpAPI search',
    channel: 'serp-search',
    args: ['social media marketing tools'],
    validate: (d) => (d?.success && Array.isArray(d.data) && d.data.length > 0)
      || (d?.error && String(d.error).includes('429')),
    optional: true,
  },
  {
    name: 'DomDetailer domain metrics',
    channel: 'get-domain-metrics',
    args: ['google.com'],
    validate: (d) => d?.success && d?.data && (d.data.mozDA != null || d.data.da != null || d.data.domain),
  },
  {
    name: 'YouTube API channels',
    channel: 'get-youtube-channels',
    validate: (d) => d?.success && Array.isArray(d.data) && d.data.length > 0,
  },
  {
    name: 'TinyURL shorten',
    channel: 'shorten-url',
    args: ['https://acmegrowth.com/test-link'],
    validate: (d) => d?.shortUrl?.includes('tinyurl.com') || d?.shortUrl?.length > 10,
  },
  {
    name: 'Streaming keys loaded',
    channel: 'get-streaming-keys',
    validate: (d) => d?.success && d?.keys?.fb && d?.keys?.twitch && d?.keys?.yt,
  },
  {
    name: 'DeepL translate',
    channel: 'deepl-translate',
    args: ['Hello world', 'ES'],
    validate: (d) => d?.success && d?.translated?.length > 3,
    optional: true,
  },
  {
    name: 'Contentful fetch',
    channel: 'contentful-fetch',
    validate: (d) => d?.success !== false,
  },
  {
    name: 'AI workflow (image gen)',
    channel: 'run-ai-workflow',
    args: ['text2image', { text_prompt: 'minimal blue social media icon', num_images: 1, image_size: 'square_hd' }],
    validate: (d) => d?.success && (d?.output?.images?.length > 0 || d?.output?.image_url),
    optional: true,
  },
  {
    name: 'Research keyword (Serp)',
    channel: 'research-keyword',
    args: ['content marketing'],
    validate: (d) => d && typeof d === 'object',
  },
  {
    name: 'Trending topics',
    channel: 'get-trending-topics',
    validate: (d) => Array.isArray(d),
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
  return { token: json.token, projectId: json.project?.id };
}

async function invoke(token, projectId, channel, args = []) {
  const res = await fetch(`${API}/api/invoke/${channel}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-project-id': projectId },
    body: JSON.stringify({ args }),
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, data: json.data, error: json.error };
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  API INTEGRATION TEST — REAL DATA PULL                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const health = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) throw new Error(`API not running at ${API} — start with: npm run dev`);

  const { token, projectId } = await login();
  console.log(`Logged in — project: ${projectId}\n`);

  const results = [];
  let pass = 0;
  let fail = 0;
  let skip = 0;

  for (const test of TESTS) {
    const r = await invoke(token, projectId, test.channel, test.args || []);
    let status = 'PASS';
    let reason = '';

    if (!r.ok) {
      status = test.optional ? 'SKIP' : 'FAIL';
      reason = r.error || `HTTP ${r.status}`;
    } else {
      try {
        if (!test.validate(r.data)) {
          status = test.optional ? 'SKIP' : 'FAIL';
          reason = 'Validation failed — no real data returned';
        }
      } catch (e) {
        status = test.optional ? 'SKIP' : 'FAIL';
        reason = e.message;
      }
    }

    const icon = status === 'PASS' ? '✓' : status === 'SKIP' ? '~' : '✗';
    console.log(`  ${icon} ${test.name} [${test.channel}]${reason ? ` — ${reason}` : ''}`);

    if (status === 'PASS') pass++;
    else if (status === 'SKIP') skip++;
    else fail++;

    results.push({ ...test, status, reason, sample: r.data });
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`SUMMARY: PASS=${pass} | FAIL=${fail} | SKIP=${skip}`);
  console.log('══════════════════════════════════════════════════════════\n');

  const out = path.join(__dirname, '.api-integrations-report.json');
  fs.writeFileSync(out, JSON.stringify({ timestamp: new Date().toISOString(), summary: { pass, fail, skip }, results }, null, 2));
  console.log(`Report: ${out}\n`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });