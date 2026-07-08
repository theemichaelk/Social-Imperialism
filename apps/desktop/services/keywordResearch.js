const axios = require('axios');
const reddit = require('./platforms/reddit');
const twitter = require('./platforms/twitter');
const { hasTwitterKeys } = require('./keys');

const UA = 'SocialImperialism/1.0 by SocialImperialismApp';

function extractKeywordTerm(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'object') {
    const raw = item.term ?? item.keyword ?? item.query ?? item.value ?? item.label ?? '';
    return String(raw).trim();
  }
  return String(item).trim();
}

function normalizeKeywordTerms(items) {
  const seen = new Set();
  const out = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    const term = extractKeywordTerm(item);
    const key = term.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(term);
  });
  return out;
}

function uniqueTerms(terms) {
  const seen = new Set();
  return terms.filter((t) => {
    const key = extractKeywordTerm(t).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseAiKeywordList(text) {
  let clean = String(text || '').trim();
  if (!clean) return [];
  if (clean.startsWith('```json')) clean = clean.slice(7);
  if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  clean = clean.trim();

  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) {
      return normalizeKeywordTerms(parsed);
    }
    if (parsed && Array.isArray(parsed.keywords)) {
      return normalizeKeywordTerms(parsed.keywords);
    }
  } catch (e) { /* fall through */ }

  const lineItems = clean
    .split(/\n+/)
    .map((line) => line.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter(Boolean);
  if (lineItems.length > 1) return normalizeKeywordTerms(lineItems);

  return normalizeKeywordTerms(clean.split(/[,;|]/));
}

async function aiSuggestKeywords(brandData, generateAI) {
  if (!generateAI) return [];
  const prompt = `Brand: ${brandData.brandName || 'brand'}. Domain: ${brandData.domain || 'n/a'}. Audience: ${brandData.audience || 'professionals'}. Description: ${brandData.description || ''}.
Return ONLY a JSON array of 8 short social listening keywords/phrases (strings) to track on Twitter, Reddit, and LinkedIn. No markdown.`;
  try {
    const text = await generateAI(prompt);
    const terms = parseAiKeywordList(text);
    if (terms.length) return terms;
  } catch (e) {
    console.error('AI keyword assist error:', e.message);
  }

  try {
    const fallbackPrompt = `Suggest 8 high-intent social media keywords for brand "${brandData.brandName || 'brand'}" (${brandData.domain || 'no domain'}). Return comma-separated only.`;
    const text = await generateAI(fallbackPrompt);
    return parseAiKeywordList(text);
  } catch (e) {
    console.error('AI keyword fallback error:', e.message);
    return [];
  }
}

async function fetchSerpRelated(seed, keys, limit = 8) {
  try {
    const { serpRelatedTerms, isSerpConfigured } = require('../../../packages/core/src/serpProvider');
    if (isSerpConfigured(keys)) {
      const fromProvider = await serpRelatedTerms(keys, seed, limit);
      if (fromProvider.length) return fromProvider;
    }
  } catch (e) {
    console.error('SERP provider related terms:', e.message);
  }
  if (!keys.serpApiKey) return [];
  const terms = [];

  try {
    const autoRes = await axios.get('https://serpapi.com/search.json', {
      params: { engine: 'google_autocomplete', q: seed, api_key: keys.serpApiKey },
      timeout: 15000,
    });
    (autoRes.data?.suggestions || []).forEach((s) => {
      const val = s.value || s;
      if (val) terms.push({ term: String(val), source: 'Google Autocomplete' });
    });
  } catch (e) {
    console.error('Serp autocomplete error:', e.message);
  }

  try {
    const searchRes = await axios.get('https://serpapi.com/search.json', {
      params: { engine: 'google', q: seed, api_key: keys.serpApiKey, num: 5 },
      timeout: 15000,
    });
    (searchRes.data?.related_searches || []).forEach((r) => {
      if (r.query) terms.push({ term: r.query, source: 'Google Related' });
    });
    (searchRes.data?.related_questions || []).forEach((r) => {
      if (r.question) terms.push({ term: r.question.replace(/\?$/, ''), source: 'People Also Ask' });
    });
  } catch (e) {
    console.error('Serp related search error:', e.message);
  }

  return uniqueTerms(terms).slice(0, limit);
}

async function fetchTrendSignal(term, keys) {
  if (!keys.serpApiKey) return { searchVolume: null, momentum: null };
  try {
    const res = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_trends',
        q: term,
        api_key: keys.serpApiKey,
        data_type: 'TIMESERIES',
      },
      timeout: 15000,
    });
    const timeline = res.data?.interest_over_time?.timeline_data || [];
    if (timeline.length >= 2) {
      const recent = timeline.slice(-4).map((d) => parseInt(d.values?.[0]?.value || 0, 10));
      const avg = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
      const prev = parseInt(timeline[timeline.length - 5]?.values?.[0]?.value || avg, 10);
      const momentum = prev > 0 ? `${avg >= prev ? '+' : ''}${Math.round(((avg - prev) / prev) * 100)}%` : 'Live';
      return { searchVolume: avg, momentum };
    }
  } catch (e) {
    console.error('Serp trends error:', e.message);
  }
  return { searchVolume: null, momentum: null };
}

async function countLiveMentions(term, keys) {
  let redditPosts = 0;
  let twitterPosts = 0;

  try {
    const rd = await reddit.searchPosts(term, keys, 10);
    redditPosts = rd.length;
  } catch (e) {}

  if (hasTwitterKeys(keys)) {
    try {
      const tw = await twitter.searchPosts(term, keys, 10);
      twitterPosts = tw.length;
    } catch (e) {}
  }

  return { redditPosts, twitterPosts, liveSignals: redditPosts + twitterPosts };
}

async function enrichKeyword(term, keys, meta = {}) {
  const [trend, live] = await Promise.all([
    fetchTrendSignal(term, keys),
    countLiveMentions(term, keys),
  ]);

  return {
    term,
    source: meta.source || 'Research',
    searchVolume: trend.searchVolume,
    momentum: trend.momentum,
    redditPosts: live.redditPosts,
    twitterPosts: live.twitterPosts,
    liveSignals: live.liveSignals,
  };
}

async function researchBrandKeywords(brandData, keys, generateAI) {
  const brand = brandData || {};
  const seeds = [
    brand.brandName,
    brand.domain,
    `${brand.brandName || ''} ${brand.audience || ''}`.trim(),
    `${brand.description || ''}`.split(/\s+/).slice(0, 5).join(' '),
  ].filter(Boolean);

  let candidates = [];
  for (const seed of seeds.slice(0, 3)) {
    const related = await fetchSerpRelated(seed, keys, 6);
    candidates.push(...related);
  }

  if (candidates.length < 3) {
    const aiTerms = await aiSuggestKeywords(brand, generateAI);
    aiTerms.forEach((term) => candidates.push({ term, source: 'AI + Brand Profile' }));
  }

  candidates = uniqueTerms(candidates).slice(0, 10);
  const keywordStrings = normalizeKeywordTerms(candidates);

  if (keywordStrings.length === 0) {
    return {
      keywords: [],
      enriched: [],
      error: 'No keywords found. Add a brand name in Setup Wizard, or configure Gemini/OpenRouter (AI) or SerpAPI/SI SERP for live research.',
    };
  }

  const enriched = [];
  for (const term of keywordStrings.slice(0, 6)) {
    const meta = candidates.find((c) => extractKeywordTerm(c).toLowerCase() === term.toLowerCase());
    enriched.push(await enrichKeyword(term, keys, { source: meta?.source || 'Research' }));
  }

  enriched.sort((a, b) => (b.liveSignals || 0) - (a.liveSignals || 0));
  const sortedTerms = normalizeKeywordTerms(enriched);
  return { keywords: sortedTerms, enriched, error: null };
}

async function researchSingleKeyword(term, keys) {
  if (!term || !term.trim()) return { error: 'Keyword required' };
  const enriched = await enrichKeyword(term.trim(), keys, { source: 'Manual' });
  return { keyword: enriched };
}

function getApiStatus(keys) {
  const { hasLinkedInKeys, hasMetaKeys, hasRedditKeys } = require('./keys');
  return {
    serpApi: !!keys.serpApiKey,
    reddit: hasRedditKeys(keys),
    twitter: hasTwitterKeys(keys),
    linkedin: hasLinkedInKeys(keys),
    meta: hasMetaKeys(keys),
    newsApi: !!keys.newsApiKey,
    ai: !!(keys.gemini || keys.openrouter || keys.openai),
  };
}

module.exports = {
  researchBrandKeywords,
  researchSingleKeyword,
  enrichKeyword,
  getApiStatus,
  extractKeywordTerm,
  normalizeKeywordTerms,
  parseAiKeywordList,
  aiSuggestKeywords,
};