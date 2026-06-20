const axios = require('axios');
const { discoverRedditPosts } = require('../webDiscovery');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function mapRedditChild(child, keyword) {
      const post = child.data;
      return {
        platform: 'Reddit',
        author: `u/${post.author}`,
        time: new Date(post.created_utc * 1000).toLocaleString(),
        createdAt: post.created_utc * 1000,
        matchScore: Math.min(99, 75 + Math.floor((post.ups || 0) / 5)),
        matchedKeyword: keyword,
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
      };
}

async function searchPosts(keyword, keys, limit = 5) {
  try {
    const res = await axios.get('https://www.reddit.com/search.json', {
      params: { q: keyword, limit, sort: 'new', type: 'link' },
      headers: { 'User-Agent': UA },
      timeout: 15000,
    });

    const mapped = (res.data?.data?.children || []).map((child) => mapRedditChild(child, keyword));
    if (mapped.length) return mapped;
  } catch (e) {
    console.error('Reddit search error:', e.message);
  }

  const fallback = await discoverRedditPosts(keyword, keys, limit);
  if (fallback.length) return fallback;

  try {
    const res = await axios.get('https://www.reddit.com/hot.json', {
      params: { limit: Math.min(limit, 15) },
      headers: { 'User-Agent': UA },
      timeout: 15000,
    });
    return (res.data?.data?.children || []).slice(0, limit).map((child) => mapRedditChild(child, keyword));
  } catch (e) {
    console.error('Reddit hot fallback error:', e.message);
    return [];
  }
}

async function getProfile(accessToken) {
  if (!accessToken) return null;
  try {
    const res = await axios.get('https://oauth.reddit.com/api/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': UA },
    });
    const d = res.data;
    return {
      followers: 'N/A',
      likes: String(d.link_karma || 0),
      bestTime: 'Peak on weekday evenings (US)',
      topTrendingNiche: 'Subreddit-specific',
      growthVelocity: `Comment karma: ${d.comment_karma || 0}`,
      suggestedGroups: ['Relevant subreddits for your niche'],
      raw: d,
    };
  } catch (e) {
    console.error('Reddit profile error:', e.message);
    return null;
  }
}

async function discoverSubreddits(accessToken) {
  if (!accessToken) return [];
  try {
    const res = await axios.get('https://oauth.reddit.com/subreddits/mine/subscriber', {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': UA },
      params: { limit: 50 },
    });
    return (res.data?.data?.children || []).map((child) => {
      const s = child.data;
      return {
        platform: 'Reddit',
        handle: `r/${s.display_name}`,
        type: 'Subreddit',
        id: s.name,
        subreddit: s.display_name,
      };
    });
  } catch (e) {
    console.error('Reddit subreddit discovery error:', e.message);
    return [];
  }
}

async function discoverAccounts(keys, username, accessToken) {
  const accounts = [];

  if (accessToken) {
    const profile = await getProfile(accessToken);
    if (profile?.raw) {
      accounts.push({ platform: 'Reddit', handle: `u/${profile.raw.name}`, type: 'Profile', id: profile.raw.id });
    }
    accounts.push(...await discoverSubreddits(accessToken));
  }

  if (accounts.length) return accounts;
  return [{ platform: 'Reddit', handle: username ? `u/${username.replace(/^u\//, '')}` : 'u/account', type: 'Profile', id: `rd_${Date.now()}` }];
}

async function publish(postData, keys, accessToken) {
  if (!accessToken) throw new Error('Reddit access token required');
  const res = await axios.post(
    'https://oauth.reddit.com/api/submit',
    new URLSearchParams({
      kind: 'self',
      sr: postData.subreddit || 'test',
      title: postData.title || postData.content.substring(0, 280),
      text: postData.content,
    }),
    { headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': UA } }
  );
  return res.data;
}

async function resolveRedditAccessToken(keys, accessToken) {
  if (accessToken) return accessToken;
  if (keys.rdAccess || keys.redditAccessToken) return keys.rdAccess || keys.redditAccessToken;
  if (keys.rdId && keys.rdSecret && keys.redditUsername && keys.redditPassword) {
    try {
      const { redditPasswordGrant } = require('../credentialAuth');
      const tok = await redditPasswordGrant(keys, keys.redditUsername, keys.redditPassword);
      if (tok?.access_token) return tok.access_token;
    } catch (e) {
      console.error('Reddit password grant failed:', e.message);
    }
  }
  return null;
}

async function engage(payload, keys, accessToken) {
  const { isSyntheticExternalId } = require('../postIdUtils');
  const token = await resolveRedditAccessToken(keys, accessToken);
  if (!token) throw new Error('Link a Reddit account in Account Hub or add Reddit credentials in Settings to engage on Reddit.');

  const rawId = payload.postId || payload.externalId;
  if (!rawId || isSyntheticExternalId(rawId)) {
    throw new Error('This post was found via web search — open the link to engage on Reddit.');
  }

  const fullname = rawId.startsWith('t3_') ? rawId : `t3_${rawId}`;
  const headers = { Authorization: `Bearer ${token}`, 'User-Agent': UA };

  if (payload.action === 'like') {
    const res = await axios.post(
      'https://oauth.reddit.com/api/vote',
      new URLSearchParams({ id: fullname, dir: '1' }),
      { headers, timeout: 15000 },
    );
    return res.data;
  }

  if (payload.action === 'reply' && payload.content) {
    const res = await axios.post(
      'https://oauth.reddit.com/api/comment',
      new URLSearchParams({ api_type: 'json', text: payload.content, thing_id: fullname }),
      { headers, timeout: 20000 },
    );
    const errors = res.data?.json?.errors;
    if (errors?.length) throw new Error(errors.map((e) => e.join(': ')).join('; '));
    return res.data;
  }

  if (payload.action === 'share') {
    throw new Error('Reddit cross-post requires opening the post — use View Post to share manually.');
  }

  throw new Error(`Unsupported Reddit action: ${payload.action}`);
}

module.exports = { searchPosts, getProfile, discoverAccounts, discoverSubreddits, publish, engage };