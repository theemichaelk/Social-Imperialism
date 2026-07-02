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
  if (allowedPlatforms.size > 0) {
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

module.exports = {
  fetchRealFeed,
  fetchTrendingTopics,
  fetchRssTrending,
  fetchNewsAsPosts,
  fetchTopHeadlinesAsPosts,
  normalizePlatform,
  normalizePostStats,
};