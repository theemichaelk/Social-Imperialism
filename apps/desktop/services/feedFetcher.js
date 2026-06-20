const axios = require('axios');
const twitter = require('./platforms/twitter');
const reddit = require('./platforms/reddit');
const quora = require('./platforms/quora');
const { hasTwitterKeys } = require('./keys');

const UA = 'SocialImperialism/1.0 by SocialImperialismApp';

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

  for (const keyword of queryList.slice(0, 5)) {
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
  }

  const seen = new Set();
  const deduped = posts.filter((p) => {
    const key = `${p.platform}:${p.externalId || p.content?.substring(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const minDesired = 5;
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

  if (deduped.length < minDesired && queryList[0]) {
    const { discoverRedditPosts, discoverQuoraPosts } = require('./webDiscovery');
    const webReddit = platformAllowed('Reddit', filters, allowedPlatforms)
      ? await discoverRedditPosts(queryList[0], keys, 8) : [];
    const webQuora = platformAllowed('Quora', filters, allowedPlatforms)
      ? await discoverQuoraPosts(queryList[0], keys, 5) : [];
    [...webReddit, ...webQuora].forEach((p) => {
      const key = `${p.platform}:${p.externalId || p.url || p.content?.substring(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(normalizePostStats(p));
      }
    });
  }

  return sortPosts(deduped.map(normalizePostStats), filters?.sort);
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

async function fetchNewsHeadlineTrends(keys, limit = 6) {
  const newsKey = keys.newsApiKey || process.env.NEWS_API_KEY;
  if (!newsKey) return [];
  try {
    const res = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: { category: 'technology', language: 'en', pageSize: limit, apiKey: newsKey },
      timeout: 15000,
    });
    return (res.data?.articles || []).slice(0, limit).map((a) => ({
      topic: (a.title || 'Trending headline').substring(0, 100),
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

async function fetchBraveTrending(keyword, limit = 6) {
  if (!keyword) return [];
  try {
    const { searchViaBrave } = require('./webDiscovery');
    const hits = await searchViaBrave(`${keyword} trending`, '(?:reddit|quora|news)\\.com', limit);
    return hits.map((h) => ({
      topic: (h.title || '').substring(0, 100),
      searchVolume: 'Web',
      momentum: 'Discovered',
      url: h.url,
      platform: 'Web',
    }));
  } catch (e) {
    console.warn('Brave trending fallback:', e.message);
    return [];
  }
}

async function fetchTrendingTopics(platform, keys, seedKeywords = []) {
  const serpTrends = await fetchSerpTrending(keys, 6);
  if (serpTrends.length > 0) return serpTrends;

  if (platform === 'Reddit' || platform === 'All') {
    const redditTrends = await fetchRedditHot(6);
    if (redditTrends.length > 0) return redditTrends;
  }

  if (hasTwitterKeys(keys) && (platform === 'Twitter' || platform === 'Twitter / X')) {
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

  const redditTrends = await fetchRedditHot(6);
  if (redditTrends.length > 0) return redditTrends;

  const newsTrends = await fetchNewsHeadlineTrends(keys, 6);
  if (newsTrends.length > 0) return newsTrends;

  const seed = (Array.isArray(seedKeywords) ? seedKeywords : []).map((k) => String(k).trim()).filter(Boolean);
  if (seed.length) {
    const braveTrends = await fetchBraveTrending(seed[0], 6);
    if (braveTrends.length > 0) return braveTrends;
    return seed.slice(0, 6).map((term) => ({
      topic: term,
      searchVolume: 'Brand keyword',
      momentum: 'Tracked',
      url: null,
      platform: 'Keywords',
    }));
  }

  return newsTrends;
}

module.exports = {
  fetchRealFeed,
  fetchTrendingTopics,
  normalizePlatform,
  normalizePostStats,
};