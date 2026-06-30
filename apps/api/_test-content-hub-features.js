/**
 * Content Hub feature QA — every channel the /content-hub page uses.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

const FEATURES = [
  { area: 'Meta', name: 'Linked accounts', channel: 'get-linked-accounts', validate: (d) => Array.isArray(d) },
  { area: 'Meta', name: 'Content queue', channel: 'get-content-queue', validate: (d) => Array.isArray(d) },
  { area: 'Meta', name: 'Scheduled posts', channel: 'get-scheduled-posts', validate: (d) => Array.isArray(d) },
  { area: 'Meta', name: 'Content library', channel: 'get-content-library', validate: (d) => d?.assets !== undefined || typeof d?.count === 'number' },
  { area: 'Meta', name: 'Studio live', channel: 'get-content-studio-live', validate: (d) => d?.stats && typeof d.stats === 'object' },
  { area: 'Meta', name: 'Section live', channel: 'get-section-live', args: ['content-hub'], validate: (d) => d?.stats && typeof d.stats === 'object' },
  { area: 'Meta', name: 'Brand guidelines', channel: 'get-brand-guidelines', validate: (d) => typeof d === 'object' },
  { area: 'Meta', name: 'Active campaign', channel: 'get-active-campaign', validate: (d) => d?.id || d?.brandName },
  { area: 'Generate', name: 'AI generate', channel: 'generate-ai', args: ['Write a LinkedIn post about social automation for QA.'], validate: (d) => (typeof d === 'string' && d.length > 5) || typeof d?.value === 'string' },
  { area: 'Generate', name: 'AI image', channel: 'generate-image', args: ['Minimal social media banner flat design'], validate: (d) => d?.imageUrl || d?.url || typeof d === 'object' },
  { area: 'Generate', name: 'Content studio config', channel: 'get-content-studio-config', validate: (d) => typeof d === 'object' },
  { area: 'Generate', name: 'Run content studio', channel: 'run-content-studio', args: [{ types: ['post'], keywords: ['marketing'], count: 1 }], validate: (d) => d?.success !== false || d?.items || Array.isArray(d) },
  { area: 'Generate', name: 'Generate batch', channel: 'generate-content-batch', args: [{ keywords: ['automation'], count: 1 }], validate: (d) => typeof d === 'object' },
  { area: 'Publish', name: 'Schedule post', channel: 'schedule-post', needsAccount: true, args: [{ platform: 'LinkedIn', content: 'Content Hub QA schedule', scheduleTime: new Date(Date.now() + 86400000).toISOString() }], validate: (d) => d?.id || d?.success !== false },
  { area: 'Publish', name: 'Publish post', channel: 'publish-post', needsAccount: true, args: [{ platform: 'LinkedIn', content: 'Content Hub QA publish', hasMedia: false, humanLike: false }], validate: (d) => typeof d === 'object' },
  { area: 'Grok', name: 'Grok status', channel: 'grok-get-status', validate: (d) => typeof d === 'object' },
  { area: 'Grok', name: 'Grok prompt preview', channel: 'grok-build-prompt-preview', args: [{ prompt: 'futuristic office', pageId: 'content-hub' }], validate: (d) => typeof d === 'object' },
  { area: 'Thumbnails', name: 'Thumbnail config', channel: 'get-thumbnail-studio-config', validate: (d) => typeof d === 'object' },
  { area: 'RSS', name: 'RSS curate', channel: 'curate-from-rss', args: [{ rssUrl: 'https://feeds.feedburner.com/TechCrunch', numItems: 1 }], validate: (d) => Array.isArray(d) || d?.posts || d?.items },
  { area: 'RSS', name: 'Auto content settings', channel: 'get-auto-content-settings', validate: (d) => typeof d === 'object' },
  { area: 'RSS', name: 'RSS sources', channel: 'get-site-rss-sources', validate: (d) => Array.isArray(d) || typeof d === 'object' },
  { area: 'Utilities', name: 'Shorten URL', channel: 'shorten-url', args: ['https://acmegrowth.com'], validate: (d) => !!d?.shortUrl },
  { area: 'Utilities', name: 'Serp search', channel: 'serp-search', args: ['social media tools'], validate: (d) => typeof d === 'object' },
  { area: 'Utilities', name: 'Research keyword', channel: 'research-keyword', args: ['content marketing'], validate: (d) => typeof d === 'object' },
  { area: 'Utilities', name: 'Stock photo', channel: 'search-stock-photo', args: ['marketing team'], validate: (d) => typeof d === 'object' },
  { area: 'Q&A', name: 'Compose Q&A', channel: 'compose-qa-answer', args: [{ question: { content: 'What is content automation?', platform: 'Quora' } }], validate: (d) => d?.formatted || d?.answer || typeof d === 'string' },
  { area: 'History', name: 'Post history', channel: 'get-post-history', validate: (d) => Array.isArray(d) },
  { area: 'Replies', name: 'AI replies list', channel: 'get-ai-replies', validate: (d) => Array.isArray(d) },
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
  return { ok: res.ok, status: res.status, data: json.data, error: json.error };
}

async function main() {
  console.log('\n=== CONTENT HUB FEATURE QA ===\n');
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
  fs.writeFileSync(
    path.join(__dirname, '.content-hub-qa-report.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), summary: { pass, weak, fail }, results }, null, 2),
  );
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });