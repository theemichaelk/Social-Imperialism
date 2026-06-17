const axios = require('axios');

const UA = 'SocialImperialism/1.0 by SocialImperialismApp';

async function searchPosts(keyword, keys, limit = 5) {
  try {
    const res = await axios.get('https://www.reddit.com/search.json', {
      params: { q: keyword, limit, sort: 'new', type: 'link' },
      headers: { 'User-Agent': UA },
    });

    return (res.data?.data?.children || []).map((child) => {
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
    });
  } catch (e) {
    console.error('Reddit search error:', e.message);
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

module.exports = { searchPosts, getProfile, discoverAccounts, discoverSubreddits, publish };