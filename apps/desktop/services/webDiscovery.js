/**
 * Free + SerpAPI web search fallbacks when platform APIs block or rate-limit.
 */
const axios = require('axios');
const { redditPostIdFromUrl } = require('./postIdUtils');

const SEARCH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function redditPostFromHit(h, keyword, looksLikeQuestion) {
  const postId = redditPostIdFromUrl(h.url);
  const title = h.title || titleFromUrl(h.url);
  return {
    platform: 'Reddit',
    externalId: postId || `reddit_rss_${Buffer.from(h.url).toString('base64').slice(0, 16)}`,
    content: title,
    url: h.url,
    author: h.author || 'Reddit',
    time: 'recent',
    createdAt: Date.now(),
    matchScore: looksLikeQuestion ? 70 : 55,
    isWebDiscovery: !postId,
    postType: looksLikeQuestion ? 'question' : 'text',
    stats: { likes: looksLikeQuestion ? 20 : 10, comments: looksLikeQuestion ? 2 : 0, views: 0 },
    matchedKeyword: keyword,
  };
}

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

async function searchViaRedditRss(keyword, limit = 15) {
  try {
    const res = await axios.get('https://www.reddit.com/search.rss', {
      params: { q: keyword, limit: Math.min(limit, 25) },
      headers: { 'User-Agent': SEARCH_UA },
      timeout: 12000,
      validateStatus: (s) => s < 500,
    });
    if (res.status !== 200) return [];
    const xml = String(res.data || '');
    const items = [];
    const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
    let m;
    while ((m = entryRe.exec(xml)) && items.length < limit) {
      const entry = m[1];
      const title = ((entry.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '')
        .replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const link = ((entry.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '').split('&')[0];
      const author = ((entry.match(/<name>([\s\S]*?)<\/name>/) || [])[1] || 'reddit').trim();
      if (!title || !link) continue;
      items.push({ url: link, title, author });
    }
    return items;
  } catch (e) {
    console.warn('Reddit RSS discovery:', e.message);
    return [];
  }
}

async function searchViaDuckDuckGo(query, hostPattern, limit = 15) {
  const headers = { 'User-Agent': SEARCH_UA, Accept: 'text/html' };
  const timeout = process.env.SI_TEST_QUICK === '1' ? 5000 : 8000;
  try {
    const res = await axios.post('https://html.duckduckgo.com/html/', `q=${encodeURIComponent(query)}`, {
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout,
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
  try {
    const path = require('path');
    const { serpSearch, isSerpConfigured } = require(path.join(__dirname, '../../../packages/core/src/serpProvider'));
    if (isSerpConfigured(keys)) {
      const res = await serpSearch(keys, { query, limit: Math.min(limit, 20), engine: 'google' });
      if (res?.success && Array.isArray(res.data) && res.data.length) {
        return res.data.slice(0, limit).map((r) => ({
          url: r.url || r.link,
          title: cleanTitle(r.title || '', r.url || r.link),
          snippet: r.snippet || r.description || '',
        })).filter((h) => h.url);
      }
    }
  } catch (e) {
    console.warn('Unified SERP discovery:', e.message);
  }

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

const PROFILE_SEARCH_QUERIES = {
  YouTube: (kw) => [`site:youtube.com/@ ${kw}`, `site:youtube.com/channel ${kw}`],
  LinkedIn: (kw) => [`site:linkedin.com/company ${kw}`, `site:linkedin.com/in ${kw}`],
  Instagram: (kw) => [`site:instagram.com ${kw}`],
  TikTok: (kw) => [`site:tiktok.com/@ ${kw}`],
  Twitter: (kw) => [`site:twitter.com ${kw}`, `site:x.com ${kw}`],
  Facebook: (kw) => [`site:facebook.com ${kw}`],
  Pinterest: (kw) => [`site:pinterest.com ${kw}`],
  Threads: (kw) => [`site:threads.net/@ ${kw}`],
  Twitch: (kw) => [`site:twitch.tv ${kw}`],
  Quora: (kw) => [`site:quora.com/topic ${kw}`, `site:quora.com/profile ${kw}`],
  Discord: (kw) => [`site:discord.com/invite ${kw}`],
  Telegram: (kw) => [`site:t.me ${kw}`],
};

async function discoverSitePosts({ site, hostPattern, keyword, keys, limit = 5, platform }) {
  const profileQuery = PROFILE_SEARCH_QUERIES[platform]?.(keyword)?.[0];
  const queries = profileQuery
    ? [profileQuery, `site:${site} ${keyword}`]
    : [`site:${site} ${keyword}`];
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
      const redditId = platform === 'Reddit' ? redditPostIdFromUrl(h.url) : null;
      out.push({
        platform,
        externalId: redditId || `${platform.toLowerCase()}_${Buffer.from(h.url).toString('base64').slice(0, 20)}`,
        content: title,
        url: h.url,
        author: '',
        time: 'recent',
        createdAt: Date.now(),
        matchScore: looksLikeQuestion ? 72 : 55,
        isWebDiscovery: !redditId,
        postType: looksLikeQuestion ? 'question' : 'text',
        stats: { likes: estEngagement, comments: looksLikeQuestion ? 3 : 0, views: 0 },
        matchedKeyword: keyword,
        snippet: h.snippet || '',
      });
    });
  };

  const quick = process.env.SI_TEST_QUICK === '1';

  async function searchQuery(q) {
    merge(await searchViaSerp(q, keys, limit));
    if (out.length >= limit || quick) return;
    merge(await searchViaBrave(q, hostPattern, limit));
    if (out.length >= limit) return;
    merge(await searchViaMojeek(q, hostPattern, limit));
  }

  for (const q of queries) {
    if (out.length >= limit) break;
    await searchQuery(q);
  }

  return out.slice(0, limit);
}

async function discoverRedditPosts(keyword, keys, limit = 5) {
  const out = await discoverSitePosts({
    site: 'reddit.com',
    hostPattern: 'reddit\\.com',
    keyword,
    keys,
    limit,
    platform: 'Reddit',
  });
  if (out.length >= limit) return out.slice(0, limit);

  const seen = new Set(out.map((p) => p.url));
  const rssHits = await searchViaRedditRss(keyword, limit - out.length);
  rssHits.forEach((h) => {
    if (out.length >= limit || !h.url || seen.has(h.url)) return;
    seen.add(h.url);
    const title = h.title || titleFromUrl(h.url);
    const looksLikeQuestion = title.includes('?')
      || /\b(how|what|why|recommend|best|help|tool)\b/i.test(title);
    out.push(redditPostFromHit(h, keyword, looksLikeQuestion));
  });
  return out.slice(0, limit);
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

/** All 14 blueprint platforms with web-search discovery targets */
const PLATFORM_SITES = [
  { platform: 'Facebook', site: 'facebook.com', hostPattern: 'facebook\\.com' },
  { platform: 'Instagram', site: 'instagram.com', hostPattern: 'instagram\\.com' },
  { platform: 'YouTube', site: 'youtube.com', hostPattern: '(?:youtube\\.com|youtu\\.be)' },
  { platform: 'TikTok', site: 'tiktok.com', hostPattern: 'tiktok\\.com' },
  { platform: 'Twitter', site: 'twitter.com', hostPattern: '(?:twitter|x)\\.com' },
  { platform: 'Pinterest', site: 'pinterest.com', hostPattern: 'pinterest\\.com' },
  { platform: 'Snapchat', site: 'snapchat.com', hostPattern: 'snapchat\\.com' },
  { platform: 'Threads', site: 'threads.net', hostPattern: 'threads\\.net' },
  { platform: 'Twitch', site: 'twitch.tv', hostPattern: 'twitch\\.tv' },
  { platform: 'LinkedIn', site: 'linkedin.com', hostPattern: 'linkedin\\.com' },
  { platform: 'Reddit', site: 'reddit.com', hostPattern: 'reddit\\.com' },
  { platform: 'Quora', site: 'quora.com', hostPattern: 'quora\\.com' },
  { platform: 'Discord', site: 'discord.com', hostPattern: 'discord\\.com' },
  { platform: 'Telegram', site: 't.me', hostPattern: 't\\.me' },
];

function discoverPlatformPosts(platform, keyword, keys, limit = 4) {
  const cfg = PLATFORM_SITES.find((p) => p.platform === platform);
  if (!cfg) return Promise.resolve([]);
  if (platform === 'Reddit') return discoverRedditPosts(keyword, keys, limit);
  if (platform === 'Quora') return discoverQuoraPosts(keyword, keys, limit);
  if (platform === 'Twitter') return discoverTwitterPosts(keyword, keys, limit);
  return discoverSitePosts({ ...cfg, keyword, keys, limit, platform: cfg.platform });
}

async function discoverAllPlatformPosts({ keyword, keys, allowedPlatforms, limitPerPlatform = 3, platformFilter = null }) {
  const { normalizePlatform } = require('./platformCatalog');
  const allowed = new Set(
    (allowedPlatforms && allowedPlatforms.size > 0)
      ? Array.from(allowedPlatforms).map(normalizePlatform)
      : PLATFORM_SITES.map((p) => p.platform),
  );

  const targets = PLATFORM_SITES.filter((cfg) => {
    if (platformFilter && normalizePlatform(platformFilter) !== 'All' && normalizePlatform(platformFilter) !== cfg.platform) {
      return false;
    }
    return allowed.has(cfg.platform);
  });

  const batchSize = process.env.SI_TEST_QUICK ? 6 : 4;
  const out = [];
  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);
    const chunks = await Promise.all(
      batch.map((cfg) => discoverPlatformPosts(cfg.platform, keyword, keys, limitPerPlatform)),
    );
    chunks.forEach((posts) => out.push(...posts));
  }
  return out;
}

module.exports = {
  PLATFORM_SITES,
  discoverRedditPosts,
  discoverQuoraPosts,
  discoverTwitterPosts,
  discoverPlatformPosts,
  discoverAllPlatformPosts,
  searchViaBrave,
  searchViaDuckDuckGo,
  searchViaMojeek,
  searchViaRedditRss,
  searchViaSerp,
};