const axios = require('axios');
const linkedin = require('./platforms/linkedin');
const { parseTokens } = require('./intelligenceProfile');

const STORE_KEY = 'engagementLists';
const LOG_KEY = 'engagementLog';
const TOP_LIST_ID = '__top_commenters__';

function getLists(store) {
  try {
    return JSON.parse(store.getItem(STORE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveLists(store, lists) {
  store.setItem(STORE_KEY, JSON.stringify(lists));
}

function extractLinkedInUsername(url) {
  if (!url) return null;
  const match = String(url).match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match ? match[1] : null;
}

function extractActivityUrn(url) {
  if (!url) return null;
  const activity = url.match(/activity-(\d+)/i);
  if (activity) return `urn:li:activity:${activity[1]}`;
  const ugc = url.match(/ugcPost-(\d+)/i);
  if (ugc) return `urn:li:ugcPost:${ugc[1]}`;
  const share = url.match(/share-(\d+)/i);
  if (share) return `urn:li:share:${share[1]}`;
  return null;
}

function logEngagement(store, entry) {
  let log = [];
  try { log = JSON.parse(store.getItem(LOG_KEY) || '[]'); } catch (e) {}
  log.unshift({ ...entry, timestamp: new Date().toISOString() });
  store.setItem(LOG_KEY, JSON.stringify(log.slice(0, 500)));
}

function buildTopCommentersList(store) {
  const authorCounts = {};

  try {
    const replies = JSON.parse(store.getItem('aiRepliesHistory') || '[]');
    replies.filter((r) => (r.platform || '').includes('LinkedIn')).forEach((r) => {
      const author = r.author || r.targetAuthor || 'LinkedIn contact';
      authorCounts[author] = (authorCounts[author] || 0) + 1;
    });
  } catch (e) {}

  try {
    const log = JSON.parse(store.getItem(LOG_KEY) || '[]');
    log.filter((e) => e.platform === 'LinkedIn').forEach((e) => {
      const author = e.author || 'LinkedIn contact';
      authorCounts[author] = (authorCounts[author] || 0) + 1;
    });
  } catch (e) {}

  const profiles = Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([author, count]) => ({
      author,
      profileUrl: null,
      interactionCount: count,
    }));

  return {
    id: TOP_LIST_ID,
    name: 'My Top Commenters',
    type: 'Analytics',
    profiles,
    profileUrls: [],
    autoEngage: false,
    isSystem: true,
    supporterCount: profiles.length,
  };
}

async function fetchPostsForProfile(profileUrl, keys) {
  const username = extractLinkedInUsername(profileUrl);
  if (!username) return [];

  const posts = [];

  if (keys.serpApiKey) {
    try {
      const res = await axios.get('https://serpapi.com/search.json', {
        params: {
          engine: 'google',
          q: `site:linkedin.com/posts ${username}`,
          api_key: keys.serpApiKey,
          num: 8,
        },
        timeout: 15000,
      });

      (res.data?.organic_results || []).forEach((r) => {
        const urn = extractActivityUrn(r.link);
        posts.push({
          id: r.link,
          externalId: urn || r.link,
          urn,
          author: username.replace(/-/g, ' '),
          authorTitle: 'LinkedIn',
          authorUrl: profileUrl,
          time: r.date || 'Recent',
          content: r.snippet ? `${r.title}\n\n${r.snippet}` : (r.title || ''),
          url: r.link,
          platform: 'LinkedIn',
          stats: { likes: 0, comments: 0, views: 0 },
        });
      });
    } catch (e) {
      console.error('SerpAPI LinkedIn profile fetch error:', e.message);
    }
  }

  const token = keys.linkedinAccessToken;
  if (token && posts.length === 0) {
    try {
      const apiPosts = await linkedin.fetchRecentPostsForMember(profileUrl, token);
      posts.push(...apiPosts);
    } catch (e) {
      console.error('LinkedIn API profile fetch error:', e.message);
    }
  }

  return posts;
}

async function fetchListFeed(list, keys) {
  if (!list) return [];

  if (list.id === TOP_LIST_ID || list.isSystem) {
    const authors = (list.profiles || []).slice(0, 10);
    if (authors.length === 0) return [];
    const allPosts = [];

    for (const profile of authors) {
      if (profile.profileUrl) {
        const p = await fetchPostsForProfile(profile.profileUrl, keys);
        allPosts.push(...p);
      } else if (keys.serpApiKey) {
        try {
          const res = await axios.get('https://serpapi.com/search.json', {
            params: {
              engine: 'google',
              q: `site:linkedin.com/posts "${profile.author}"`,
              api_key: keys.serpApiKey,
              num: 3,
            },
            timeout: 15000,
          });
          (res.data?.organic_results || []).forEach((r) => {
            allPosts.push({
              id: r.link,
              externalId: extractActivityUrn(r.link) || r.link,
              urn: extractActivityUrn(r.link),
              author: profile.author,
              authorTitle: 'Top Supporter',
              time: r.date || 'Recent',
              content: r.snippet || r.title,
              url: r.link,
              platform: 'LinkedIn',
            });
          });
        } catch (e) {}
      }
    }
    return dedupePosts(allPosts);
  }

  const urls = list.profileUrls || [];
  if (urls.length === 0) return [];

  const allPosts = [];
  for (const url of urls.slice(0, 15)) {
    const trimmed = url.trim();
    if (!trimmed) continue;
    const profilePosts = await fetchPostsForProfile(trimmed, keys);
    allPosts.push(...profilePosts);
  }

  return dedupePosts(allPosts);
}

function dedupePosts(posts) {
  const seen = new Set();
  return posts.filter((p) => {
    const key = p.url || p.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function engageOnPost(payload, keys, linkedAccounts) {
  const account = linkedAccounts.find((a) => a.platform === 'LinkedIn' || a.platform?.includes('LinkedIn'));
  const tokens = account ? parseTokens(account) : null;
  const accessToken = tokens?.access_token || keys.linkedinAccessToken;

  const urn = payload.urn || extractActivityUrn(payload.url) || payload.externalId;
  if (!urn) {
    throw new Error('Cannot engage: post URN not found. Open the post on LinkedIn to engage manually.');
  }

  return linkedin.engage({
    ...payload,
    urn,
    platform: 'LinkedIn',
    accessToken,
  }, accessToken);
}

module.exports = {
  getLists,
  saveLists,
  buildTopCommentersList,
  fetchListFeed,
  engageOnPost,
  logEngagement,
  extractActivityUrn,
  TOP_LIST_ID,
  STORE_KEY,
};