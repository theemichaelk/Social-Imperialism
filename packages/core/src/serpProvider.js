/**
 * Unified SERP provider — Social Imperialism SERP Engine (preferred) or SerpAPI (legacy).
 */
const axios = require('axios');
const {
  isSiSerpConfigured,
  searchSiSerp,
  resolveAuth,
  PROVIDER_ID,
  ENGINES,
} = require('./siSerpClient');
const { ensureSiSerpSidecar, probeHealth } = require('./siSerpSidecar');

function resolveSerpApiKey(keys = {}) {
  return keys.serpApiKey || keys.serpapi || null;
}

function isSerpApiConfigured(keys = {}) {
  return !!resolveSerpApiKey(keys);
}

function isSerpConfigured(keys = {}) {
  return isSiSerpConfigured(keys) || isSerpApiConfigured(keys);
}

function getSerpProviderStatus(keys = {}) {
  const si = isSiSerpConfigured(keys);
  const serpapi = isSerpApiConfigured(keys);
  const auth = resolveAuth(keys);
  let active = null;
  if (si) active = PROVIDER_ID;
  else if (serpapi) active = 'serpapi';
  return {
    configured: !!active,
    active,
    socialImperialismSerp: si,
    serpapi,
    siSerpBaseUrl: auth?.baseUrl || null,
    engines: si ? ENGINES : ['google'],
    healthy: null,
  };
}

async function getSerpProviderStatusAsync(keys = {}) {
  const status = getSerpProviderStatus(keys);
  if (status.siSerpBaseUrl) {
    try {
      status.healthy = await probeHealth(status.siSerpBaseUrl);
    } catch {
      status.healthy = false;
    }
  }
  return status;
}

function normalizePayload(q) {
  if (typeof q === 'string') return { query: q };
  if (q && typeof q === 'object') {
    return {
      query: q.query || q.text || q.q || '',
      engine: q.engine,
      mega: q.mega,
      engines: q.engines,
      limit: q.limit,
      extract: q.extract,
      extractMode: q.extractMode || q.extract_mode,
      lang: q.lang,
      region: q.region,
      site: q.site,
      date: q.date,
      mode: q.mode,
    };
  }
  return { query: '' };
}

async function searchSerpApi(keys, options = {}) {
  const key = resolveSerpApiKey(keys);
  if (!key) return { success: false, error: 'No SerpAPI key' };
  const query = String(options.query || '').trim();
  if (!query) return { success: false, error: 'Query required' };

  try {
    const res = await axios.get('https://serpapi.com/search.json', {
      params: {
        q: query,
        api_key: key,
        num: Math.min(Number(options.limit) || 10, 100),
        engine: options.engine || 'google',
      },
      timeout: options.timeoutMs || 20000,
    });
    const organic = res.data?.organic_results || [];
    const related = [];
    (res.data?.related_searches || []).forEach((r) => {
      if (r.query) related.push({ term: r.query, source: 'Google Related' });
    });
    (res.data?.related_questions || []).forEach((r) => {
      if (r.question) related.push({ term: r.question.replace(/\?$/, ''), source: 'People Also Ask' });
    });
    return {
      success: true,
      provider: 'serpapi',
      data: organic,
      serpFeatures: [],
      relatedTerms: related,
      answerBox: res.data?.answer_box || null,
      raw: res.data,
    };
  } catch (e) {
    const msg = e.message || '';
    if (msg.includes('429') || msg.includes('403')) {
      return {
        success: true,
        provider: 'serpapi',
        rateLimited: true,
        data: [],
        note: 'SerpAPI rate limited — retry later or configure Social Imperialism SERP',
      };
    }
    return { success: false, error: msg, provider: 'serpapi' };
  }
}

async function serpSearch(keys, q, overrides = {}) {
  const options = { ...normalizePayload(q), ...overrides };
  if (!options.query?.trim()) return { success: false, error: 'Query required' };

  if (isSiSerpConfigured(keys)) {
    try {
      await ensureSiSerpSidecar(keys);
      return await searchSiSerp(keys, options);
    } catch (e) {
      if (isSerpApiConfigured(keys)) {
        const fallback = await searchSerpApi(keys, options);
        return {
          ...fallback,
          siSerpError: e.message,
          note: 'Fell back to SerpAPI after Social Imperialism SERP error',
        };
      }
      return { success: false, error: e.message, provider: PROVIDER_ID, reason: e.reason };
    }
  }

  return searchSerpApi(keys, options);
}

async function serpRelatedTerms(keys, seed, limit = 8) {
  const { defaultEngine } = require('./siSerpClient');
  const res = await serpSearch(keys, {
    query: seed,
    limit: 10,
    engine: defaultEngine(keys),
    extract: 0,
  });
  if (!res.success) return [];
  const terms = [...(res.relatedTerms || [])];
  const seen = new Set();
  return terms.filter((t) => {
    const key = String(t.term || '').toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

module.exports = {
  isSerpConfigured,
  isSerpApiConfigured,
  isSiSerpConfigured,
  isOpenSerpConfigured: isSiSerpConfigured,
  getSerpProviderStatus,
  getSerpProviderStatusAsync,
  serpSearch,
  serpRelatedTerms,
  searchSerpApi,
  searchSiSerp,
  searchOpenSerp: searchSiSerp,
  normalizePayload,
  ensureSiSerpSidecar,
};