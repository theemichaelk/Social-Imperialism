/**
 * Setup Wizard feature tester — exercises all 4 steps without Electron UI.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { LocalStorage } = require('node-localstorage');
const axios = require('axios');
const { resolveKeys, hasTwitterKeys, hasRedditKeys, hasLinkedInKeys, hasMetaKeys } = require('./services/keys');
const { fetchRealFeed } = require('./services/feedFetcher');
const integrations = require('./services');
const keywordResearch = require('./services/keywordResearch');

const dataPath = path.join(__dirname, '.test-wizard-store');
if (fs.existsSync(dataPath)) fs.rmSync(dataPath, { recursive: true, force: true });
fs.mkdirSync(dataPath, { recursive: true });
const store = new LocalStorage(path.join(dataPath, 'storage'));

// Load .env keys into store like the app does on first run
const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
store.setItem('globalApiKeys', JSON.stringify(keys));

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

function getSetupStatus() {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let campaigns = [];
  try { campaigns = JSON.parse(store.getItem('campaigns') || '[]'); } catch (e) {}
  const campaign = campaigns.find((c) => c.id === activeCampaignId) || campaigns[0] || null;
  const hasProject = !!(campaign?.brandName?.trim() && campaign?.domain?.trim() && campaign?.description?.trim());
  let keywords = [];
  try {
    keywords = JSON.parse(store.getItem('keywords') || '[]')
      .filter((k) => k.campaignId === (campaign?.id || activeCampaignId));
  } catch (e) {}
  const hasKeywords = keywords.length > 0;
  const onboardingComplete = store.getItem('onboardingComplete') === 'true';
  let nextStep = 1;
  if (hasProject && !hasKeywords) nextStep = 2;
  else if (hasProject && hasKeywords && !onboardingComplete) nextStep = 3;
  else if (hasProject && hasKeywords && onboardingComplete) nextStep = 4;
  return { hasProject, hasKeywords, onboardingComplete, complete: hasProject && hasKeywords && onboardingComplete, nextStep, campaign, keywords };
}

async function generateAI(prompt) {
  const geminiKey = keys.gemini;
  const openrouterKey = keys.openrouter;
  if (openrouterKey) {
    try {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
      }, { headers: { Authorization: `Bearer ${openrouterKey}` }, timeout: 60000 });
      return res.data?.choices?.[0]?.message?.content || '';
    } catch (e) { /* fallback */ }
  }
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  for (const m of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`;
      const res = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] }, { timeout: 60000 });
      const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) return text;
    } catch (e) { /* next */ }
  }
  throw new Error('AI generation failed');
}

let campaignId = null;

(async () => {
  console.log('\n=== SETUP WIZARD FEATURE TEST ===');
  console.log('Keys:', {
    gemini: !!keys.gemini, openrouter: !!keys.openrouter, serp: !!keys.serpApiKey,
    twitter: hasTwitterKeys(keys), reddit: hasRedditKeys(keys), linkedin: hasLinkedInKeys(keys), meta: hasMetaKeys(keys),
  });
  console.log('');

  // STEP 1
  await test('Step 1 — Save project (save-settings + set-active-campaign)', async () => {
    campaignId = 'camp_test_' + Date.now();
    const camp = {
      id: campaignId,
      brandName: 'Acme Growth Labs',
      domain: 'acmegrowth.com',
      description: 'B2B marketing automation and social listening for SaaS brands.',
      tone: 'professional',
      audience: 'SaaS founders',
      affiliateLinks: 'https://acmegrowth.com/trial',
      status: 'Running',
    };
    store.setItem('campaigns', JSON.stringify([camp]));
    store.setItem('activeCampaignId', campaignId);
    const active = JSON.parse(store.getItem('campaigns')).find((c) => c.id === campaignId);
    if (!active?.brandName) return { detail: 'Campaign not saved' };
    return { ok: true, detail: `Saved "${active.brandName}" (${active.domain})` };
  });

  await test('Step 1 — get-setup-status after project save', async () => {
    const s = getSetupStatus();
    if (!s.hasProject) return { detail: 'hasProject=false' };
    if (s.nextStep !== 2) return { partial: true, detail: `nextStep=${s.nextStep}, expected 2` };
    return { ok: true, detail: `nextStep=2, campaign loaded` };
  });

  await test('Step 1 — get-active-campaign returns saved brand', async () => {
    const activeId = store.getItem('activeCampaignId');
    const camps = JSON.parse(store.getItem('campaigns') || '[]');
    const camp = camps.find((c) => c.id === activeId);
    if (!camp?.description) return { detail: 'Active campaign missing' };
    return { ok: true, detail: camp.brandName };
  });

  // STEP 2
  await test('Step 2 — AI Suggest Keywords (generate-keywords)', async () => {
    const camp = JSON.parse(store.getItem('campaigns'))[0];
    const res = await keywordResearch.researchBrandKeywords(camp, keys, generateAI);
    const kws = res.keywords || [];
    if (!kws.length) return { detail: res.error || '0 keywords returned' };
    return { ok: true, detail: `${kws.length} keywords (e.g. ${kws[0].term})` };
  });

  await test('Step 2 — Save keywords (save-keywords)', async () => {
    const kws = [
      { term: 'marketing automation', platforms: ['Twitter', 'Reddit', 'LinkedIn', 'Quora'], intent: 'mentions', customPrompt: '' },
      { term: 'SaaS growth', platforms: ['Twitter', 'Reddit'], intent: 'qa', customPrompt: 'Mention free trial' },
    ];
    let all = [];
    const data = store.getItem('keywords');
    if (data) try { all = JSON.parse(data); } catch (e) {}
    all = all.filter((k) => k.campaignId !== campaignId);
    kws.forEach((kw, i) => {
      all.push({ id: `kw_${Date.now()}_${i}`, campaignId, ...kw });
    });
    store.setItem('keywords', JSON.stringify(all));
    const saved = JSON.parse(store.getItem('keywords')).filter((k) => k.campaignId === campaignId);
    if (saved.length < 2) return { detail: 'Keywords not persisted' };
    return { ok: true, detail: `${saved.length} keywords saved` };
  });

  await test('Step 2 — get-setup-status after keywords save', async () => {
    const s = getSetupStatus();
    if (!s.hasKeywords) return { detail: 'hasKeywords=false' };
    if (s.nextStep !== 3) return { partial: true, detail: `nextStep=${s.nextStep}, expected 3` };
    return { ok: true, detail: `${s.keywords.length} keywords, nextStep=3` };
  });

  // STEP 3
  await test('Step 3 — Browse feed preview (get-live-feed)', async () => {
    const tracked = JSON.parse(store.getItem('keywords') || '[]')
      .filter((k) => k.campaignId === campaignId).map((k) => k.term);
    const posts = await fetchRealFeed({ keywords: tracked, filters: { platform: 'All', sort: 'recent' }, keys, allowedPlatforms: new Set() });
    if (!posts.length) return { detail: '0 posts in feed preview' };
    const withUrl = posts.filter((p) => p.url).length;
    return { ok: true, detail: `${posts.length} posts, ${withUrl} with URLs` };
  });

  await test('Step 3 — Feed filters (engagement + question)', async () => {
    const tracked = JSON.parse(store.getItem('keywords') || '[]')
      .filter((k) => k.campaignId === campaignId).map((k) => k.term);
    const posts = await fetchRealFeed({ keywords: tracked, filters: {}, keys, allowedPlatforms: new Set() });
    const minEng = 100;
    const filtered = posts.filter((p) => (p.stats?.likes || 0) >= minEng);
    if (!filtered.length && posts.length) {
      return { partial: true, detail: `>100 engagement filter empties feed (${posts.length} → 0) — wizard step 3 has same issue` };
    }
    return { ok: true, detail: `${filtered.length}/${posts.length} pass >100 engagement` };
  });

  await test('Step 3 — Draft AI Reply (draft-post-reply)', async () => {
    const prompt = `Reply in 15 words about SaaS marketing to: "What tools help with social listening?"`;
    const text = await generateAI(prompt);
    if (!text || text.startsWith('Error')) return { detail: 'AI empty' };
    return { ok: true, detail: `"${String(text).trim().slice(0, 60)}"` };
  });

  // STEP 4
  await test('Step 4 — AI Auto-Fill global prompt (generate-global-custom-prompt)', async () => {
    const camp = JSON.parse(store.getItem('campaigns'))[0];
    const kws = JSON.parse(store.getItem('keywords') || '[]').filter((k) => k.campaignId === campaignId);
    const prompt = `Write a 3-sentence global custom prompt for social replies. Brand: ${camp.brandName}. Keywords: ${kws.map((k) => k.term).join(', ')}`;
    const text = await generateAI(prompt);
    if (!text?.trim()) return { detail: 'Empty prompt' };
    return { ok: true, detail: `${text.trim().slice(0, 70)}…` };
  });

  await test('Step 4 — Be-First monitors (save/get)', async () => {
    const mons = [{ term: 'marketing automation', platform: 'Reddit', type: 'keyword', target: 'keyword', added: new Date().toISOString() }];
    store.setItem('watchedMonitors', JSON.stringify(mons));
    const loaded = JSON.parse(store.getItem('watchedMonitors') || '[]');
    if (!loaded.length) return { detail: 'Monitors not saved' };
    return { ok: true, detail: `${loaded.length} monitor(s)` };
  });

  await test('Step 4 — Finish: save-auto-rules + auto-search settings', async () => {
    const rules = {
      customRulePrompt: 'Always mention Acme Growth Labs and acmegrowth.com when relevant.',
      enabled: true,
      realTimeMonitoringEnabled: true,
      beFirstDelay: true,
      oneClickAutoSearchEnabled: true,
      autoSearchFrequency: 'daily',
      beFirstMonitorFrequency: '10m',
      frequency: '10m',
    };
    store.setItem('autoRulesEngine', JSON.stringify(rules));
    store.setItem('autoSearchSettings', JSON.stringify({ dailyEnabled: true, frequency: 'daily', beFirstMonitorFrequency: '10m' }));
    const saved = JSON.parse(store.getItem('autoRulesEngine') || '{}');
    if (!saved.customRulePrompt) return { detail: 'Rules not saved' };
    return { ok: true, detail: 'Auto-rules + search frequency saved' };
  });

  await test('Step 4 — set-onboarding-complete', async () => {
    store.setItem('onboardingComplete', 'true');
    const s = getSetupStatus();
    if (!s.onboardingComplete) return { detail: 'Flag not set' };
    if (!s.complete) return { detail: 'complete=false after finish' };
    return { ok: true, detail: 'Setup marked complete' };
  });

  await test('Wizard resume — get-setup-status nextStep=4 when complete', async () => {
    const s = getSetupStatus();
    if (s.nextStep !== 4) return { partial: true, detail: `nextStep=${s.nextStep}` };
    return { ok: true, detail: 'User can resume at step 4' };
  });

  await test('Complementary — linked accounts check', async () => {
    const accs = JSON.parse(store.getItem(`linkedAccounts_${campaignId}`) || '[]');
    if (!accs.length) return { partial: true, detail: 'No linked accounts — wizard should prompt Account Hub link' };
    return { ok: true, detail: `${accs.length} linked` };
  });

  await test('Complementary — API readiness panel data', async () => {
    const status = integrations.getApiStatus(keys);
    const connected = Object.entries(status).filter(([, v]) => v).map(([k]) => k);
    if (!connected.length) return { detail: 'No APIs reported connected' };
    return { ok: true, detail: connected.join(', ') };
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
    console.log('\nPARTIALLY WORKING / GAPS:');
    partial.forEach((f) => console.log(`  - ${f.feature}: ${f.detail}`));
  }
  fs.writeFileSync(path.join(__dirname, '.setup-wizard-test-report.json'), JSON.stringify(results, null, 2));
})();