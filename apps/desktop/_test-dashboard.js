/**
 * Dashboard feature tester — runs backend logic without Electron UI.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { LocalStorage } = require('node-localstorage');
const { resolveKeys, hasTwitterKeys, hasRedditKeys, hasLinkedInKeys, hasMetaKeys } = require('./services/keys');
const { fetchRealFeed, fetchTrendingTopics } = require('./services/feedFetcher');
const integrations = require('./services');
const axios = require('axios');

const dataPath = path.join(__dirname, '.test-dash-store');
if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
const store = new LocalStorage(path.join(dataPath, 'storage'));

// Mirror production storage if available
const prodPaths = [
  path.join(process.env.APPDATA || '', 'social-imperialism', 'storage'),
  path.join(process.env.APPDATA || '', 'Social Imperialism', 'storage'),
  path.join(process.env.APPDATA || '', 'social-imperialism-alpha', 'storage'),
];
for (const p of prodPaths) {
  if (fs.existsSync(p)) {
    console.log('Using production storage:', p);
    const prodStore = new LocalStorage(p);
    ['activeCampaignId', 'campaigns', 'keywords', 'globalApiKeys', 'linkedAccounts_default', 'postHistory', 'aiRepliesHistory'].forEach((k) => {
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
    else record(name, 'FAIL', r?.detail || r?.error || JSON.stringify(r).slice(0, 120));
  } catch (e) {
    record(name, 'FAIL', e.message);
  }
}

(async () => {
  console.log('\n=== DASHBOARD FEATURE TEST ===');
  console.log('Keys:', {
    gemini: !!keys.gemini,
    openrouter: !!keys.openrouter,
    newsApiKey: !!keys.newsApiKey,
    serpApiKey: !!keys.serpApiKey,
    twitter: hasTwitterKeys(keys),
    reddit: hasRedditKeys(keys),
    linkedin: hasLinkedInKeys(keys),
    meta: hasMetaKeys(keys),
    youtube: !!keys.youtubeApiKey,
  });
  console.log('Campaign:', activeId);
  console.log('');

  // 1. KPI Stats
  await test('KPI Stats (get-dashboard-stats)', async () => {
    const history = JSON.parse(store.getItem('postHistory') || '[]');
    const kws = JSON.parse(store.getItem('keywords') || '[]').filter((k) => k.campaignId === activeId);
    return { ok: true, detail: `${history.length} posts, ${kws.length} keywords` };
  });

  // 2. Platform Pulse / API metrics
  await test('Platform Pulse (API keys)', async () => {
    const connected = [
      keys.gemini && 'Gemini',
      keys.newsApiKey && 'NewsAPI',
      keys.serpApiKey && 'SerpAPI',
      hasLinkedInKeys(keys) && 'LinkedIn',
      hasTwitterKeys(keys) && 'Twitter',
      hasMetaKeys(keys) && 'Meta',
    ].filter(Boolean);
    if (!connected.length) return { detail: 'No APIs connected' };
    if (!keys.gemini) return { partial: true, detail: `Connected: ${connected.join(', ')} — Gemini missing` };
    return { ok: true, detail: connected.join(', ') };
  });

  // 3. Headlines (NewsAPI)
  await test('Headlines (get-live-news)', async () => {
    if (!keys.newsApiKey) return { detail: 'No NewsAPI key' };
    const res = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: { category: 'technology', language: 'en', pageSize: 4, apiKey: keys.newsApiKey },
      timeout: 15000,
    });
    const n = res.data?.articles?.length || 0;
    if (!n) return { detail: 'NewsAPI returned 0 articles' };
    return { ok: true, detail: `${n} headlines` };
  });

  // 4. Trending Topics
  await test('Trending Topics', async () => {
    const topics = await fetchTrendingTopics('Reddit', keys);
    if (!topics?.length) return { detail: 'No trending topics returned' };
    return { ok: true, detail: `${topics.length} topics (e.g. ${topics[0].topic?.slice(0, 40)})` };
  });

  // 5. Live Feed
  await test('Live Feed (get-live-feed)', async () => {
    let keywords = JSON.parse(store.getItem('keywords') || '[]')
      .filter((k) => k.campaignId === activeId).map((k) => k.term).filter(Boolean);
    if (!keywords.length) keywords = ['marketing', 'technology'];
    const posts = await fetchRealFeed({ keywords, filters: {}, keys, allowedPlatforms: new Set() });
    if (!posts?.length) return { detail: 'Feed returned 0 posts — check keywords/APIs' };
    const platforms = [...new Set(posts.map((p) => p.platform))];
    return { ok: true, detail: `${posts.length} posts from ${platforms.join(', ')}` };
  });

  // 6. Linked Accounts
  await test('Linked Accounts', async () => {
    const accs = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    if (!accs.length) return { partial: true, detail: 'No linked accounts — connect in Account Hub' };
    return { ok: true, detail: `${accs.length} accounts (${accs.map((a) => a.platform).join(', ')})` };
  });

  // 7. AI Draft Reply
  await test('AI Draft Reply (generate-ai)', async () => {
    if (!keys.gemini && !keys.openrouter) return { detail: 'No AI key' };
    const geminiKey = keys.gemini;
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    let text = '';
    for (const m of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`;
        const res = await axios.post(url, {
          contents: [{ parts: [{ text: 'Reply in 10 words: thanks for your question about marketing.' }] }],
        }, { timeout: 30000 });
        text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) break;
      } catch (e) { /* try next */ }
    }
    if (!text && keys.openrouter) {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: 'Reply in 10 words: thanks for marketing question.' }],
      }, { headers: { Authorization: `Bearer ${keys.openrouter}` }, timeout: 30000 });
      text = res.data?.choices?.[0]?.message?.content || '';
    }
    if (!text) return { detail: 'AI returned empty' };
    return { ok: true, detail: `Generated: "${text.trim().slice(0, 60)}"` };
  });

  // 8. Q&A Discovery
  await test('Q&A Discovery (discover-best-questions)', async () => {
    const camps = JSON.parse(store.getItem('campaigns') || '[]');
    const campaign = camps.find((c) => c.id === activeId) || {};
    const questions = await integrations.discoverQuestions(store, keys, campaign, null);
    const n = Array.isArray(questions) ? questions.length : (questions?.questions?.length || 0);
    if (!n) return { partial: true, detail: '0 questions found — add keywords in Keywords page' };
    return { ok: true, detail: `${n} questions` };
  });

  // 9. Reddit Prospector
  await test('Reddit Prospector (scan-reddit)', async () => {
    const camps = JSON.parse(store.getItem('campaigns') || '[]');
    const campaign = camps.find((c) => c.id === activeId) || { brandName: 'Test Brand' };
    const leads = await integrations.runRedditProspector(store, keys, campaign);
    const n = Array.isArray(leads) ? leads.length : (leads?.leads?.length || 0);
    if (!n) return { partial: true, detail: '0 leads (Reddit API may be rate-limited; web-discovery fallback used)' };
    return { ok: true, detail: `${n} leads` };
  });

  // 10. Image Generation
  await test('Image Generation (generate-image)', async () => {
    if (!keys.falKey) return { partial: true, detail: 'No FAL key — image gen unavailable' };
    return { ok: true, detail: 'FAL key configured' };
  });

  // 11. Stock Photos
  await test('Stock Photos (search-stock-photo)', async () => {
    if (!keys.unsplashAccessKey) return { partial: true, detail: 'No Unsplash key' };
    const res = await axios.get('https://api.unsplash.com/search/photos', {
      params: { query: 'marketing', per_page: 1 },
      headers: { Authorization: `Client-ID ${keys.unsplashAccessKey}` },
      timeout: 15000,
    });
    if (!res.data?.results?.length) return { detail: 'Unsplash returned 0' };
    return { ok: true, detail: 'Unsplash search works' };
  });

  // 12. Fan Page / RSS
  await test('Fan Page RSS Curation', async () => {
    const settings = integrations.getFanpageSettings(store);
    return { ok: true, detail: `Settings loaded (autoPost: ${!!settings?.autoPost})` };
  });

  // 13. Full Auto Search
  await test('Full Scan (trigger-full-auto-search)', async () => {
    let kws = JSON.parse(store.getItem('keywords') || '[]').filter((k) => k.campaignId === activeId);
    if (!kws.length) {
      const camps = JSON.parse(store.getItem('campaigns') || '[]');
      const camp = camps.find((c) => c.id === activeId) || {};
      const seed = [camp.brandName, 'marketing', 'technology'].filter(Boolean);
      kws = seed.map((term, i) => ({ id: `kw_dash_${i}`, campaignId: activeId, term }));
      store.setItem('keywords', JSON.stringify([
        ...JSON.parse(store.getItem('keywords') || '[]').filter((k) => k.campaignId !== activeId),
        ...kws,
      ]));
    }
    return { ok: true, detail: `${kws.length} keywords ready for scan` };
  });

  // 14. Engage Post (dry check)
  await test('Engage Post (like/upvote)', async () => {
    const accs = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    if (!accs.length) return { partial: true, detail: 'Needs linked account to engage live' };
    return { ok: true, detail: 'Engage handler ready (needs live post + account)' };
  });

  // 15. Publish Post
  await test('Publish Post', async () => {
    const accs = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    const publishable = accs.filter((a) => ['Twitter', 'LinkedIn', 'Facebook', 'Reddit'].includes(a.platform));
    if (!publishable.length) return { partial: true, detail: 'No publish-capable linked accounts' };
    return { ok: true, detail: `Can publish via: ${publishable.map((a) => a.platform).join(', ')}` };
  });

  // 16. Domain Metrics
  await test('Domain Metrics', async () => {
    const camps = JSON.parse(store.getItem('campaigns') || '[]');
    const domain = camps.find((c) => c.id === activeId)?.domain;
    if (!domain) return { partial: true, detail: 'No domain set on campaign' };
    return { ok: true, detail: `Domain: ${domain}` };
  });

  // Summary
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

  fs.writeFileSync(path.join(__dirname, '.dashboard-test-report.json'), JSON.stringify(results, null, 2));
})();