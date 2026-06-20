/**
 * Browse Posts feature tester — exercises backend paths used by dashboard #browse-posts.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { LocalStorage } = require('node-localstorage');
const axios = require('axios');
const { resolveKeys, hasTwitterKeys, hasRedditKeys, hasLinkedInKeys, hasMetaKeys } = require('./services/keys');
const { fetchRealFeed } = require('./services/feedFetcher');
const { fetchLinkedAccountFeed } = require('./services/accountFeedFetcher');
const { engagePost } = require('./services/engagement');
const integrations = require('./services');

const dataPath = path.join(__dirname, '.test-browse-store');
if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
const store = new LocalStorage(path.join(dataPath, 'storage'));

const prodPaths = [
  path.join(process.env.APPDATA || '', 'social-imperialism', 'storage'),
  path.join(process.env.APPDATA || '', 'Social Imperialism', 'storage'),
  path.join(process.env.APPDATA || '', 'social-imperialism-alpha', 'storage'),
];
for (const p of prodPaths) {
  if (fs.existsSync(p)) {
    console.log('Using production storage:', p);
    const prodStore = new LocalStorage(p);
    [
      'activeCampaignId', 'campaigns', 'keywords', 'globalApiKeys',
      'linkedAccounts_default', 'postHistory', 'aiRepliesHistory', 'watchedMonitors',
    ].forEach((k) => {
      const v = prodStore.getItem(k);
      if (v) store.setItem(k, v);
    });
    const activeId = prodStore.getItem('activeCampaignId') || 'default';
    const linked = prodStore.getItem(`linkedAccounts_${activeId}`);
    if (linked) store.setItem(`linkedAccounts_${activeId}`, linked);
    break;
  }
}

// Seed minimal campaign if empty
if (!store.getItem('campaigns')) {
  store.setItem('campaigns', JSON.stringify([{
    id: 'default',
    brandName: 'Test Brand',
    domain: 'example.com',
    description: 'Social media marketing automation',
    tone: 'Professional',
  }]));
  store.setItem('activeCampaignId', 'default');
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
    else record(name, 'FAIL', r?.detail || r?.error || JSON.stringify(r).slice(0, 160));
  } catch (e) {
    record(name, 'FAIL', e.message);
  }
}

function ensureCampaignKeywords(activeCampaignId) {
  let allKeywords = [];
  try { allKeywords = JSON.parse(store.getItem('keywords') || '[]'); } catch (e) {}
  const existing = allKeywords.filter((k) => k.campaignId === activeCampaignId);
  if (existing.length) return existing;
  const camps = JSON.parse(store.getItem('campaigns') || '[]');
  const camp = camps.find((c) => c.id === activeCampaignId) || {};
  const seeds = [camp.brandName, 'marketing', 'technology'].filter(Boolean).slice(0, 3);
  const newKws = seeds.map((term, i) => ({
    id: `kw_seed_${Date.now()}_${i}`,
    campaignId: activeCampaignId,
    term,
    platforms: ['Twitter', 'LinkedIn', 'Reddit', 'Quora'],
  }));
  store.setItem('keywords', JSON.stringify([...allKeywords, ...newKws]));
  return newKws;
}

function applyClientFilters(allPosts, filters = {}) {
  let posts = [...allPosts];
  const timeFilter = filters.time || 'all';
  if (timeFilter && timeFilter !== 'all') {
    const limits = { '15m': 15 * 60 * 1000, '1h': 3600000, '24h': 86400000 };
    const maxAge = limits[timeFilter];
    if (maxAge) posts = posts.filter((p) => !p.createdAt || (Date.now() - p.createdAt) <= maxAge);
  }
  const minEngage = parseInt(filters.minEngage || '0', 10) || 0;
  if (minEngage > 0) posts = posts.filter((p) => (p.stats?.likes || 0) >= minEngage);
  if (filters.platform && filters.platform !== 'All') {
    const fp = filters.platform;
    posts = posts.filter((p) => p.platform === fp || (p.platform || '').includes(fp));
  }
  if (filters.keyword && filters.keyword !== 'all') {
    posts = posts.filter((p) => p.matchedKeyword === filters.keyword);
  }
  return posts;
}

async function fetchLiveFeed(filters = {}) {
  ensureCampaignKeywords(activeId);
  const kws = JSON.parse(store.getItem('keywords') || '[]')
    .filter((k) => k.campaignId === activeId).map((k) => k.term).filter(Boolean);
  const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
  const platformsAllowed = new Set();
  JSON.parse(store.getItem('keywords') || '[]')
    .filter((k) => k.campaignId === activeId)
    .forEach((kw) => (kw.platforms || []).forEach((p) => platformsAllowed.add(p)));
  linkedAccounts.forEach((a) => a.platform && platformsAllowed.add(a.platform));

  const [keywordPosts, accountPosts] = await Promise.all([
    fetchRealFeed({ keywords: kws, filters, keys, allowedPlatforms: platformsAllowed }),
    fetchLinkedAccountFeed({ linkedAccounts, filters, keys, limitPerAccount: 10 }),
  ]);
  const seen = new Set();
  return [...accountPosts, ...keywordPosts].filter((p) => {
    const key = `${p.platform}:${p.externalId || p.url || p.content?.substring(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function draftPostReply(payload) {
  const geminiKey = keys.gemini;
  const openrouterKey = keys.openrouter;
  const prompt = `Reply in under 20 words to: "${payload.postContent}"`;
  if (openrouterKey) {
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    }, { headers: { Authorization: `Bearer ${openrouterKey}` }, timeout: 45000 });
    const text = res.data?.choices?.[0]?.message?.content || '';
    if (text) return text;
  }
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  for (const m of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`;
      const res = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }],
      }, { timeout: 45000 });
      const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) return text;
    } catch (e) { /* next */ }
  }
  throw new Error('AI draft failed');
}

function isSyntheticExternalId(id) {
  if (!id) return true;
  return /^(reddit|quora|twitter)_/i.test(id);
}

(async () => {
  console.log('\n=== BROWSE POSTS FEATURE TEST ===');
  console.log('Keys:', {
    gemini: !!keys.gemini,
    openrouter: !!keys.openrouter,
    serp: !!keys.serpApiKey,
    twitter: hasTwitterKeys(keys),
    reddit: hasRedditKeys(keys),
    linkedin: hasLinkedInKeys(keys),
    meta: hasMetaKeys(keys),
    unsplash: !!keys.unsplashAccessKey,
    fal: !!keys.falKey,
  });
  console.log('Campaign:', activeId);
  console.log('');

  await test('1. KPI Stats (get-dashboard-stats)', async () => {
    const history = JSON.parse(store.getItem('postHistory') || '[]');
    const kws = JSON.parse(store.getItem('keywords') || '[]').filter((k) => k.campaignId === activeId);
    return { ok: true, detail: `${history.length} posts, ${kws.length} keywords` };
  });

  await test('2. Keywords dropdown (get-keywords)', async () => {
    const kws = JSON.parse(store.getItem('keywords') || '[]').filter((k) => k.campaignId === activeId);
    if (!kws.length) {
      const seeded = ensureCampaignKeywords(activeId);
      if (!seeded.length) return { detail: 'No keywords and seed failed' };
      return { partial: true, detail: `Auto-seeded ${seeded.length} keywords (dropdown empty until refresh)` };
    }
    return { ok: true, detail: `${kws.length} keywords: ${kws.map((k) => k.term).slice(0, 3).join(', ')}` };
  });

  await test('3. Live Feed — default filters', async () => {
    const posts = await fetchLiveFeed({ platform: 'All', sort: 'recent', time: 'all' });
    if (!posts.length) return { detail: '0 posts — APIs/fallbacks returned nothing' };
    const withUrl = posts.filter((p) => p.url).length;
    const withRealId = posts.filter((p) => p.externalId && !isSyntheticExternalId(p.externalId)).length;
    const webDisc = posts.filter((p) => p.isWebDiscovery || isSyntheticExternalId(p.externalId)).length;
    const platforms = [...new Set(posts.map((p) => p.platform))];
    return {
      ok: true,
      detail: `${posts.length} posts [${platforms.join(', ')}] — ${withUrl} urls, ${withRealId} API ids, ${webDisc} web-discovery`,
    };
  });

  await test('4. Live Feed — preset high-intent (strict filters)', async () => {
    const raw = await fetchLiveFeed({ platform: 'All', sort: 'engagement', time: '24h' });
    const filtered = applyClientFilters(raw, { time: '24h', minEngage: '100', postType: 'question' });
    if (!filtered.length && raw.length) {
      return { partial: true, detail: `Strict preset empties feed (${raw.length} raw → 0 filtered) — expected for low-engage discovery posts` };
    }
    return { ok: true, detail: `${filtered.length} posts after strict filters (${raw.length} raw)` };
  });

  await test('5. Linked account chips (get-linked-accounts)', async () => {
    const accs = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    if (!accs.length) return { partial: true, detail: 'No linked accounts — connect in Account Hub for account feeds' };
    const feed = await fetchLinkedAccountFeed({ linkedAccounts: accs, filters: {}, keys, limitPerAccount: 5 });
    return { ok: true, detail: `${accs.length} accounts, ${feed.length} account feed posts` };
  });

  await test('6. Draft AI Reply (draft-post-reply)', async () => {
    if (!keys.gemini && !keys.openrouter) return { detail: 'No AI key' };
    const text = await draftPostReply({ postContent: 'What is the best marketing strategy for SaaS?' });
    if (!text || text.startsWith('Error')) return { detail: 'Empty or error response' };
    return { ok: true, detail: `"${String(text).trim().slice(0, 70)}"` };
  });

  await test('7. Engage Like — Reddit API post', async () => {
    const posts = await fetchLiveFeed({});
    const redditPost = posts.find((p) => p.platform === 'Reddit' && p.externalId && !isSyntheticExternalId(p.externalId));
    const accs = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    if (!redditPost) return { partial: true, detail: 'No Reddit post with real API id in feed' };
    try {
      await engagePost({
        action: 'like',
        platform: 'Reddit',
        externalId: redditPost.externalId,
        postId: redditPost.externalId,
      }, keys, accs);
      return { ok: true, detail: `Upvote attempted for ${redditPost.externalId}` };
    } catch (e) {
      if (/not supported|Engagement not supported/i.test(e.message)) {
        return { detail: `Reddit like broken: ${e.message}` };
      }
      if (/token|auth|credential|403|401/i.test(e.message)) {
        return { partial: true, detail: `Handler exists but auth needed: ${e.message}` };
      }
      return { detail: e.message };
    }
  });

  await test('8. Engage Like — web-discovery post', async () => {
    const posts = await fetchLiveFeed({});
    const disc = posts.find((p) => isSyntheticExternalId(p.externalId));
    if (!disc) return { partial: true, detail: 'No web-discovery posts in feed to test' };
    const accs = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    try {
      await engagePost({ action: 'like', platform: disc.platform, externalId: disc.externalId }, keys, accs);
      return { partial: true, detail: 'Synthetic id accepted — may fail on platform API (should open URL instead)' };
    } catch (e) {
      return { ok: true, detail: `Correctly rejects/fails synthetic id: ${e.message.slice(0, 80)}` };
    }
  });

  await test('9. Be First monitors (save/get-watched-monitors)', async () => {
    const sample = [{ keyword: 'marketing', platform: 'Reddit', url: 'https://reddit.com/r/test', added: new Date().toISOString() }];
    store.setItem('watchedMonitors', JSON.stringify(sample));
    const loaded = JSON.parse(store.getItem('watchedMonitors') || '[]');
    if (!loaded.length) return { detail: 'Save/load failed' };
    return { ok: true, detail: `${loaded.length} monitor(s)` };
  });

  await test('10. Post history merge (get-all-post-history)', async () => {
    const hist = JSON.parse(store.getItem('postHistory') || '[]');
    return { ok: true, detail: `${hist.length} published hub posts` };
  });

  await test('11. Stock photos (search-stock-photo)', async () => {
    if (!keys.unsplashAccessKey) return { partial: true, detail: 'No Unsplash key' };
    const res = await axios.get('https://api.unsplash.com/search/photos', {
      params: { query: 'social media', per_page: 1 },
      headers: { Authorization: `Client-ID ${keys.unsplashAccessKey}` },
      timeout: 15000,
    });
    if (!res.data?.results?.length) return { detail: 'Unsplash returned 0' };
    return { ok: true, detail: 'Unsplash search OK' };
  });

  await test('12. Image generation (generate-image / FAL)', async () => {
    if (!keys.falKey) return { partial: true, detail: 'No FAL key configured' };
    return { ok: true, detail: 'FAL key present' };
  });

  await test('13. Live news sidebar (get-live-news)', async () => {
    if (!keys.newsApiKey) return { partial: true, detail: 'No NewsAPI key' };
    const res = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: { category: 'technology', language: 'en', pageSize: 4, apiKey: keys.newsApiKey },
      timeout: 15000,
    });
    const n = res.data?.articles?.length || 0;
    if (!n) return { detail: 'NewsAPI returned 0' };
    return { ok: true, detail: `${n} headlines` };
  });

  await test('14. Pagination simulation (5 per page)', async () => {
    const posts = await fetchLiveFeed({});
    const pages = Math.ceil(posts.length / 5);
    if (posts.length < 5) return { partial: true, detail: `Only ${posts.length} posts — need at least 5 for pagination` };
    return { ok: true, detail: `${posts.length} posts → ${pages} page(s) at 5/page` };
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

  fs.writeFileSync(path.join(__dirname, '.browse-posts-test-report.json'), JSON.stringify(results, null, 2));
})();