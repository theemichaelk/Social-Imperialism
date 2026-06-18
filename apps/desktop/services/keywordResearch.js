const axios = require('axios');
const reddit = require('./platforms/reddit');
const twitter = require('./platforms/twitter');
const { hasTwitterKeys } = require('./keys');

const UA = 'SocialImperialism/1.0 by SocialImperialismApp';

function uniqueTerms(terms) {
  const seen = new Set();
  return terms.filter((t) => {
    const key = String(t.term || t).toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchSerpRelated(seed, keys, limit = 8) {
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
  const seeds = [
    brandData.brandName,
    `${brandData.brandName} ${brandData.audience || ''}`.trim(),
    `${brandData.description || ''}`.split(' ').slice(0, 4).join(' '),
  ].filter(Boolean);

  let candidates = [];
  for (const seed of seeds.slice(0, 2)) {
    const related = await fetchSerpRelated(seed, keys, 6);
    candidates.push(...related);
  }

  if (candidates.length < 3 && generateAI) {
    const prompt = `Brand: ${brandData.brandName}. Audience: ${brandData.audience || 'professionals'}. Description: ${brandData.description || ''}.
Return ONLY a JSON array of 5 short social listening keywords/phrases (strings) to track. No markdown.`;
    try {
      const text = await generateAI(prompt);
      let clean = text.trim();
      if (clean.startsWith('```json')) clean = clean.substring(7);
      if (clean.endsWith('```')) clean = clean.substring(0, clean.length - 3);
      const aiTerms = JSON.parse(clean.trim());
      if (Array.isArray(aiTerms)) {
        aiTerms.forEach((t) => candidates.push({ term: String(t), source: 'AI + Brand Profile' }));
      }
    } catch (e) {
      console.error('AI keyword assist error:', e.message);
    }
  }

  candidates = uniqueTerms(candidates).slice(0, 8);

  if (candidates.length === 0) {
    return {
      keywords: [],
      error: 'No keywords found. Add SERP_API_KEY to .env for Google research, or configure Gemini/OpenRouter for AI suggestions.',
    };
  }

  const enriched = [];
  for (const c of candidates.slice(0, 6)) {
    enriched.push(await enrichKeyword(c.term, keys, { source: c.source }));
  }

  enriched.sort((a, b) => (b.liveSignals || 0) - (a.liveSignals || 0));
  return { keywords: enriched, error: null };
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
};