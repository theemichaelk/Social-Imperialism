/**
 * Social Imperialism SERP Engine — browser-rendered multi-engine search + page extract.
 * Google, Bing, Yandex, Baidu, DuckDuckGo, Ecosia.
 */
const axios = require('axios');

const ENGINES = ['google', 'bing', 'yandex', 'baidu', 'duckduckgo', 'ecosia', 'yahoo'];
const PROVIDER_ID = 'social-imperialism';

function pickBaseUrl(keys = {}) {
  const raw = keys.siSerpBaseUrl
    || keys.openSerpBaseUrl
    || keys.openserpBaseUrl
    || process.env.SI_SERP_BASE_URL
    || process.env.OPENSERP_BASE_URL
    || '';
  return raw && String(raw).trim() ? String(raw).trim().replace(/\/$/, '') : '';
}

function defaultEngine(keys = {}) {
  const raw = (keys.siSerpDefaultEngine || process.env.SI_SERP_DEFAULT_ENGINE || '').trim().toLowerCase();
  if (raw && ENGINES.includes(raw)) return raw;
  const base = pickBaseUrl(keys);
  if (base && /127\.0\.0\.1|localhost/i.test(base)) return 'bing';
  return 'google';
}

function pickApiKey(keys = {}) {
  return keys.siSerpApiKey || keys.openSerpApiKey || keys.openserpApiKey || '';
}

function resolveAuth(keys = {}) {
  const baseUrl = pickBaseUrl(keys);
  const apiKey = pickApiKey(keys);
  if (!baseUrl && !apiKey) return null;
  if (!baseUrl) return null;
  return { baseUrl, apiKey: apiKey || null };
}

function isSiSerpConfigured(keys = {}) {
  return !!resolveAuth(keys);
}

function buildHeaders(apiKey) {
  const headers = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function mapResult(item = {}) {
  return {
    position: item.rank ?? item.position?.absolute ?? null,
    title: item.title || '',
    link: item.url || '',
    displayed_link: item.display_url || item.domain || '',
    snippet: item.snippet || '',
    source: item.engine || PROVIDER_ID,
    domain: item.domain || null,
    extracted: item.extracted || null,
    type: item.type || 'organic',
  };
}

function termsFromSerpFeatures(features = []) {
  const terms = [];
  for (const f of features) {
    const type = String(f.type || f.title || '').toLowerCase();
    const items = f.items || f.questions || f.links || [];
    if (/people.?also.?ask|paa/.test(type)) {
      for (const it of items) {
        const q = it.question || it.text || it.title || it;
        if (q) terms.push({ term: String(q).replace(/\?$/, ''), source: 'People Also Ask' });
      }
    }
    if (/related/.test(type)) {
      for (const it of items) {
        const q = it.query || it.text || it.title || it;
        if (q) terms.push({ term: String(q), source: 'Related searches' });
      }
    }
    if (f.text && /ai overview|summary/.test(type)) {
      terms.push({ term: String(f.text).slice(0, 120), source: 'AI Overview snippet' });
    }
  }
  return terms;
}

async function siSerpRequest(baseUrl, apiKey, path, params, timeoutMs = 90000) {
  const res = await axios.get(`${baseUrl}${path}`, {
    params,
    headers: buildHeaders(apiKey),
    timeout: timeoutMs,
    validateStatus: (s) => s < 500,
  });
  if (res.status >= 400) {
    const msg = res.data?.message || res.data?.error || `Social Imperialism SERP HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.reason = res.data?.reason;
    throw err;
  }
  return res.data || {};
}

async function searchSiSerp(keys, options = {}) {
  const auth = resolveAuth(keys);
  if (!auth) {
    return {
      success: false,
      error: 'Social Imperialism SERP not configured — set siSerpBaseUrl in Integrations → Data & Research',
    };
  }

  const query = String(options.query || options.text || options.q || '').trim();
  if (!query) return { success: false, error: 'Query required' };

  const engine = String(options.engine || defaultEngine(keys)).toLowerCase();
  const mega = options.mega === true || options.mode === 'mega' || (Array.isArray(options.engines) && options.engines.length > 1);
  const path = mega ? '/mega/search' : `/${engine}/search`;

  const params = {
    text: query,
    limit: Math.min(Number(options.limit) || 10, 100),
    lang: options.lang || 'EN',
    region: options.region || 'US',
  };
  if (options.start != null) params.start = options.start;
  if (options.site) params.site = options.site;
  if (options.date) params.date = options.date;
  if (options.file) params.file = options.file;
  if (options.format) params.format = options.format;

  if (mega) {
    const engines = (options.engines || [defaultEngine(keys), 'yahoo', 'bing']).filter((e) => ENGINES.includes(String(e).toLowerCase()));
    params.engines = engines.join(',');
    if (options.mode) params.mode = options.mode;
    if (options.dedupe != null) params.dedupe = options.dedupe;
  }

  if (options.extract) {
    params.extract = options.extract === true ? 1 : options.extract;
    if (options.extractMode) params.extract_mode = options.extractMode;
  }

  const body = await siSerpRequest(auth.baseUrl, auth.apiKey, path, params, options.timeoutMs || 90000);
  const data = (body.results || []).map(mapResult);

  return {
    success: true,
    provider: PROVIDER_ID,
    data,
    serpFeatures: body.serp_features || [],
    clusters: body.clusters || [],
    meta: body.meta || {},
    query: body.query || { text: query },
    relatedTerms: termsFromSerpFeatures(body.serp_features || []),
    pagination: body.pagination || null,
  };
}

async function extractUrl(keys, url, options = {}) {
  const auth = resolveAuth(keys);
  if (!auth) return { success: false, error: 'Social Imperialism SERP not configured' };
  const body = await siSerpRequest(auth.baseUrl, auth.apiKey, '/extract', {
    url,
    format: options.format || 'markdown',
    mode: options.extractMode || options.mode || 'auto',
  }, options.timeoutMs || 60000);
  return { success: true, provider: PROVIDER_ID, ...body };
}

module.exports = {
  ENGINES,
  PROVIDER_ID,
  pickBaseUrl,
  pickApiKey,
  defaultEngine,
  resolveAuth,
  isSiSerpConfigured,
  searchSiSerp,
  extractUrl,
  mapResult,
  termsFromSerpFeatures,
  // Legacy aliases (internal)
  isOpenSerpConfigured: isSiSerpConfigured,
  searchOpenSerp: searchSiSerp,
};