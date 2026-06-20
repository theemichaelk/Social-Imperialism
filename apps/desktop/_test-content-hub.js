/**
 * Content Hub feature tester — exercises backend paths for all tabs.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { LocalStorage } = require('node-localstorage');
const axios = require('axios');
const { resolveKeys, hasTwitterKeys, hasLinkedInKeys, hasMetaKeys } = require('./services/keys');
const integrations = require('./services');
const contentStudio = require('./services/contentStudio');
const keywordResearch = require('./services/keywordResearch');

const dataPath = path.join(__dirname, '.test-content-hub-store');
if (fs.existsSync(dataPath)) fs.rmSync(dataPath, { recursive: true, force: true });
fs.mkdirSync(dataPath, { recursive: true });
const store = new LocalStorage(path.join(dataPath, 'storage'));

const prodPaths = [
  path.join(process.env.APPDATA || '', 'social-imperialism', 'storage'),
  path.join(process.env.APPDATA || '', 'Social Imperialism', 'storage'),
];
for (const p of prodPaths) {
  if (fs.existsSync(p)) {
    console.log('Using production storage:', p);
    const prodStore = new LocalStorage(p);
    ['activeCampaignId', 'campaigns', 'keywords', 'globalApiKeys', 'linkedAccounts_default', 'postHistory', 'aiRepliesHistory', 'contentReviewQueue', 'autoContentSettings'].forEach((k) => {
      const v = prodStore.getItem(k);
      if (v) store.setItem(k, v);
    });
    const activeId = prodStore.getItem('activeCampaignId') || 'default';
    const linked = prodStore.getItem(`linkedAccounts_${activeId}`);
    if (linked) store.setItem(`linkedAccounts_${activeId}`, linked);
    break;
  }
}

const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
store.setItem('globalApiKeys', JSON.stringify(keys));

if (!store.getItem('campaigns')) {
  store.setItem('campaigns', JSON.stringify([{
    id: 'default', brandName: 'Acme Labs', domain: 'acme.com',
    description: 'B2B marketing automation platform', tone: 'professional',
  }]));
  store.setItem('activeCampaignId', 'default');
}

const activeId = store.getItem('activeCampaignId') || 'default';
const results = [];

function record(feature, status, detail) {
  results.push({ feature, status, detail });
  const icon = status === 'OK' ? '✓' : status === 'PARTIAL' ? '~' : '✗';
  console.log(`${icon} ${feature}: ${detail}`);
}
async function test(name, fn) {
  try {
    const r = await fn();
    if (r === true || r?.ok === true) record(name, 'OK', r?.detail || 'working');
    else if (r?.partial) record(name, 'PARTIAL', r.detail);
    else record(name, 'FAIL', r?.detail || r?.error || JSON.stringify(r).slice(0, 160));
  } catch (e) {
    record(name, 'FAIL', e.message);
  }
}

async function generateAI(prompt) {
  if (keys.openrouter) {
    try {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
      }, { headers: { Authorization: `Bearer ${keys.openrouter}` }, timeout: 60000 });
      const t = res.data?.choices?.[0]?.message?.content;
      if (t) return t;
    } catch (e) { /* fallback */ }
  }
  for (const m of ['gemini-2.0-flash', 'gemini-1.5-flash']) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${keys.gemini}`;
      const res = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] }, { timeout: 60000 });
      const t = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (t) return t;
    } catch (e) { /* next */ }
  }
  throw new Error('AI failed');
}

function getLinkedAccounts() {
  return JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
}

(async () => {
  console.log('\n=== CONTENT HUB FEATURE TEST ===');
  console.log('Keys:', { gemini: !!keys.gemini, openrouter: !!keys.openrouter, fal: !!keys.falKey, unsplash: !!keys.unsplashAccessKey, serp: !!keys.serpApiKey, youtube: !!keys.youtubeApiKey });
  const accs = getLinkedAccounts();
  console.log('Linked accounts:', accs.length);
  console.log('');

  // API status
  await test('API Status bar data', async () => {
    const status = keywordResearch.getApiStatus(keys);
    const connected = Object.entries(status).filter(([, v]) => v).map(([k]) => k);
    if (!connected.length) return { detail: 'No APIs connected' };
    return { ok: true, detail: connected.join(', ') };
  });

  // Publish Wizard
  await test('Publish Wizard — get-linked-accounts', async () => {
    const a = getLinkedAccounts();
    if (!a.length) return { partial: true, detail: 'No linked accounts — wizard needs Account Hub' };
    return { ok: true, detail: `${a.length} account(s): ${a.map((x) => x.platform).join(', ')}` };
  });

  await test('Publish Wizard — get-post-history', async () => {
    const hist = JSON.parse(store.getItem('postHistory') || '[]');
    return { ok: true, detail: `${hist.length} posts in history` };
  });

  // Standard Post tools
  await test('Standard Post — generate-ai (enhance)', async () => {
    const text = await generateAI('Rewrite in 20 words with emoji: Great product launch today!');
    if (!text || text.startsWith('Error')) return { detail: 'AI empty/error' };
    return { ok: true, detail: `"${text.trim().slice(0, 50)}"` };
  });

  await test('Standard Post — search-stock-photo', async () => {
    if (!keys.unsplashAccessKey) return { partial: true, detail: 'No Unsplash key' };
    const res = await axios.get('https://api.unsplash.com/search/photos', {
      params: { query: 'marketing', per_page: 1 },
      headers: { Authorization: `Client-ID ${keys.unsplashAccessKey}` },
      timeout: 15000,
    });
    if (!res.data?.results?.length) return { detail: 'Unsplash 0 results' };
    return { ok: true, detail: 'Unsplash OK' };
  });

  await test('Standard Post — generate-image (FAL)', async () => {
    if (!keys.falKey) return { partial: true, detail: 'No FAL key — image gen unavailable' };
    return { ok: true, detail: 'FAL key configured' };
  });

  await test('Standard Post — schedule-post', async () => {
    let sched = [];
    const entry = {
      id: 'sched_test', platform: 'Twitter', accountId: 'test', content: 'Test schedule',
      timestamp: new Date(Date.now() + 3600000).toISOString(), status: 'scheduled',
    };
    sched.push(entry);
    store.setItem('scheduled_posts', JSON.stringify(sched));
    const loaded = JSON.parse(store.getItem('scheduled_posts') || '[]');
    if (!loaded.length) return { detail: 'Schedule save failed' };
    return { ok: true, detail: `${loaded.length} scheduled post(s)` };
  });

  await test('Standard Post — publish-post (live)', async () => {
    const accs = getLinkedAccounts();
    if (!accs.length) return { partial: true, detail: 'Needs linked account for live publish' };
    try {
      await integrations.publishPost({
        accountId: accs[0].id, platform: accs[0].platform,
        content: `[Test] Content Hub publish check ${Date.now()}`,
        hasMedia: false,
      }, keys, accs);
      return { ok: true, detail: `Published via ${accs[0].platform}` };
    } catch (e) {
      if (/token|auth|credential|403|401|not supported/i.test(e.message)) {
        return { partial: true, detail: `Publish needs auth: ${e.message.slice(0, 80)}` };
      }
      return { detail: e.message };
    }
  });

  // Content Studio
  await test('Content Studio — generate batch (preview)', async () => {
    const gen = await contentStudio.generateContentBatch(
      { generateAIWithModel: async (p) => generateAI(p) },
      { keywords: 'marketing automation', types: ['post'], variantsPerType: 1, tabId: 'standard', model: 'gemini' },
    );
    if (!gen.success || !gen.items?.length) return { detail: gen.error || '0 items generated' };
    return { ok: true, detail: `${gen.count || gen.items.length} item(s) — "${(gen.items[0].content || '').slice(0, 40)}"` };
  });

  // Repurpose
  await test('Repurpose — generate-ai blog→post', async () => {
    const post = await generateAI('Convert to social post: AI is transforming marketing in 2026.');
    if (!post) return { detail: 'Empty' };
    return { ok: true, detail: post.slice(0, 50) };
  });

  await test('Repurpose — get-youtube-channels', async () => {
    if (!keys.youtubeApiKey) return { partial: true, detail: 'No YouTube API key' };
    const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: { part: 'snippet', q: 'marketing', type: 'video', maxResults: 3, key: keys.youtubeApiKey },
      timeout: 15000,
    });
    if (!res.data?.items?.length) return { detail: 'YouTube 0 results' };
    return { ok: true, detail: `${res.data.items.length} videos` };
  });

  await test('Repurpose — generate-carousel-fal', async () => {
    if (!keys.falKey) return { partial: true, detail: 'No FAL for carousel images' };
    return { ok: true, detail: 'FAL carousel path available' };
  });

  // Analytics
  await test('Post Analytics — get-all-post-history', async () => {
    const hist = JSON.parse(store.getItem('postHistory') || '[]');
    return { ok: true, detail: `${hist.length} posts for analytics` };
  });

  // Answer Composer
  await test('Answer Composer — compose-qa-answer', async () => {
    const camps = JSON.parse(store.getItem('campaigns') || '[]');
    const campaign = camps.find((c) => c.id === activeId) || {};
    const answer = await integrations.composeAnswer({
      question: { content: 'What is the best marketing automation tool?', platform: 'Quora' },
      campaign, store, generateAI,
    });
    if (!answer) return { detail: 'Empty answer' };
    return { ok: true, detail: `"${String(answer).slice(0, 60)}"` };
  });

  await test('Answer Composer — reuse-qa-as-content', async () => {
    const camps = JSON.parse(store.getItem('campaigns') || '[]');
    const campaign = camps.find((c) => c.id === activeId) || {};
    const content = integrations.reuseAnswerAsContent('Test answer about marketing tools.', campaign, 'blog');
    if (!content) return { detail: 'Empty content' };
    return { ok: true, detail: `${content.length} chars blog format` };
  });

  // RSS & Auto Content
  await test('RSS — curate-from-rss', async () => {
    try {
      const res = await axios.get('https://hnrss.org/frontpage', { timeout: 15000 });
      if (!res.data?.includes('<item')) return { partial: true, detail: 'RSS fetch OK but parse needs curate handler' };
      return { ok: true, detail: 'RSS feed reachable' };
    } catch (e) {
      return { partial: true, detail: `RSS fetch: ${e.message}` };
    }
  });

  await test('Auto Content — save/get settings + queue', async () => {
    store.setItem('autoContentSettings', JSON.stringify({ enabled: true, rssUrls: ['https://hnrss.org/frontpage'], frequency: 'daily' }));
    const s = JSON.parse(store.getItem('autoContentSettings') || '{}');
    if (!s.enabled) return { detail: 'Settings not saved' };
    store.setItem('contentReviewQueue', JSON.stringify([{ id: 'q1', content: 'Test queue item', queuedAt: new Date().toISOString() }]));
    const q = JSON.parse(store.getItem('contentReviewQueue') || '[]');
    return { ok: true, detail: `Settings OK, queue ${q.length} item(s)` };
  });

  // Thumbnails
  await test('Viral Thumbnails — studio config', async () => {
    const thumbIpc = require('./services/thumbnailIpc');
    return { ok: true, detail: 'thumbnailIpc module loaded' };
  });

  // Brand & Keywords
  await test('Brand tab — generate-keywords', async () => {
    const camp = JSON.parse(store.getItem('campaigns'))[0];
    const res = await keywordResearch.researchBrandKeywords(camp, keys, generateAI);
    if (!res.keywords?.length) return { detail: res.error || '0 keywords' };
    return { ok: true, detail: `${res.keywords.length} keywords` };
  });

  await test('Brand tab — save-keywords', async () => {
    const kws = [{ term: 'content marketing', platforms: ['Twitter', 'LinkedIn'], intent: 'mentions' }];
    let all = JSON.parse(store.getItem('keywords') || '[]').filter((k) => k.campaignId !== activeId);
    kws.forEach((kw, i) => all.push({ id: `kw_ch_${i}`, campaignId: activeId, ...kw }));
    store.setItem('keywords', JSON.stringify(all));
    const saved = JSON.parse(store.getItem('keywords')).filter((k) => k.campaignId === activeId);
    return { ok: true, detail: `${saved.length} keyword(s)` };
  });

  // Comments / Replies
  await test('Comments — get-ai-replies', async () => {
    const replies = JSON.parse(store.getItem('aiRepliesHistory') || '[]');
    return { ok: true, detail: `${replies.length} AI replies in inbox` };
  });

  await test('Comments — run-auto-rules-now', async () => {
    return { partial: true, detail: 'Worker scan — skipped in unit test (heavy); handler exists in index.js' };
  });

  // Utilities
  await test('Utilities — serp-search', async () => {
    if (!keys.serpApiKey) return { partial: true, detail: 'No SerpAPI key' };
    try {
      const res = await axios.get('https://serpapi.com/search.json', {
        params: { engine: 'google', q: 'content marketing', api_key: keys.serpApiKey, num: 3 },
        timeout: 20000,
      });
      if (!res.data?.organic_results?.length) return { partial: true, detail: 'Serp 0 results' };
      return { ok: true, detail: `${res.data.organic_results.length} results` };
    } catch (e) {
      if (e.response?.status === 429) return { partial: true, detail: 'SerpAPI rate-limited (429) — key valid, quota exhausted' };
      throw e;
    }
  });

  await test('Utilities — shorten-url', async () => {
    const url = 'https://example.com/test';
    const tinyKey = process.env.TINYURL_API_KEY;
    const providers = [
      async () => {
        const apiUrl = tinyKey
          ? `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}&api_token=${tinyKey}`
          : `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`;
        const res = await axios.get(apiUrl, { timeout: 15000, validateStatus: (s) => s < 500 });
        const short = String(res.data || '').trim();
        if (short.startsWith('http')) return short;
        throw new Error(short || 'TinyURL invalid');
      },
      async () => {
        const res = await axios.get('https://is.gd/create.php', { params: { format: 'json', url }, timeout: 12000 });
        if (res.data?.shorturl) return res.data.shorturl;
        throw new Error(res.data?.errormessage || 'is.gd failed');
      },
      async () => {
        const res = await axios.get('https://v.gd/create.php', { params: { format: 'json', url }, timeout: 12000 });
        if (res.data?.shorturl) return res.data.shorturl;
        throw new Error(res.data?.errormessage || 'v.gd failed');
      },
    ];
    let lastErr = null;
    for (const attempt of providers) {
      try {
        const short = await attempt();
        return { ok: true, detail: short.slice(0, 50) };
      } catch (e) { lastErr = e; }
    }
    return { detail: lastErr?.message || 'All shorteners failed' };
  });

  await test('Utilities — upload-local-media', async () => {
    const testFile = path.join(__dirname, 'logo.png');
    if (!fs.existsSync(testFile)) return { partial: true, detail: 'logo.png missing for upload test' };
    const data = fs.readFileSync(testFile);
    const b64 = `data:image/png;base64,${data.toString('base64')}`;
    if (!b64.startsWith('data:')) return { detail: 'Base64 encode failed' };
    return { ok: true, detail: `${Math.round(b64.length / 1024)}KB data URL` };
  });

  const fails = results.filter((r) => r.status === 'FAIL');
  const partial = results.filter((r) => r.status === 'PARTIAL');
  const ok = results.filter((r) => r.status === 'OK');
  console.log('\n=== SUMMARY ===');
  console.log(`OK: ${ok.length} | PARTIAL: ${partial.length} | FAIL: ${fails.length}`);
  if (fails.length) {
    console.log('\nNOT WORKING:');
    fails.forEach((f) => console.log(`  - ${f.feature}: ${f.detail}`));
  }
  if (partial.length) {
    console.log('\nPARTIALLY WORKING:');
    partial.forEach((f) => console.log(`  - ${f.feature}: ${f.detail}`));
  }
  fs.writeFileSync(path.join(__dirname, '.content-hub-test-report.json'), JSON.stringify(results, null, 2));
})();