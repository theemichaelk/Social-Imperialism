/**
 * Live social trend scraping — X explore, TikTok Creative Center, LinkedIn News.
 * Uses persistent native browser profiles (cookies saved between sessions).
 * Never stores passwords — TikTok login is manual in a visible browser window.
 */
const path = require('path');
const fs = require('fs');
const nativeBrowser = require('./nativeBrowserLauncher');

const TIKTOK_TRENDS_URL = 'https://ads.tiktok.com/creative/creativeCenter/trends/hashtag?locale=en&deviceType=pc&region=US&period=7';
const TIKTOK_LOGIN_URL = 'https://ads.tiktok.com/';
const X_TRENDING_URL = 'https://x.com/explore/tabs/trending';
const X_NEWS_URL = 'https://x.com/explore/tabs/news';
const LINKEDIN_NEWS_URL = 'https://www.linkedin.com/news/';

const PROFILE_KEYS = {
  x: 'x-trends',
  tiktok: 'tiktok-creative-center',
  linkedin: 'linkedin-news',
};

const platformCache = new Map();

function hourCacheKey() {
  const d = new Date();
  return `${d.toISOString().slice(0, 13)}`;
}

function getCached(platform) {
  const entry = platformCache.get(platform);
  if (entry && entry.hour === hourCacheKey() && entry.data?.length) return entry.data;
  return null;
}

function setCached(platform, data) {
  platformCache.set(platform, { hour: hourCacheKey(), data });
}

function normalizeTrendItem(raw, platform, source) {
  const topic = String(raw.topic || '').trim();
  if (!topic || topic.length < 2) return null;
  const isHash = topic.startsWith('#') || raw.type === 'hashtag';
  return {
    topic: isHash && !topic.startsWith('#') ? `#${topic.replace(/^#/, '')}` : topic,
    type: isHash ? 'hashtag' : 'topic',
    platform,
    momentum: raw.momentum || 'Live',
    searchVolume: raw.searchVolume || source || 'Live',
    url: raw.url || null,
    source: source || 'browser',
  };
}

async function scrapeWithBrowser(store, userDataPath, profileKey, urls, scrapeScript, { headless = true, waitMs = 5000 } = {}) {
  let session;
  try {
    session = await nativeBrowser.launchNativeBrowser({
      store,
      userDataPath,
      profileKey,
      headless,
      reuseActive: !headless,
    });
    const page = session.page;
    const allRaw = [];

    for (const url of urls) {
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 90000 });
        if (waitMs) await new Promise((r) => setTimeout(r, waitMs));
        const chunk = await page.evaluate(scrapeScript);
        if (Array.isArray(chunk)) allRaw.push(...chunk);
      } catch (e) {
        console.warn(`Trend scrape ${url}:`, e.message);
      }
    }

    return allRaw;
  } finally {
    if (session?.close && headless) {
      try { await session.close(); } catch (e) { /* ignore */ }
    }
  }
}

const SCRAPE_X_SCRIPT = `(() => {
  const out = [];
  const seen = new Set();
  const add = (text, type, url) => {
    let t = String(text || '').replace(/\\s+/g, ' ').trim();
    if (!t || t.length < 2 || t.length > 72) return;
    const low = t.toLowerCase();
    if (seen.has(low) || /^(home|explore|trending|news|log in|sign up)$/i.test(t)) return;
    seen.add(low);
    out.push({ topic: t, type: type || (t.startsWith('#') ? 'hashtag' : 'topic'), url: url || null });
  };
  document.querySelectorAll('a[href*="search?q="]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const m = href.match(/[?&]q=([^&]+)/);
    if (!m) return;
    let q = decodeURIComponent(m[1].replace(/\\+/g, ' '));
    if (q.startsWith('%23')) q = '#' + q.slice(3);
    add(q, q.includes('#') ? 'hashtag' : 'topic', href.startsWith('http') ? href : 'https://x.com' + href);
  });
  document.querySelectorAll('[data-testid="trend"] span, [data-testid="cellInnerDiv"] span').forEach((el) => {
    const t = el.innerText?.trim();
    if (t && t.length < 60 && !/^\\d+[\\d.,]*[KMB]?\\s*(posts?|posts?\\b)/i.test(t)) {
      add(t, t.startsWith('#') ? 'hashtag' : 'topic', null);
    }
  });
  return out.slice(0, 8);
})()`;

const SCRAPE_LINKEDIN_NEWS_SCRIPT = `(() => {
  const out = [];
  const seen = new Set();
  const add = (text, url) => {
    const t = String(text || '').replace(/\\s+/g, ' ').trim();
    if (!t || t.length < 8 || t.length > 100 || seen.has(t.toLowerCase())) return;
    if (/^(linkedin|news|top stories|see all)$/i.test(t)) return;
    seen.add(t.toLowerCase());
    out.push({ topic: t, type: 'topic', url: url || null });
  };
  document.querySelectorAll('a[href*="/news/story/"], a[href*="/pulse/"], h3, h2, [class*="headline"]').forEach((el) => {
    const t = el.innerText?.trim();
    const href = el.href || el.closest('a')?.href;
    if (t) add(t, href || null);
  });
  document.querySelectorAll('article a, .news-story a').forEach((a) => {
    add(a.innerText?.trim(), a.href);
  });
  return out.slice(0, 8);
})()`;

const SCRAPE_TIKTOK_HASHTAGS_SCRIPT = `(() => {
  const out = [];
  const seen = new Set();
  const add = (text, url) => {
    let t = String(text || '').trim();
    if (!t) return;
    if (!t.startsWith('#')) t = '#' + t.replace(/^#/, '');
    if (t.length < 3 || t.length > 40 || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    out.push({ topic: t, type: 'hashtag', url: url || null });
  };
  const isLogin = /log\\s*in|sign\\s*up|login/i.test(document.body?.innerText?.slice(0, 2000) || '');
  if (isLogin) return { needsLogin: true, items: [] };
  document.querySelectorAll('table tbody tr td:first-child, [class*="hashtag"] a, [class*="HashTag"] span').forEach((el) => {
    const t = el.innerText?.trim();
    const href = el.closest('a')?.href;
    if (t && !/^rank$/i.test(t)) add(t.replace(/^#/, ''), href);
  });
  document.querySelectorAll('a[href*="hashtag"]').forEach((a) => {
    const m = (a.getAttribute('href') || '').match(/hashtag\\/([^/?]+)/i);
    if (m) add(m[1], a.href);
  });
  return { needsLogin: false, items: out.slice(0, 8) };
})()`;

async function fetchXTrendsLive(store, userDataPath, limit = 4) {
  const cached = getCached('X (Twitter)');
  if (cached) return cached.slice(0, limit);

  try {
    const raw = await scrapeWithBrowser(
      store,
      userDataPath,
      PROFILE_KEYS.x,
      [X_TRENDING_URL, X_NEWS_URL],
      SCRAPE_X_SCRIPT,
      { headless: true, waitMs: 6000 },
    );
    const items = raw
      .map((r) => normalizeTrendItem(r, 'X (Twitter)', 'x_explore'))
      .filter(Boolean);
    const deduped = dedupeTrends(items).slice(0, limit);
    if (deduped.length) setCached('X (Twitter)', deduped);
    return deduped;
  } catch (e) {
    console.warn('X live trends:', e.message);
    return [];
  }
}

async function fetchLinkedInNewsLive(store, userDataPath, limit = 4) {
  const cached = getCached('LinkedIn');
  if (cached) return cached.slice(0, limit);

  try {
    const raw = await scrapeWithBrowser(
      store,
      userDataPath,
      PROFILE_KEYS.linkedin,
      [LINKEDIN_NEWS_URL],
      SCRAPE_LINKEDIN_NEWS_SCRIPT,
      { headless: true, waitMs: 7000 },
    );
    const items = raw
      .map((r) => normalizeTrendItem(r, 'LinkedIn', 'linkedin_news'))
      .filter(Boolean);
    const deduped = dedupeTrends(items).slice(0, limit);
    if (deduped.length) setCached('LinkedIn', deduped);
    return deduped;
  } catch (e) {
    console.warn('LinkedIn news trends:', e.message);
    return [];
  }
}

async function fetchTikTokTrendsLive(store, userDataPath, limit = 4) {
  const cached = getCached('TikTok');
  if (cached) return cached.slice(0, limit);

  let session;
  try {
    session = await nativeBrowser.launchNativeBrowser({
      store,
      userDataPath,
      profileKey: PROFILE_KEYS.tiktok,
      headless: true,
      reuseActive: true,
    });
    await session.page.goto(TIKTOK_TRENDS_URL, { waitUntil: 'load', timeout: 120000 });
    await new Promise((r) => setTimeout(r, 8000));
    const result = await session.page.evaluate(SCRAPE_TIKTOK_HASHTAGS_SCRIPT);

    if (result?.needsLogin) {
      return { items: [], needsLogin: true };
    }

    const items = (result?.items || result || [])
      .map((r) => normalizeTrendItem(r, 'TikTok', 'tiktok_creative_center'))
      .filter(Boolean);
    const deduped = dedupeTrends(items).slice(0, limit);
    if (deduped.length) setCached('TikTok', deduped);
    return { items: deduped, needsLogin: false };
  } catch (e) {
    console.warn('TikTok live trends:', e.message);
    return { items: [], needsLogin: false, error: e.message };
  } finally {
    if (session?.close) {
      try { await session.close(); } catch (err) { /* ignore */ }
    }
  }
}

async function openTikTokTrendsLogin(store, userDataPath) {
  try {
    const result = await nativeBrowser.openUrlInNativeBrowser(
      store,
      userDataPath,
      TIKTOK_LOGIN_URL,
      { profileKey: PROFILE_KEYS.tiktok, newTab: false },
    );
    return {
      success: true,
      ...result,
      url: TIKTOK_LOGIN_URL,
      message: 'Browser opened — log in to TikTok Ads manually. Cookies are saved in the tiktok-creative-center profile. Close the browser when done, then refresh Daily Social Trends.',
      profileKey: PROFILE_KEYS.tiktok,
      trendsUrl: TIKTOK_TRENDS_URL,
    };
  } catch (e) {
    // Cloud/SaaS hosts often cannot spawn a local GUI browser — return URL for client-side open.
    return {
      success: false,
      url: TIKTOK_LOGIN_URL,
      trendsUrl: TIKTOK_TRENDS_URL,
      profileKey: PROFILE_KEYS.tiktok,
      message: `Could not launch a local browser (${e.message || 'unavailable'}). Open ${TIKTOK_LOGIN_URL}, log in, then use the desktop app for cookie-backed TikTok Creative Center scrapes — or rely on SerpAPI/web discovery fallbacks.`,
      error: e.message || String(e),
    };
  }
}

function dedupeTrends(items) {
  const seen = new Set();
  return items.filter((it) => {
    const k = `${it.platform}:${it.topic.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function clearSocialTrendsCache() {
  platformCache.clear();
}

module.exports = {
  fetchXTrendsLive,
  fetchLinkedInNewsLive,
  fetchTikTokTrendsLive,
  openTikTokTrendsLogin,
  clearSocialTrendsCache,
  PROFILE_KEYS,
  TIKTOK_TRENDS_URL,
};