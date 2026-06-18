const axios = require('axios');
const { TwitterApi } = require('twitter-api-v2');
const { twitterConsumerKey, twitterConsumerSecret } = require('../keys');

function getClient(keys) {
  const appKey = twitterConsumerKey(keys);
  const appSecret = twitterConsumerSecret(keys);
  if (keys.twAccess && keys.twAccessSecret && appKey && appSecret) {
    return new TwitterApi({
      appKey,
      appSecret,
      accessToken: keys.twAccess,
      accessSecret: keys.twAccessSecret,
    });
  }
  if (keys.twBearer) {
    return new TwitterApi(keys.twBearer);
  }
  return null;
}

async function searchPosts(keyword, keys, limit = 5) {
  const client = getClient(keys);
  if (!client) return [];

  try {
    const res = await client.v2.search(keyword, {
      max_results: Math.min(limit, 10),
      'tweet.fields': 'created_at,author_id,public_metrics',
      expansions: 'author_id',
      'user.fields': 'username,name',
    });

    const users = {};
    (res.includes?.users || []).forEach((u) => { users[u.id] = u; });

    return (res.data?.data || []).map((tweet) => {
      const user = users[tweet.author_id] || {};
      const metrics = tweet.public_metrics || {};
      return {
        platform: 'Twitter',
        author: user.username ? `@${user.username}` : '@unknown',
        time: tweet.created_at ? new Date(tweet.created_at).toLocaleString() : 'recent',
        createdAt: tweet.created_at ? new Date(tweet.created_at).getTime() : Date.now(),
        matchScore: Math.min(99, 70 + Math.floor((metrics.like_count || 0) / 10)),
        matchedKeyword: keyword,
        content: tweet.text,
        externalId: tweet.id,
        url: `https://twitter.com/i/web/status/${tweet.id}`,
        public_metrics: metrics,
        stats: {
          likes: metrics.like_count || 0,
          comments: metrics.reply_count || 0,
          views: metrics.impression_count || 0,
        },
      };
    });
  } catch (e) {
    console.error('Twitter search error:', e.message);
    const { discoverTwitterPosts } = require('../webDiscovery');
    return discoverTwitterPosts(keyword, keys, limit);
  }
}

function formatProfileFromUser(user) {
  const followers = user.followers_count || user.public_metrics?.followers_count || 0;
  const favourites = user.favourites_count || user.public_metrics?.like_count || 0;
  const statuses = user.statuses_count || user.public_metrics?.tweet_count || 0;
  const handle = user.screen_name || user.username;
  return {
    followers: String(followers),
    likes: String(favourites + statuses),
    bestTime: 'Varies by audience — check Twitter Analytics',
    topTrendingNiche: '#SocialMedia',
    growthVelocity: `+${Math.max(0, Math.floor(followers / 100))}% estimated`,
    suggestedGroups: ['Twitter Communities', 'Industry hashtags'],
    raw: user,
    handle: handle ? `@${handle}` : undefined,
  };
}

async function getProfile(keys, accessToken) {
  const client = getClient(keys);
  if (client) {
    try {
      const user = await client.v1.verifyCredentials({ skip_status: true, include_email: false });
      return formatProfileFromUser(user);
    } catch (e) {
      console.error('Twitter v1 profile error:', e.message);
    }
  }

  const token = typeof accessToken === 'string' ? accessToken : accessToken?.access_token;
  const isAppBearer = token && keys.twBearer && token === keys.twBearer;
  if (token && !isAppBearer) {
    try {
      const oauthClient = new TwitterApi(token);
      const me = await oauthClient.v2.me({ 'user.fields': 'public_metrics,created_at,username' });
      return formatProfileFromUser({ ...me.data, ...(me.data.public_metrics || {}) });
    } catch (e) {
      console.error('Twitter OAuth2 profile error:', e.message);
    }
  }

  return null;
}

function getClientForPublish(keys, accessToken) {
  if (accessToken) return new TwitterApi(accessToken);
  return getClient(keys);
}

async function publish(postData, keys, accessToken) {
  const client = getClientForPublish(keys, accessToken);
  if (!client) throw new Error('Twitter API credentials not configured');

  let mediaId = null;
  if (postData.hasMedia && postData.mediaUrl) {
    const imageRes = await axios.get(postData.mediaUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageRes.data, 'binary');
    mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType: 'image/jpeg' });
  }

  if (mediaId) {
    return client.v2.tweet(postData.content, { media: { media_ids: [mediaId] } });
  }
  return client.v2.tweet(postData.content);
}

async function engage(payload, keys, accessToken) {
  const client = getClientForPublish(keys, accessToken);
  if (!client) throw new Error('Twitter API credentials not configured');

  const tweetId = payload.postId || payload.externalId;
  if (!tweetId) throw new Error('Missing tweet ID for engagement');

  const me = await client.v2.me();
  const userId = me.data.id;

  if (payload.action === 'like') {
    return client.v2.like(userId, tweetId);
  }
  if (payload.action === 'share' || payload.action === 'retweet') {
    return client.v2.retweet(userId, tweetId);
  }
  if (payload.action === 'reply' && payload.content) {
    return client.v2.tweet({ text: payload.content, reply: { in_reply_to_tweet_id: tweetId } });
  }
  throw new Error(`Unsupported Twitter action: ${payload.action}`);
}

async function discoverAccounts(keys, username) {
  const profile = await getProfile(keys);
  if (profile) {
    const screenName = profile.raw?.username || profile.raw?.screen_name || profile.handle?.replace(/^@/, '');
    return [{
      platform: 'Twitter / X',
      handle: screenName ? `@${screenName}` : (username || '@account'),
      type: 'Profile',
      id: String(profile.raw?.id_str || profile.raw?.id || `tw_${Date.now()}`),
    }];
  }
  return [{ platform: 'Twitter / X', handle: username || '@account', type: 'Profile', id: `tw_${Date.now()}` }];
}

module.exports = { searchPosts, getProfile, publish, engage, discoverAccounts, getClient };