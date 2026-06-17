const axios = require('axios');
const { parseTokens } = require('./intelligenceProfile');
const { normalizePostStats, normalizePlatform } = require('./feedFetcher');
const twitter = require('./platforms/twitter');
const reddit = require('./platforms/reddit');
const accountAutomation = require('./accountAutomation');

const UA = 'SocialImperialism/1.0 by SocialImperialismApp';
const GRAPH = 'https://graph.facebook.com/v19.0';
const YT_API = 'https://www.googleapis.com/youtube/v3';

function platformFilterMatch(platform, filters) {
  if (!filters?.platform || filters.platform === 'All') return true;
  const fp = normalizePlatform(filters.platform);
  const pp = normalizePlatform(platform);
  return pp === fp || pp.includes(fp) || fp.includes(pp);
}

function mapRedditPost(post, source, account) {
  return {
    platform: 'Reddit',
    author: `u/${post.author}`,
    time: new Date(post.created_utc * 1000).toLocaleString(),
    createdAt: post.created_utc * 1000,
    matchScore: 85,
    matchedKeyword: source,
    matchedAccountId: account.id,
    matchedAccountHandle: account.handle,
    content: post.title + (post.selftext ? `\n\n${post.selftext.substring(0, 300)}` : ''),
    externalId: post.id,
    url: `https://reddit.com${post.permalink}`,
    subreddit: post.subreddit_name_prefixed,
    stats: { likes: post.ups || 0, comments: post.num_comments || 0, views: 0 },
    fromLinkedAccount: true,
  };
}

async function fetchRedditSubredditPosts(subreddit, limit, source, account, accessToken) {
  const clean = String(subreddit || '').replace(/^r\//i, '').trim();
  if (!clean) return [];
  try {
    const base = accessToken ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
    const headers = { 'User-Agent': UA };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await axios.get(`${base}/r/${clean}/hot.json`, {
      params: { limit: Math.min(limit, 25) },
      headers,
      timeout: 15000,
    });
    return (res.data?.data?.children || []).map((child) => mapRedditPost(child.data, source, account));
  } catch (e) {
    console.error(`Reddit r/${clean} feed error:`, e.message);
    return [];
  }
}

async function fetchTwitterAccountPosts(account, keys, limit = 8) {
  const tokens = parseTokens(account);
  const accessToken = tokens?.access_token;
  const twKeys = { ...keys };
  if (accessToken && accessToken !== keys.twBearer) {
    twKeys.twBearer = accessToken;
    twKeys.twAccess = accessToken;
    twKeys.twAccessSecret = tokens?.access_secret || tokens?.oauth_token_secret;
  }

  const client = twitter.getClient(twKeys);
  if (client) {
    try {
      const me = await client.v2.me({ 'user.fields': 'username' });
      const userId = me.data?.id;
      if (userId) {
        const timeline = await client.v2.userTimeline(userId, {
          max_results: Math.min(Math.max(limit, 5), 10),
          'tweet.fields': 'created_at,public_metrics',
          exclude: ['retweets'],
        });
        const username = me.data?.username || account.handle?.replace(/^@/, '');
        return (timeline.data?.data || []).map((tweet) => {
          const metrics = tweet.public_metrics || {};
          return {
            platform: 'Twitter',
            author: username ? `@${username}` : account.handle,
            time: tweet.created_at ? new Date(tweet.created_at).toLocaleString() : 'recent',
            createdAt: tweet.created_at ? new Date(tweet.created_at).getTime() : Date.now(),
            matchScore: 90,
            matchedKeyword: account.handle,
            matchedAccountId: account.id,
            matchedAccountHandle: account.handle,
            content: tweet.text,
            externalId: tweet.id,
            url: `https://twitter.com/i/web/status/${tweet.id}`,
            stats: {
              likes: metrics.like_count || 0,
              comments: metrics.reply_count || 0,
              views: metrics.impression_count || 0,
            },
            fromLinkedAccount: true,
          };
        });
      }
    } catch (e) {
      console.error('Twitter timeline error:', e.message);
    }
  }

  const handle = (account.handle || '').replace(/^@/, '').trim();
  if (!handle) return [];

  const [fromPosts, mentionPosts] = await Promise.all([
    twitter.searchPosts(`from:${handle}`, twKeys, limit),
    twitter.searchPosts(`@${handle} -from:${handle}`, twKeys, Math.max(3, Math.floor(limit / 2))),
  ]);

  return dedupePosts([...fromPosts, ...mentionPosts]).map((p) => ({
    ...p,
    matchedAccountId: account.id,
    matchedAccountHandle: account.handle,
    fromLinkedAccount: true,
  }));
}

async function fetchMetaFeed(account, limit = 8) {
  const tokens = parseTokens(account);
  const accessToken = tokens?.access_token || account.accessToken;
  if (!accessToken) return [];

  let targetId = account.id;
  if (account.type === 'Profile' || !targetId || String(targetId).startsWith('fb_')) {
    targetId = 'me';
  }

  try {
    const res = await axios.get(`${GRAPH}/${targetId}/feed`, {
      params: {
        fields: 'message,created_time,permalink_url,likes.summary(true),comments.summary(true),shares',
        limit: Math.min(limit, 15),
        access_token: accessToken,
      },
      timeout: 15000,
    });

    const platform = (account.platform || '').includes('Instagram') ? 'Instagram' : 'Facebook';
    return (res.data?.data || []).map((item) => ({
      platform,
      author: account.handle || 'Page',
      time: item.created_time ? new Date(item.created_time).toLocaleString() : 'recent',
      createdAt: item.created_time ? new Date(item.created_time).getTime() : Date.now(),
      matchScore: 88,
      matchedKeyword: account.handle,
      matchedAccountId: account.id,
      matchedAccountHandle: account.handle,
      content: item.message || '[Media post]',
      externalId: item.id,
      url: item.permalink_url || `https://facebook.com/${item.id}`,
      stats: {
        likes: item.likes?.summary?.total_count || 0,
        comments: item.comments?.summary?.total_count || 0,
        views: item.shares?.count || 0,
      },
      fromLinkedAccount: true,
    }));
  } catch (e) {
    console.error(`Meta feed error (${account.handle}):`, e.message);
    return [];
  }
}

async function fetchYouTubeChannelPosts(account, keys, limit = 6) {
  const tokens = parseTokens(account);
  const accessToken = tokens?.access_token;
  const apiKey = keys.youtubeApiKey || tokens?.api_key;
  const channelId = account.id && !String(account.id).startsWith('yt_') ? account.id : null;
  if (!channelId) return [];

  const params = {
    part: 'snippet',
    channelId,
    order: 'date',
    type: 'video',
    maxResults: Math.min(limit, 10),
  };
  if (apiKey) params.key = apiKey;

  try {
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    const res = await axios.get(`${YT_API}/search`, { params, headers, timeout: 15000 });
    return (res.data?.items || []).map((item) => {
      const vid = item.id?.videoId;
      const snippet = item.snippet || {};
      return {
        platform: 'YouTube',
        author: account.handle || snippet.channelTitle || 'Channel',
        time: snippet.publishedAt ? new Date(snippet.publishedAt).toLocaleString() : 'recent',
        createdAt: snippet.publishedAt ? new Date(snippet.publishedAt).getTime() : Date.now(),
        matchScore: 86,
        matchedKeyword: account.handle,
        matchedAccountId: account.id,
        matchedAccountHandle: account.handle,
        content: snippet.title + (snippet.description ? `\n\n${snippet.description.substring(0, 200)}` : ''),
        externalId: vid,
        url: vid ? `https://www.youtube.com/watch?v=${vid}` : snippet.channelId,
        stats: { likes: 0, comments: 0, views: 0 },
        fromLinkedAccount: true,
      };
    });
  } catch (e) {
    console.error(`YouTube feed error (${account.handle}):`, e.message);
    return [];
  }
}

function redditSubredditsForAccount(account, allAccounts) {
  const groups = accountAutomation.getAccountGroups(account, allAccounts);
  const subs = groups
    .filter((g) => g.type === 'Subreddit' || g.subreddit || g.name?.startsWith('r/'))
    .map((g) => g.subreddit || g.name?.replace(/^r\//, ''))
    .filter(Boolean);

  if (!subs.length && account.handle) {
    const h = account.handle.trim();
    if (h.startsWith('r/')) subs.push(h.replace(/^r\//, ''));
    if (h.startsWith('u/')) {
      // user profile — search their recent subreddit activity via public search not available; skip
    }
  }

  if (!subs.length && account.profile?.suggestedGroups?.length) {
    account.profile.suggestedGroups.forEach((g) => {
      const m = String(g).match(/r\/([A-Za-z0-9_]+)/i);
      if (m) subs.push(m[1]);
    });
  }

  return [...new Set(subs)].slice(0, 5);
}

async function fetchAccountPosts(account, keys, allAccounts, limitPerAccount = 8) {
  const platform = normalizePlatform(account.platform);

  if (platform === 'Twitter') {
    return fetchTwitterAccountPosts(account, keys, limitPerAccount);
  }

  if (platform === 'Reddit') {
    let subs = redditSubredditsForAccount(account, allAccounts);
    const tokens = parseTokens(account);
    const accessToken = tokens?.access_token;
    if (!subs.length && accessToken) {
      try {
        const discovered = await reddit.discoverSubreddits(accessToken);
        subs = discovered.map((d) => d.subreddit).filter(Boolean);
      } catch (e) {
        console.warn('Reddit subreddit discovery during feed:', e.message);
      }
    }
    const posts = [];
    const targets = subs.length ? subs : ['all'];
    for (const sub of targets) {
      const batch = await fetchRedditSubredditPosts(sub, 5, `r/${sub}`, account, accessToken);
      posts.push(...batch);
    }
    return posts;
  }

  if (platform === 'Facebook' || platform === 'Instagram') {
    return fetchMetaFeed(account, limitPerAccount);
  }

  if (platform === 'YouTube') {
    return fetchYouTubeChannelPosts(account, keys, limitPerAccount);
  }

  return [];
}

function dedupePosts(posts) {
  const seen = new Set();
  return posts.filter((p) => {
    const key = `${p.platform}:${p.externalId || p.url || p.content?.substring(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchLinkedAccountFeed({ linkedAccounts, filters, keys, limitPerAccount = 8 }) {
  const connected = (linkedAccounts || []).filter((a) => a.id && a.status !== 'disconnected');
  if (!connected.length) return [];

  const posts = [];
  for (const account of connected.slice(0, 12)) {
    if (!platformFilterMatch(account.platform, filters)) continue;
    try {
      const batch = await fetchAccountPosts(account, keys, connected, limitPerAccount);
      posts.push(...batch);
    } catch (e) {
      console.error(`Account feed error ${account.platform}/${account.handle}:`, e.message);
    }
  }

  return dedupePosts(posts).map(normalizePostStats);
}

module.exports = {
  fetchLinkedAccountFeed,
  fetchAccountPosts,
};