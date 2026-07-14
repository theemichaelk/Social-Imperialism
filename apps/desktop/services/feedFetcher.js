const axios = require('axios');
const { decodeHtmlEntities } = require('../../../packages/core/src/textUtils');
const twitter = require('./platforms/twitter');
const reddit = require('./platforms/reddit');
const quora = require('./platforms/quora');
const { hasTwitterKeys } = require('./keys');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PLATFORM_NORMALIZE = {
  'Twitter / X': 'Twitter',
  X: 'Twitter',
};

function normalizePlatform(p) {
  return PLATFORM_NORMALIZE[p] || p;
}

function platformAllowed(platform, filters, allowedPlatforms) {
  const normalized = normalizePlatform(platform);
  if (filters?.platform && filters.platform !== 'All') {
    return normalizePlatform(filters.platform) === normalized;
  }
  if (allowedPlatforms && allowedPlatforms.size > 0) {
    return Array.from(allowedPlatforms).some((p) => normalizePlatform(p) === normalized);
  }
  return true;
}

function normalizePostStats(post) {
  if (post.stats) return post;
  const m = post.public_metrics || {};
  return {
    ...post,
    stats: {
      likes: post.ups ?? m.like_count ?? 0,
      comments: post.num_comments ?? m.reply_count ?? 0,
      views: m.impression_count ?? 0,
    },
  };
}

function sortPosts(posts, sort) {
  if (!sort || sort === 'relevance') return posts;
  const copy = [...posts];
  if (sort === 'engagement') {
    return copy.sort((a, b) => {
      const ae = (a.stats?.likes || 0) + (a.stats?.comments || 0);
      const be = (b.stats?.likes || 0) + (b.stats?.comments || 0);
      return be - ae;
    });
  }
  if (sort === 'recent') {
    return copy.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  return copy;
}

async function fetchRedditHotFeed(limit = 15, matchedKeyword = 'trending') {
  try {
    const res = await axios.get('https://www.reddit.com/hot.json', {
      params: { limit: Math.min(limit, 25) },
      headers: { 'User-Agent': UA },
      timeout: 15000,
    });

    return (res.data?.data?.children || []).slice(0, limit).map((child) => {
      const post = child.data;
      return {
        platform: 'Reddit',
        author: `u/${post.author}`,
        time: new Date(post.created_utc * 1000).toLocaleString(),
        createdAt: post.created_utc * 1000,
        matchScore: Math.min(99, 60 + Math.floor((post.ups || 0) / 10)),
        matchedKeyword,
        content: post.title + (post.selftext ? `\n\n${post.selftext.substring(0, 300)}` : ''),
        externalId: post.id,
        url: `https://reddit.com${post.permalink}`,
        subreddit: post.subreddit_name_prefixed,
        ups: post.ups || 0,
        num_comments: post.num_comments || 0,
        stats: {
          likes: post.ups || 0,
          comments: post.num_comments || 0,
          views: 0,
        },
        isTrendingFallback: true,
      };
    });
  } catch (e) {
    console.error('Reddit hot feed error:', e.message);
    return [];
  }
}

async function fetchRealFeed({ keywords, filters, keys, allowedPlatforms }) {
  const posts = [];
  const queryList = (Array.isArray(keywords) ? keywords : []).map((k) => String(k).trim()).filter(Boolean);
  const { isEngageablePost } = require('./postIdUtils');
  const quick = filters?.quick === true || filters?.light === true;

  if (platformAllowed('Reddit', filters, allowedPlatforms)) {
    const hotSeed = await fetchRedditHotFeed(quick ? 8 : 12, queryList[0] || 'trending');
    posts.push(...hotSeed);
  }

  const keywordLimit = quick ? 2 : 5;
  for (const keyword of queryList.slice(0, keywordLimit)) {
    if (platformAllowed('Reddit', filters, allowedPlatforms)) {
      const rdPosts = await reddit.searchPosts(keyword, keys, 5);
      posts.push(...rdPosts);
    }

    if (hasTwitterKeys(keys) && platformAllowed('Twitter', filters, allowedPlatforms)) {
      const twPosts = await twitter.searchPosts(keyword, keys, 5);
      posts.push(...twPosts);
    }

    if (platformAllowed('Quora', filters, allowedPlatforms)) {
      const qPosts = await quora.searchPosts(keyword, keys, 5);
      posts.push(...qPosts);
    }

    if (!process.env.SI_TEST_QUICK && !quick) {
      const { discoverAllPlatformPosts } = require('./webDiscovery');
      const webPosts = await discoverAllPlatformPosts({
        keyword,
        keys,
        allowedPlatforms,
        limitPerPlatform: 2,
        platformFilter: filters?.platform,
      });
      posts.push(...webPosts.map(normalizePostStats));
    }
  }

  const seen = new Set();
  const deduped = posts.filter((p) => {
    const key = `${p.platform}:${p.externalId || p.content?.substring(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const minDesired = process.env.SI_TEST_QUICK ? 8 : 5;
  if (deduped.length < minDesired && platformAllowed('Reddit', filters, allowedPlatforms)) {
    const fallbackLabel = queryList[0] || 'trending';
    const hotPosts = await fetchRedditHotFeed(15, fallbackLabel);
    hotPosts.forEach((p) => {
      const key = `${p.platform}:${p.externalId || p.content?.substring(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(p);
      }
    });
  }

  if (deduped.length < minDesired && keys.newsApiKey) {
    const newsLimit = process.env.SI_TEST_QUICK ? 8 : 8;
    const newsPosts = await fetchNewsAsPosts(keys, queryList[0] || 'marketing', newsLimit);
    newsPosts.forEach((p) => {
      const key = `${p.platform}:${p.externalId || p.url || p.content?.substring(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(normalizePostStats(p));
      }
    });
  }

  if (deduped.length < minDesired && queryList[0]) {
    const { discoverRedditPosts, discoverQuoraPosts, discoverTwitterPosts } = require('./webDiscovery');
    const primary = queryList[0];
    const quick = process.env.SI_TEST_QUICK === '1';
    const webReddit = platformAllowed('Reddit', filters, allowedPlatforms)
      ? await discoverRedditPosts(primary, keys, quick ? 5 : 8) : [];
    const webQuora = !quick && platformAllowed('Quora', filters, allowedPlatforms)
      ? await discoverQuoraPosts(primary, keys, 5) : [];
    const webTwitter = !quick && platformAllowed('Twitter', filters, allowedPlatforms)
      ? await discoverTwitterPosts(primary, keys, 5) : [];
    [...webReddit, ...webQuora, ...webTwitter].forEach((p) => {
      const key = `${p.platform}:${p.externalId || p.url || p.content?.substring(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(normalizePostStats(p));
      }
    });
  }

  if (deduped.length < minDesired && keys.newsApiKey) {
    const categories = ['technology', 'business', 'general'];
    for (const category of categories) {
      if (deduped.length >= minDesired) break;
      const extra = await fetchTopHeadlinesAsPosts(keys, minDesired - deduped.length, category);
      extra.forEach((p) => {
        const key = `${p.platform}:${p.externalId || p.url || p.content?.substring(0, 50)}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(normalizePostStats(p));
        }
      });
    }
  }

  const sorted = sortPosts(deduped.map(normalizePostStats), filters?.sort);
  return sorted.sort((a, b) => {
    const ae = isEngageablePost(a) ? 1 : 0;
    const be = isEngageablePost(b) ? 1 : 0;
    return be - ae;
  });
}

async function fetchRedditHot(limit = 6) {
  const feedPosts = await fetchRedditHotFeed(limit, 'trending');
  return feedPosts.map((p) => {
    const engagement = (p.stats?.likes || 0) + (p.stats?.comments || 0) * 3;
    return {
      topic: (p.content || '').substring(0, 100),
      searchVolume: engagement,
      momentum: (p.stats?.likes || 0) > 1000 ? `+${Math.min(99, Math.round((p.stats.likes || 0) / 100))}%` : 'Trending',
      url: p.url,
      platform: 'Reddit',
      subreddit: p.subreddit,
    };
  });
}

async function fetchSerpTrending(keys, limit = 6) {
  if (!keys.serpApiKey) return [];
  try {
    const res = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_trends_trending_now',
        geo: 'US',
        api_key: keys.serpApiKey,
      },
      timeout: 15000,
    });

    const trends = res.data?.trending_searches || res.data?.realtime_searches || [];
    return trends.slice(0, limit).map((t) => ({
      topic: t.query || t.title || t.topic?.title || 'Trend',
      searchVolume: t.search_volume || t.traffic || t.formattedTraffic || 0,
      momentum: t.increase_percentage ? `+${t.increase_percentage}%` : 'Trending now',
      url: t.link || t.serpapi_link || null,
      platform: 'Google Trends',
    }));
  } catch (e) {
    console.error('SerpAPI trends error:', e.message);
    return [];
  }
}

async function fetchTopHeadlinesAsPosts(keys, limit = 8, category = 'technology') {
  const newsKey = keys.newsApiKey || process.env.NEWS_API_KEY;
  if (!newsKey || limit <= 0) return [];
  try {
    const res = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: { category, language: 'en', pageSize: limit, apiKey: newsKey },
      timeout: 15000,
    });
    return (res.data?.articles || []).slice(0, limit).map((a, i) => ({
      platform: 'News',
      author: a.source?.name || 'News',
      time: 'recent',
      createdAt: Date.now() - i * 60000,
      matchScore: 45,
      matchedKeyword: category,
      content: decodeHtmlEntities(a.title) || 'Trending headline',
      externalId: `news_${category}_${Buffer.from(a.url || a.title || String(i)).toString('base64').slice(0, 16)}`,
      url: a.url,
      stats: { likes: 0, comments: 0, views: 0 },
      isNewsFallback: true,
    }));
  } catch (e) {
    console.warn(`NewsAPI ${category} headlines:`, e.message);
    return [];
  }
}

async function fetchNewsAsPosts(keys, keyword = 'technology', limit = 8) {
  const newsKey = keys.newsApiKey || process.env.NEWS_API_KEY;
  if (!newsKey) return [];
  try {
    const res = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: keyword,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: limit,
        apiKey: newsKey,
      },
      timeout: 15000,
    });
    return (res.data?.articles || []).slice(0, limit).map((a, i) => ({
      platform: 'News',
      author: a.source?.name || 'News',
      time: a.publishedAt ? new Date(a.publishedAt).toLocaleString() : 'recent',
      createdAt: a.publishedAt ? new Date(a.publishedAt).getTime() : Date.now() - i * 60000,
      matchScore: 50,
      matchedKeyword: keyword,
      content: decodeHtmlEntities(a.title) + (a.description ? `\n\n${decodeHtmlEntities(a.description).substring(0, 200)}` : ''),
      externalId: `news_${Buffer.from(a.url || a.title || String(i)).toString('base64').slice(0, 16)}`,
      url: a.url,
      stats: { likes: 0, comments: 0, views: 0 },
      isNewsFallback: true,
    }));
  } catch (e) {
    try {
      const res = await axios.get('https://newsapi.org/v2/top-headlines', {
        params: { category: 'technology', language: 'en', pageSize: limit, apiKey: newsKey },
        timeout: 15000,
      });
      return (res.data?.articles || []).slice(0, limit).map((a, i) => ({
        platform: 'News',
        author: a.source?.name || 'News',
        time: 'recent',
        createdAt: Date.now() - i * 60000,
        matchScore: 45,
        matchedKeyword: keyword,
        content: decodeHtmlEntities(a.title) || 'Trending headline',
        externalId: `news_${Buffer.from(a.url || a.title || String(i)).toString('base64').slice(0, 16)}`,
        url: a.url,
        stats: { likes: 0, comments: 0, views: 0 },
        isNewsFallback: true,
      }));
    } catch (err) {
      console.warn('NewsAPI feed fallback:', err.message);
      return [];
    }
  }
}

async function fetchRssTrending(limit = 6) {
  try {
    const res = await axios.get('https://feeds.feedburner.com/TechCrunch', { timeout: 12000 });
    const items = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(res.data)) && items.length < limit) {
      const itemXml = match[1];
      const title = decodeHtmlEntities(((itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '')
        .replace(/<!\[CDATA\[|\]\]>/g, '').trim());
      const link = ((itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '').trim();
      if (title) {
        items.push({
          topic: title.substring(0, 100),
          searchVolume: 'RSS',
          momentum: 'Tech',
          url: link,
          platform: 'TechCrunch',
        });
      }
    }
    return items;
  } catch (e) {
    console.warn('RSS trending fallback:', e.message);
    return [];
  }
}

async function fetchNewsHeadlineTrends(keys, limit = 6) {
  const newsKey = keys.newsApiKey || process.env.NEWS_API_KEY;
  if (!newsKey) return [];
  try {
    const res = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: { category: 'technology', language: 'en', pageSize: limit, apiKey: newsKey },
      timeout: 15000,
    });
    return (res.data?.articles || []).slice(0, limit).map((a) => ({
      topic: decodeHtmlEntities(a.title || 'Trending headline').substring(0, 100),
      searchVolume: 'Headline',
      momentum: 'News',
      url: a.url,
      platform: 'News',
    }));
  } catch (e) {
    console.warn('NewsAPI trending fallback:', e.message);
    return [];
  }
}

async function fetchWebTrending(keyword, limit = 6) {
  if (!keyword) return [];
  try {
    const { searchViaBrave, searchViaMojeek, searchViaDuckDuckGo } = require('./webDiscovery');
    const query = `${keyword} trending`;
    const hostPattern = '(?:reddit|quora|news)\\.com';
    let hits = await searchViaBrave(query, hostPattern, limit);
    if (!hits.length) hits = await searchViaMojeek(query, hostPattern, limit);
    if (!hits.length) hits = await searchViaDuckDuckGo(query, hostPattern, limit);
    return hits.map((h) => ({
      topic: (h.title || '').substring(0, 100),
      searchVolume: 'Web',
      momentum: 'Discovered',
      url: h.url,
      platform: 'Web',
    }));
  } catch (e) {
    console.warn('Web trending fallback:', e.message);
    return [];
  }
}

async function fetchTrendingTopics(platform, keys, seedKeywords = []) {
  const seed = (Array.isArray(seedKeywords) ? seedKeywords : []).map((k) => String(k).trim()).filter(Boolean);

  const [serpTrends, redditTrends, newsTrends, rssTrends] = await Promise.all([
    fetchSerpTrending(keys, 6),
    (platform === 'Reddit' || platform === 'All') ? fetchRedditHot(6) : Promise.resolve([]),
    fetchNewsHeadlineTrends(keys, 6),
    fetchRssTrending(6),
  ]);

  if (serpTrends.length > 0) return serpTrends;
  if (redditTrends.length > 0) return redditTrends;
  if (newsTrends.length > 0) return newsTrends;
  if (rssTrends.length > 0) return rssTrends;

  if (hasTwitterKeys(keys) && (platform === 'Twitter' || platform === 'Twitter / X' || platform === 'All')) {
    const twPosts = await twitter.searchPosts('trending OR breaking news', keys, 6);
    if (twPosts.length > 0) {
      return twPosts.map((p) => ({
        topic: (p.content || '').substring(0, 100),
        searchVolume: (p.stats?.likes || 0) + (p.stats?.comments || 0),
        momentum: 'Live',
        url: p.url,
        platform: 'Twitter',
      }));
    }
  }

  if (seed.length) {
    const webTrends = await fetchWebTrending(seed[0], 6);
    if (webTrends.length > 0) return webTrends;
    return seed.slice(0, 6).map((term) => ({
      topic: term,
      searchVolume: 'Brand keyword',
      momentum: 'Tracked',
      url: null,
      platform: 'Keywords',
    }));
  }

  return rssTrends;
}

const DAILY_SOCIAL_PLATFORMS = [
  {
    platform: 'X (Twitter)',
    hostPattern: '(?:twitter|x)\\.com',
    queries: ['site:x.com/explore trending today', 'X twitter breaking news today'],
    twitterQuery: 'trending OR (#trending -is:retweet lang:en)',
    liveSource: 'x',
    exploreUrl: 'https://x.com/explore/tabs/trending',
  },
  {
    platform: 'TikTok',
    hostPattern: 'tiktok\\.com',
    queries: ['tiktok trending hashtags US today', 'site:ads.tiktok.com creative center hashtag trends'],
    liveSource: 'tiktok',
  },
  {
    platform: 'LinkedIn',
    hostPattern: 'linkedin\\.com',
    queries: ['site:linkedin.com/news top stories today', 'linkedin news headlines today'],
    liveSource: 'linkedin',
    exploreUrl: 'https://www.linkedin.com/news/',
  },
  {
    platform: 'Instagram',
    hostPattern: 'instagram\\.com',
    queries: ['instagram trending hashtags today', 'instagram explore trending topics'],
  },
  {
    platform: 'Facebook',
    hostPattern: 'facebook\\.com',
    queries: ['facebook trending topics today', 'facebook news trending'],
  },
  {
    platform: 'YouTube',
    hostPattern: '(?:youtube\\.com|youtu\\.be)',
    queries: ['youtube trending today', 'youtube trending hashtags shorts'],
  },
];

let dailySocialTrendsCache = { hour: '', trends: [], meta: {} };

function todayCacheKey() {
  return new Date().toISOString().slice(0, 10);
}

function extractHashtags(text) {
  const raw = String(text || '');
  const tags = raw.match(/#[\w\u00C0-\u024F]+/g) || [];
  return [...new Set(tags.map((t) => t.trim()).filter((t) => t.length > 2 && t.length < 40))];
}

const GENERIC_TREND_SLUGS = new Set([
  'trending', 'trending-topics', 'trending-hashtags', 'trending-hashtags-today',
  'top-content', 'popular', 'hashtags', 'topics', 'news', 'explore',
]);

/** Curated last-resort topics when live scrape + Serp/web return nothing (never use #Trending junk). */
const PLATFORM_TREND_FALLBACKS = {
  'X (Twitter)': ['#AIMarketing', '#CreatorEconomy', '#GrowthTips'],
  TikTok: ['#CreatorTips', '#ShortFormVideo', '#SocialMediaTips'],
  LinkedIn: ['#B2BMarketing', '#Leadership', '#DigitalStrategy'],
  Instagram: ['#ContentMarketing', '#ReelsTips', '#BrandBuilding'],
  Facebook: ['#CommunityGrowth', '#SocialSelling', '#SmallBusiness'],
  YouTube: ['#YouTubeShorts', '#VideoMarketing', '#ContentCreation'],
};

const NAV_TREND_STOPWORDS = new Set([
  'home', 'trends', 'trending', 'explore', 'search', 'login', 'signup', 'notifications', 'messages', 'videos',
]);

function isNavTrendUrl(url) {
  if (!url) return false;
  return /\/(?:home|explore|tabs\/trending|login|signup|notifications|messages)(?:\/|$|\?|#)/i.test(url);
}

function isLowQualityTrendTopic(topic) {
  const t = String(topic || '').trim();
  if (!t || t.length < 3) return true;
  if (/\.com\b/i.test(t) && !t.startsWith('#')) return true;
  if (/\d{6,}/.test(t)) return true;
  const bare = t.replace(/^#/, '');
  if (NAV_TREND_STOPWORDS.has(bare.toLowerCase())) return true;
  if (/^[A-Za-z0-9_]{10,}$/.test(bare) && !/[aeiou]/i.test(bare)) return true;
  if (!t.startsWith('#') && !/\s/.test(t) && bare.length > 12) return true;
  if (/^(?:top content|trending topics|trending hashtags(?: today)?|what'?s trending|today'?s news)\b/i.test(t)) return true;
  if (/explore\s*-?\s*trending topics/i.test(t) || /top content on linkedin/i.test(t)) return true;
  if (/^posts\s*—/i.test(t) || /^the best hashtags\b/i.test(t) || /going viral on instagram/i.test(t)) return true;
  if (/popular\s*—\s*trending-hashtags/i.test(t) || /trending hashtags today$/i.test(t)) return true;
  if (!t.startsWith('#') && /^[A-Za-z0-9_]{9,}$/.test(bare)) return true;
  if (/\bpulse\s*—/i.test(t) || (t.split(' — ').length >= 2 && !t.startsWith('#'))) return true;
  if (/reels?\s*…/i.test(t) || /•\s*\d/i.test(t)) return true;
  return false;
}

function appendPlatformFallbacks(items, platform, limit) {
  const seen = new Set(items.map((i) => i.topic.toLowerCase()));
  for (const tag of PLATFORM_TREND_FALLBACKS[platform] || []) {
    if (items.length >= limit) break;
    if (seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    items.push({
      topic: tag,
      type: 'hashtag',
      platform,
      momentum: 'Today',
      searchVolume: 'Daily',
      url: null,
    });
  }
  return items.slice(0, limit);
}

function hashtagsFromUrl(url) {
  if (!url) return [];
  const tags = [];
  const re = /\/(?:tags?|hashtag|explore\/tags)\/([a-zA-Z0-9_]+)/gi;
  let m;
  while ((m = re.exec(url)) !== null) {
    const tag = `#${m[1]}`;
    if (tag.length > 2 && tag.length < 40) tags.push(tag);
  }
  return [...new Set(tags)];
}

function titleFromTrendUrl(url) {
  if (!url) return '';
  const slug = decodeURIComponent(String(url).replace(/\/$/, '').split('/').pop() || '')
    .replace(/\?.*$/, '')
    .replace(/-/g, ' ')
    .trim();
  if (!slug || slug.length < 3 || slug.length > 48) return '';
  if (GENERIC_TREND_SLUGS.has(slug.toLowerCase().replace(/\s+/g, '-'))) return '';
  return slug.replace(/\b\w/g, (c) => c.toUpperCase());
}

function cleanTrendTitle(raw, url, platform, max = 72) {
  let t = decodeHtmlEntities(String(raw || '').replace(/\s+/g, ' ').trim());
  t = t
    .replace(/^(?:www\.)?(?:instagram|linkedin|facebook|twitter|x)\.com\s*/i, '')
    .replace(new RegExp(`^${String(platform || '').replace(/[()]/g, '\\$&')}\\s*`, 'i'), '')
    .replace(/^(?:Instagram|LinkedIn|Facebook|Twitter|X)\s+(?:instagram|linkedin|facebook|twitter|x)\.com\s*(?:›|>|»|\|)\s*/i, '')
    .replace(/^(?:instagram|linkedin|facebook|twitter|x)\.com\s*(?:›|>|»|\|)\s*/i, '')
    .replace(/\s*(?:›|>|»)\s*/g, ' — ')
    .replace(/\s*[-–|]\s*(?:Quora|Reddit|Instagram|LinkedIn|Facebook|Twitter|YouTube).*$/i, '')
    .replace(/\s*•\s*[\d.,]+[KMB]?\s*reels?.*$/i, '')
    .replace(/…\s*$/, '')
    .replace(/\.\.\.\s*$/, '')
    .replace(/\s+\d{6,}\s*$/g, '')
    .trim();
  t = t.replace(/^(?:LinkedIn|Instagram|Facebook|Twitter|X)\s+/i, '').trim();

  const urlTags = hashtagsFromUrl(url);
  if (urlTags.length) return urlTags[0];

  const urlTitle = titleFromTrendUrl(url);
  if (urlTitle) return urlTitle;

  if (!t) return '';
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function topicFromText(text, url, platform, max = 72) {
  const tags = extractHashtags(text);
  if (tags.length) return tags[0];
  return cleanTrendTitle(text, url, platform, max);
}

function hitsToTrendItems(hits, platform, limit = 4) {
  const out = [];
  const seen = new Set();
  for (const hit of hits || []) {
    if (isNavTrendUrl(hit.url)) continue;
    const title = decodeHtmlEntities(hit.title || hit.topic || '');
    const urlTags = hashtagsFromUrl(hit.url);
    const titleTags = extractHashtags(title);
    const tags = [...new Set([...urlTags, ...titleTags])];
    const candidates = tags.length
      ? tags.map((tag) => ({ topic: tag, type: 'hashtag' }))
      : [{ topic: topicFromText(title, hit.url, platform), type: 'topic' }];
    for (const c of candidates) {
      const topic = String(c.topic || '').trim();
      if (isLowQualityTrendTopic(topic)) continue;
      if (seen.has(topic.toLowerCase())) continue;
      seen.add(topic.toLowerCase());
      out.push({
        topic,
        type: c.type,
        platform,
        momentum: 'Today',
        searchVolume: 'Daily',
        url: hit.url || null,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

async function searchWebTrendHits(query, hostPattern, limit = 6) {
  const { searchViaBrave, searchViaMojeek, searchViaDuckDuckGo } = require('./webDiscovery');
  let hits = await searchViaBrave(query, hostPattern, limit);
  if (!hits.length) hits = await searchViaMojeek(query, hostPattern, limit);
  if (!hits.length) hits = await searchViaDuckDuckGo(query, hostPattern, limit);
  return hits;
}

async function fetchSerpQueryTrends(keys, query, platform, limit = 4) {
  if (!keys.serpApiKey || !query) return [];
  try {
    const res = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google',
        q: query,
        api_key: keys.serpApiKey,
        num: Math.min(limit + 2, 10),
      },
      timeout: 15000,
    });
    const organic = (res.data?.organic_results || []).map((r) => ({
      title: r.title,
      url: r.link,
    }));
    const related = (res.data?.related_searches || []).map((r) => ({
      title: r.query || r.text,
      url: null,
    }));
    return hitsToTrendItems([...organic, ...related], platform, limit);
  } catch (e) {
    console.warn(`Serp daily trends (${platform}):`, e.message);
    return [];
  }
}

async function fetchLivePlatformTrends(cfg, store, userDataPath, limit = 4) {
  if (!store || !userDataPath) return [];
  try {
    const scraper = require('./socialTrendsScraper');
    if (cfg.liveSource === 'x') {
      return scraper.fetchXTrendsLive(store, userDataPath, limit);
    }
    if (cfg.liveSource === 'linkedin') {
      return scraper.fetchLinkedInNewsLive(store, userDataPath, limit);
    }
    if (cfg.liveSource === 'tiktok') {
      const res = await scraper.fetchTikTokTrendsLive(store, userDataPath, limit);
      return { items: res.items || [], needsLogin: !!res.needsLogin };
    }
  } catch (e) {
    console.warn(`Live trends ${cfg.platform}:`, e.message);
  }
  return [];
}

async function fetchPlatformDailyTrends(cfg, keys, seedKeywords, limit = 4, ctx = {}) {
  let items = [];

  if (ctx.store && ctx.userDataPath && cfg.liveSource) {
    const live = await fetchLivePlatformTrends(cfg, ctx.store, ctx.userDataPath, limit);
    if (live?.needsLogin) ctx.tiktokNeedsLogin = true;
    const liveItems = Array.isArray(live) ? live : (live?.items || []);
    if (liveItems.length) return liveItems.slice(0, limit);
  }

  if (cfg.platform === 'X (Twitter)' && cfg.twitterQuery && hasTwitterKeys(keys)) {
    try {
      const posts = await twitter.searchPosts(cfg.twitterQuery, keys, limit + 2);
      items = hitsToTrendItems(
        posts.map((p) => ({ title: p.content, url: p.url })),
        cfg.platform,
        limit,
      );
    } catch (e) {
      console.warn('Twitter daily trends:', e.message);
    }
  }

  if (items.length < limit && keys.serpApiKey) {
    for (const q of cfg.queries || []) {
      const serpItems = await fetchSerpQueryTrends(keys, q, cfg.platform, limit);
      const seen = new Set(items.map((i) => i.topic.toLowerCase()));
      for (const it of serpItems) {
        if (seen.has(it.topic.toLowerCase())) continue;
        seen.add(it.topic.toLowerCase());
        items.push(it);
        if (items.length >= limit) break;
      }
      if (items.length >= limit) break;
    }
  }

  if (items.length < limit) {
    for (const q of cfg.queries || []) {
      const hits = await searchWebTrendHits(q, cfg.hostPattern, limit + 2);
      const webItems = hitsToTrendItems(hits, cfg.platform, limit);
      const seen = new Set(items.map((i) => i.topic.toLowerCase()));
      for (const it of webItems) {
        if (seen.has(it.topic.toLowerCase())) continue;
        seen.add(it.topic.toLowerCase());
        items.push(it);
        if (items.length >= limit) break;
      }
      if (items.length >= limit) break;
    }
  }

  if (items.length < limit && seedKeywords.length) {
    const seen = new Set(items.map((i) => i.topic.toLowerCase()));
    for (const raw of seedKeywords.slice(0, 4)) {
      if (items.length >= limit) break;
      const seed = String(raw || '').trim();
      if (!seed) continue;
      const tag = seed.startsWith('#') ? seed : `#${seed.replace(/\s+/g, '')}`;
      if (tag.length < 3 || tag.length > 40 || seen.has(tag.toLowerCase())) continue;
      if (isLowQualityTrendTopic(tag)) continue;
      seen.add(tag.toLowerCase());
      items.push({
        topic: tag,
        type: 'hashtag',
        platform: cfg.platform,
        momentum: 'Brand',
        searchVolume: 'Tracked',
        url: null,
      });
    }
  }

  items = items.filter((it) => !isLowQualityTrendTopic(it.topic));
  if (items.length < limit && PLATFORM_TREND_FALLBACKS[cfg.platform]) {
    appendPlatformFallbacks(items, cfg.platform, limit);
  }

  return items.slice(0, limit);
}

async function fetchDailySocialTrends(keys, seedKeywords = [], ctx = {}) {
  const hour = new Date().toISOString().slice(0, 13);
  if (
    dailySocialTrendsCache.hour === hour
    && dailySocialTrendsCache.trends?.length
    && !ctx.forceRefresh
  ) {
    return { trends: dailySocialTrendsCache.trends, meta: dailySocialTrendsCache.meta || {} };
  }

  const scrapeCtx = { ...ctx, tiktokNeedsLogin: false };
  const seed = (Array.isArray(seedKeywords) ? seedKeywords : []).map((k) => String(k).trim()).filter(Boolean);
  const perPlatform = 3;
  const chunks = await Promise.all(
    DAILY_SOCIAL_PLATFORMS.map((cfg) => fetchPlatformDailyTrends(cfg, keys, seed, perPlatform, scrapeCtx)),
  );
  const merged = dedupeDailyTrends(chunks.flat().filter((t) => t.topic));
  const meta = { tiktokNeedsLogin: !!scrapeCtx.tiktokNeedsLogin };
  dailySocialTrendsCache = { hour, trends: merged, meta };
  return { trends: merged, meta };
}

function dedupeDailyTrends(items) {
  const seen = new Set();
  return items.filter((it) => {
    const k = `${it.platform}:${String(it.topic).toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function clearDailySocialTrendsCache() {
  dailySocialTrendsCache = { hour: '', trends: [], meta: {} };
  try {
    const scraper = require('./socialTrendsScraper');
    scraper.clearSocialTrendsCache();
  } catch (e) { /* ignore */ }
}

module.exports = {
  fetchRealFeed,
  fetchTrendingTopics,
  fetchDailySocialTrends,
  clearDailySocialTrendsCache,
  DAILY_SOCIAL_PLATFORMS,
  fetchRssTrending,
  fetchNewsAsPosts,
  fetchTopHeadlinesAsPosts,
  normalizePlatform,
  normalizePostStats,
};