/**
 * Discover RSS feeds and per-category feeds from any website.
 * Supports native RSS/Atom links, common feed paths, WordPress categories, and page scraping fallback.
 */
const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const COMMON_FEED_PATHS = ['/feed', '/rss', '/rss.xml', '/feed.xml', '/atom.xml', '/index.xml', '/feeds/posts/default'];

const CATEGORY_PATH_PATTERNS = [
  /\/category\/([^/?#]+)/i,
  /\/categories\/([^/?#]+)/i,
  /\/topics?\/([^/?#]+)/i,
  /\/section\/([^/?#]+)/i,
  /\/tag\/([^/?#]+)/i,
];

function loadJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJson(store, key, data) {
  store.setItem(key, JSON.stringify(data));
}

function normalizeSiteUrl(input) {
  let url = String(input || '').trim();
  if (!url) throw new Error('Site URL is required');
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

function slugToLabel(slug) {
  return decodeURIComponent(String(slug || ''))
    .replace(/[-_+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function uniqueBy(arr, keyFn) {
  const seen = new Set();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchHtml(url, timeout = 15000) {
  const res = await axios.get(url, {
    timeout,
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml' },
    maxRedirects: 5,
    validateStatus: (s) => s < 500,
  });
  if (res.status >= 400) throw new Error(`HTTP ${res.status} for ${url}`);
  return String(res.data || '');
}

function extractRssLinksFromHtml(html, baseUrl) {
  const links = [];
  const re = /<link[^>]+rel=["']alternate["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const type = (tag.match(/type=["']([^"']+)["']/i) || [])[1] || '';
    if (!/rss|atom|xml/i.test(type)) continue;
    const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1];
    if (!href) continue;
    const title = (tag.match(/title=["']([^"']+)["']/i) || [])[1] || 'Site Feed';
    try {
      links.push({ url: new URL(href, baseUrl).href, title: title.trim(), sourceType: 'native' });
    } catch (e) { /* skip bad url */ }
  }
  return links;
}

function extractNavCategories(html, baseUrl) {
  const categories = [];
  const hrefRe = /href=["']([^"']+)["']/gi;
  let m;
  while ((m = hrefRe.exec(html)) !== null) {
    let href = m[1];
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) continue;
    try {
      const full = new URL(href, baseUrl).href;
      if (!full.startsWith(baseUrl)) continue;
      for (const pat of CATEGORY_PATH_PATTERNS) {
        const match = full.match(pat);
        if (match) {
          const slug = match[1];
          categories.push({
            slug,
            label: slugToLabel(slug),
            pageUrl: full.split('?')[0].split('#')[0],
          });
          break;
        }
      }
    } catch (e) { /* skip */ }
  }
  return uniqueBy(categories, (c) => c.slug.toLowerCase());
}

async function tryWordPressCategories(baseUrl) {
  try {
    const res = await axios.get(`${baseUrl}/wp-json/wp/v2/categories`, {
      timeout: 10000,
      headers: { 'User-Agent': UA },
      params: { per_page: 50 },
    });
    return (res.data || [])
      .filter((c) => c.count > 0 && c.slug)
      .map((c) => ({
        slug: c.slug,
        label: c.name || slugToLabel(c.slug),
        pageUrl: c.link || `${baseUrl}/category/${c.slug}/`,
        wpId: c.id,
      }));
  } catch (e) {
    return [];
  }
}

async function validateFeedUrl(url) {
  try {
    const res = await axios.get(url, { timeout: 12000, headers: { 'User-Agent': UA } });
    const xml = String(res.data || '');
    const hasItems = /<item[\s>]/i.test(xml) || /<entry[\s>]/i.test(xml);
    return hasItems;
  } catch (e) {
    return false;
  }
}

async function discoverFeedCandidates(baseUrl, html) {
  const candidates = [];
  extractRssLinksFromHtml(html, baseUrl).forEach((l) => candidates.push(l));

  for (const path of COMMON_FEED_PATHS) {
    try {
      const url = new URL(path, baseUrl).href;
      if (candidates.some((c) => c.url === url)) continue;
      if (await validateFeedUrl(url)) {
        candidates.push({ url, title: 'Main Feed', sourceType: 'native' });
        break;
      }
    } catch (e) { /* skip */ }
  }
  return uniqueBy(candidates, (c) => c.url);
}

async function categoryFeedCandidates(category, baseUrl) {
  const urls = [
    `${category.pageUrl.replace(/\/$/, '')}/feed`,
    `${category.pageUrl.replace(/\/$/, '')}/rss`,
    `${baseUrl}/category/${category.slug}/feed`,
    `${baseUrl}/?cat=${category.wpId || ''}`,
    `${baseUrl}/feed?category=${category.slug}`,
  ].filter(Boolean);

  for (const url of urls) {
    if (await validateFeedUrl(url)) {
      return { url, sourceType: 'native' };
    }
  }
  return { url: category.pageUrl, sourceType: 'scrape' };
}

async function scrapeCategoryItems(pageUrl, limit = 10) {
  const html = await fetchHtml(pageUrl);
  const base = new URL(pageUrl).origin;
  const items = [];
  const seen = new Set();
  const articleRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = articleRe.exec(html)) !== null && items.length < limit * 3) {
    let href = m[1];
    if (!href || href.startsWith('#') || /\/(tag|author|page|login|signup|cart|checkout)\//i.test(href)) continue;
    try {
      const link = new URL(href, pageUrl).href;
      if (!link.startsWith(base)) continue;
      if (seen.has(link)) continue;
      const title = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!title || title.length < 12 || title.length > 200) continue;
      if (/^(home|about|contact|privacy|terms|read more|more)$/i.test(title)) continue;
      seen.add(link);
      items.push({
        title,
        link,
        description: title,
        guid: link,
      });
    } catch (e) { /* skip */ }
  }
  return items.slice(0, limit);
}

async function parseFeedItems(feed, limit = 5) {
  if (feed.sourceType === 'scrape') {
    return scrapeCategoryItems(feed.rssUrl || feed.pageUrl, limit);
  }
  const { parseRssItems } = require('./contentAutomation');
  return parseRssItems(feed.rssUrl, limit);
}

async function discoverSiteFeeds(siteUrlInput) {
  const baseUrl = normalizeSiteUrl(siteUrlInput);
  const siteName = new URL(baseUrl).hostname.replace(/^www\./, '');
  const html = await fetchHtml(baseUrl);

  const mainFeeds = await discoverFeedCandidates(baseUrl, html);
  let categories = extractNavCategories(html, baseUrl);
  if (!categories.length) {
    categories = await tryWordPressCategories(baseUrl);
  }

  const feeds = [];

  if (mainFeeds.length) {
    const main = mainFeeds[0];
    feeds.push({
      id: `feed_main_${Date.now()}`,
      category: 'All',
      categorySlug: 'all',
      label: main.title || 'Main Site Feed',
      rssUrl: main.url,
      pageUrl: baseUrl,
      sourceType: 'native',
      enabled: true,
      itemCount: null,
    });
  }

  for (const cat of categories.slice(0, 25)) {
    const candidate = await categoryFeedCandidates(cat, baseUrl);
    let itemCount = 0;
    try {
      const items = await parseFeedItems({ ...candidate, rssUrl: candidate.url }, 3);
      itemCount = items.length;
      if (!itemCount && candidate.sourceType === 'scrape') continue;
    } catch (e) {
      if (candidate.sourceType === 'native') continue;
    }

    feeds.push({
      id: `feed_${cat.slug}_${Date.now()}`,
      category: cat.label,
      categorySlug: cat.slug,
      label: `${cat.label} Feed`,
      rssUrl: candidate.url,
      pageUrl: cat.pageUrl,
      sourceType: candidate.sourceType,
      enabled: true,
      itemCount,
    });
  }

  if (!feeds.length) {
    feeds.push({
      id: `feed_scrape_${Date.now()}`,
      category: 'All',
      categorySlug: 'all',
      label: 'Scraped Site Articles',
      rssUrl: baseUrl,
      pageUrl: baseUrl,
      sourceType: 'scrape',
      enabled: true,
      itemCount: null,
    });
  }

  return {
    siteUrl: baseUrl,
    siteName,
    discoveredAt: new Date().toISOString(),
    feeds,
    stats: {
      nativeFeeds: feeds.filter((f) => f.sourceType === 'native').length,
      scrapedFeeds: feeds.filter((f) => f.sourceType === 'scrape').length,
      categories: categories.length,
    },
  };
}

const STORAGE_KEY = 'siteRssSources';

function getSiteRssSources(store) {
  return loadJson(store, STORAGE_KEY, []);
}

function saveSiteRssSources(store, sources) {
  saveJson(store, STORAGE_KEY, sources);
}

function upsertSiteSource(store, discovery, targetMappingsByFeedId = {}) {
  const sources = getSiteRssSources(store);
  const existingIdx = sources.findIndex((s) => s.siteUrl === discovery.siteUrl);
  const entry = {
    id: existingIdx >= 0 ? sources[existingIdx].id : `src_${Date.now()}`,
    siteUrl: discovery.siteUrl,
    siteName: discovery.siteName,
    discoveredAt: discovery.discoveredAt,
    enabled: true,
    feeds: discovery.feeds.map((f) => ({
      ...f,
      targetMappings: targetMappingsByFeedId[f.id] || [],
    })),
  };

  if (existingIdx >= 0) {
    const prev = sources[existingIdx];
    entry.feeds = entry.feeds.map((f) => {
      const old = (prev.feeds || []).find((x) => x.categorySlug === f.categorySlug);
      return old ? { ...f, targetMappings: old.targetMappings || [], enabled: old.enabled !== false } : f;
    });
    sources[existingIdx] = entry;
  } else {
    sources.push(entry);
  }
  saveSiteRssSources(store, sources);
  return entry;
}

function updateFeedMappings(store, sourceId, feedId, targetMappings) {
  const sources = getSiteRssSources(store);
  const src = sources.find((s) => s.id === sourceId);
  if (!src) return null;
  const feed = (src.feeds || []).find((f) => f.id === feedId);
  if (!feed) return null;
  feed.targetMappings = targetMappings || [];
  saveSiteRssSources(store, sources);
  return feed;
}

module.exports = {
  STORAGE_KEY,
  normalizeSiteUrl,
  discoverSiteFeeds,
  parseFeedItems,
  scrapeCategoryItems,
  getSiteRssSources,
  saveSiteRssSources,
  upsertSiteSource,
  updateFeedMappings,
};