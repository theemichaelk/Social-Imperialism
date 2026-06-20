/**
 * Free + SerpAPI web search fallbacks when platform APIs block or rate-limit.
 */
const axios = require('axios');

const SEARCH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function titleFromUrl(url) {
  if (!url) return '';
  const slug = url.replace(/\/$/, '').split('/').pop() || '';
  return decodeURIComponent(slug).replace(/-/g, ' ').replace(/\?.*$/, '').trim();
}

function cleanTitle(raw, url) {
  let t = String(raw || '').replace(/ - (Quora|Reddit).*$/i, '').trim();
  if (/^https?:\/\//i.test(t) || /^quora\.com\//i.test(t)) t = '';
  if (!t || t.length < 6) t = titleFromUrl(url);
  return t;
}

function extractLinks(html, hostPattern, limit = 15) {
  const items = [];
  const seen = new Set();
  const re = new RegExp(`href="(https?:\\/\\/(?:www\\.)?${hostPattern}[^"#]+)"[^>]*>([\\s\\S]*?)<\\/a>`, 'gi');
  let m;
  while ((m = re.exec(html)) !== null && items.length < limit * 2) {
    const url = m[1].split('&')[0].split('#')[0];
    const title = cleanTitle(m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), url);
    if (!title || seen.has(url)) continue;
    if (/\/(?:login|signup|search|topic|about|terms|privacy|help)(?:\/|$)/i.test(url)) continue;
    seen.add(url);
    items.push({ url, title });
  }
  return items.slice(0, limit);
}

async function searchViaBrave(query, hostPattern, limit = 15) {
  try {
    const res = await axios.get('https://search.brave.com/search', {
      params: { q: query },
      headers: { 'User-Agent': SEARCH_UA, Accept: 'text/html' },
      timeout: 25000,
      validateStatus: (s) => s < 500,
    });
    if (res.status !== 200) return [];
    return extractLinks(String(res.data || ''), hostPattern, limit);
  } catch (e) {
    console.warn('Brave discovery:', e.message);
    return [];
  }
}

function parseMojeekHtml(html, hostPattern, limit = 15) {
  const items = [];
  const seen = new Set();
  const re = new RegExp(`href="(https?:\\/\\/(?:www\\.)?${hostPattern}[^"#]+)"`, 'gi');
  let m;
  while ((m = re.exec(String(html || ''))) !== null && items.length < limit * 2) {
    const url = m[1].split('&')[0].split('#')[0];
    if (seen.has(url)) continue;
    if (/\/(?:login|signup|search|topic|about|terms|privacy|help)(?:\/|$)/i.test(url)) continue;
    seen.add(url);
    items.push({ url, title: titleFromUrl(url) });
  }
  return items.slice(0, limit);
}

async function searchViaMojeek(query, hostPattern, limit = 15) {
  try {
    const res = await axios.get('https://www.mojeek.com/search', {
      params: { q: query },
      headers: { 'User-Agent': SEARCH_UA, Accept: 'text/html' },
      timeout: 25000,
      validateStatus: (s) => s < 500,
    });
    if (res.status !== 200) return [];
    return parseMojeekHtml(res.data, hostPattern, limit);
  } catch (e) {
    console.warn('Mojeek discovery:', e.message);
    return [];
  }
}

function parseDuckDuckGoHtml(html, hostPattern, limit = 15) {
  const items = [];
  const seen = new Set();
  const hostRe = new RegExp(hostPattern, 'i');
  const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(String(html || ''))) !== null && items.length < limit * 2) {
    let url = m[1].replace(/&amp;/g, '&');
    if (url.startsWith('//')) url = `https:${url}`;
    if (!hostRe.test(url) || seen.has(url)) continue;
    if (/\/(?:login|signup|search|topic|about|terms|privacy|help)(?:\/|$)/i.test(url)) continue;
    seen.add(url);
    const title = cleanTitle(m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), url);
    items.push({ url, title });
  }
  return items.slice(0, limit);
}

async function searchViaDuckDuckGo(query, hostPattern, limit = 15) {
  const headers = { 'User-Agent': SEARCH_UA, Accept: 'text/html' };
  try {
    const res = await axios.post('https://html.duckduckgo.com/html/', `q=${encodeURIComponent(query)}`, {
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 8000,
      validateStatus: (s) => s < 500,
    });
    if (res.status !== 200) return [];
    return parseDuckDuckGoHtml(res.data, hostPattern, limit);
  } catch (e) {
    console.warn('DuckDuckGo discovery:', e.message);
    return [];
  }
}

async function searchViaSerp(query, keys, limit = 15) {
  if (!keys?.serpApiKey) return [];
  try {
    const res = await axios.get('https://serpapi.com/search.json', {
      params: { engine: 'google', q: query, api_key: keys.serpApiKey, num: Math.min(limit, 20) },
      timeout: 20000,
    });
    return (res.data?.organic_results || []).slice(0, limit).map((r) => ({
      url: r.link,
      title: cleanTitle(r.title || '', r.link),
      snippet: r.snippet || '',
    }));
  } catch (e) {
    console.warn('SerpAPI discovery:', e.message);
    return [];
  }
}

async function discoverSitePosts({ site, hostPattern, keyword, keys, limit = 5, platform }) {
  const q = `site:${site} ${keyword}`;
  const seen = new Set();
  const out = [];

  const merge = (hits) => {
    hits.forEach((h) => {
      if (out.length >= limit || !h.url || seen.has(h.url)) return;
      seen.add(h.url);
      const title = h.title || titleFromUrl(h.url);
      const isQuora = platform === 'Quora';
      const looksLikeQuestion = isQuora
        || title.includes('?')
        || /\b(how|what|why|when|where|should|can|is|are|does|do)\b/i.test(title);
      const estEngagement = looksLikeQuestion ? 42 : 28;
      out.push({
        platform,
        externalId: `${platform.toLowerCase()}_${Buffer.from(h.url).toString('base64').slice(0, 20)}`,
        content: title,
        url: h.url,
        author: platform,
        time: 'recent',
        createdAt: Date.now(),
        matchScore: looksLikeQuestion ? 72 : 55,
        isWebDiscovery: true,
        postType: looksLikeQuestion ? 'question' : 'text',
        stats: { likes: estEngagement, comments: looksLikeQuestion ? 3 : 0, views: 0 },
        matchedKeyword: keyword,
        snippet: h.snippet || '',
      });
    });
  };

  merge(await searchViaSerp(q, keys, limit));
  if (out.length < limit) merge(await searchViaBrave(q, hostPattern, limit));
  if (out.length < limit && !process.env.SI_TEST_QUICK) merge(await searchViaDuckDuckGo(q, hostPattern, limit));
  if (out.length < limit) merge(await searchViaMojeek(q, hostPattern, limit));

  return out.slice(0, limit);
}

async function discoverRedditPosts(keyword, keys, limit = 5) {
  return discoverSitePosts({
    site: 'reddit.com',
    hostPattern: 'reddit\\.com',
    keyword,
    keys,
    limit,
    platform: 'Reddit',
  });
}

async function discoverQuoraPosts(keyword, keys, limit = 5) {
  return discoverSitePosts({
    site: 'quora.com',
    hostPattern: 'quora\\.com',
    keyword,
    keys,
    limit,
    platform: 'Quora',
  });
}

async function discoverTwitterPosts(keyword, keys, limit = 5) {
  return discoverSitePosts({
    site: 'twitter.com',
    hostPattern: '(?:twitter|x)\\.com',
    keyword,
    keys,
    limit,
    platform: 'Twitter',
  });
}

module.exports = {
  discoverRedditPosts,
  discoverQuoraPosts,
  discoverTwitterPosts,
  searchViaBrave,
  searchViaDuckDuckGo,
  searchViaMojeek,
  searchViaSerp,
};