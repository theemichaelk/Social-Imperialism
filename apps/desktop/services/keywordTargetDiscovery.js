/**
 * Discover accounts, pages, communities, and high-engagement posts for keywords.
 * Ranks targets from most followed / active → least for Be-First watch-list selection.
 */
const axios = require('axios');
const { discoverAllPlatformPosts } = require('./webDiscovery');
const { fetchRealFeed } = require('./feedFetcher');

const UA = 'SocialImperialism/1.0 (keyword-target-discovery)';

const GENERIC_AUTHORS = new Set([
  'linkedin', 'quora', 'reddit', 'twitter', 'facebook', 'instagram', 'youtube',
  'tiktok', 'pinterest', 'threads', 'twitch', 'unknown', 'all',
]);

const SKIP_HANDLES = new Set([
  'search', 'home', 'explore', 'i', 'intent', 'hashtag', 'login', 'signup',
  'watch', 'playlist', 'channel', 'groups', 'pages', 'events', 'marketplace',
  'topics', 'profile', 'posts', 'reels', 'stories', 'about', 'help', 'privacy',
]);

const URL_RULES = [
  { platform: 'Reddit', type: 'community', re: /reddit\.com\/r\/([A-Za-z0-9_]+)(?:\/|$)/i, term: (m) => `r/${m[1]}` },
  { platform: 'Reddit', type: 'account', re: /reddit\.com\/u(?:ser)?\/([A-Za-z0-9_-]+)(?:\/|$)/i, term: (m) => `u/${m[1]}` },
  { platform: 'Twitter', type: 'account', re: /(?:twitter|x)\.com\/([A-Za-z0-9_]+)(?:\/|$)/i, term: (m) => `@${m[1]}`, skip: SKIP_HANDLES },
  { platform: 'Instagram', type: 'account', re: /instagram\.com\/([A-Za-z0-9_.]+)(?:\/|$)/i, term: (m) => `@${m[1]}`, skip: SKIP_HANDLES },
  { platform: 'YouTube', type: 'page', re: /youtube\.com\/@([A-Za-z0-9_.-]+)/i, term: (m) => `@${m[1]}` },
  { platform: 'YouTube', type: 'page', re: /youtube\.com\/channel\/([A-Za-z0-9_-]+)/i, term: (m) => `channel/${m[1]}` },
  { platform: 'TikTok', type: 'account', re: /tiktok\.com\/@([A-Za-z0-9_.]+)/i, term: (m) => `@${m[1]}` },
  { platform: 'LinkedIn', type: 'account', re: /linkedin\.com\/in\/([A-Za-z0-9_-]+)/i, term: (m) => `@${m[1]}` },
  { platform: 'LinkedIn', type: 'page', re: /linkedin\.com\/company\/([A-Za-z0-9_-]+)/i, term: (m) => `${m[1]}` },
  { platform: 'Facebook', type: 'page', re: /facebook\.com\/([A-Za-z0-9.]+)/i, term: (m) => m[1], skip: new Set(['watch', 'groups', 'events', 'marketplace', 'login']) },
  { platform: 'Pinterest', type: 'account', re: /pinterest\.com\/([A-Za-z0-9_]+)/i, term: (m) => `@${m[1]}`, skip: SKIP_HANDLES },
  { platform: 'Threads', type: 'account', re: /threads\.net\/@([A-Za-z0-9_.]+)/i, term: (m) => `@${m[1]}` },
  { platform: 'Twitch', type: 'account', re: /twitch\.tv\/([A-Za-z0-9_]+)/i, term: (m) => `@${m[1]}`, skip: new Set(['directory', 'videos', 'clips']) },
  { platform: 'Quora', type: 'account', re: /quora\.com\/profile\/([A-Za-z0-9_-]+)/i, term: (m) => `@${m[1]}` },
  { platform: 'Quora', type: 'page', re: /quora\.com\/topic\/([A-Za-z0-9_-]+)/i, term: (m) => `topic/${m[1]}` },
  { platform: 'Discord', type: 'community', re: /discord\.com\/(?:servers|invite)\/([A-Za-z0-9_-]+)/i, term: (m) => m[1] },
  { platform: 'Telegram', type: 'community', re: /t\.me\/([A-Za-z0-9_]+)/i, term: (m) => `@${m[1]}`, skip: new Set(['joinchat', 'addstickers', 'share']) },
];

function parseKeywords(input) {
  if (Array.isArray(input)) return input.map((s) => String(s).trim()).filter(Boolean);
  return String(input || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function targetKey(platform, type, term) {
  return `${platform}:${type}:${String(term || '').toLowerCase()}`;
}

const PLATFORM_NAMES = new Set([
  'facebook', 'instagram', 'youtube', 'tiktok', 'twitter', 'x', 'pinterest',
  'snapchat', 'threads', 'twitch', 'linkedin', 'reddit', 'quora', 'discord', 'telegram',
]);

function isGenericPlatformTerm(term, platform) {
  const raw = String(term || '').trim().toLowerCase().replace(/^@/, '');
  if (!raw) return true;
  if (PLATFORM_NAMES.has(raw)) return true;
  const plat = String(platform || '').trim().toLowerCase();
  if (plat && raw === plat) return true;
  return false;
}

function isValidTargetTerm(term, type = 'account') {
  const t = String(term || '').trim();
  if (!t) return false;
  const maxLen = type === 'post' ? 72 : 48;
  if (t.length > maxLen) return false;
  if (/https?:\/\//i.test(t) || /\b[a-z0-9-]+\.(com|net|org|io|tv|me)\b/i.test(t)) return false;
  if (/[›»|]/.test(t)) return false;
  if (/^(quora|linkedin|reddit|youtube|facebook|instagram|tiktok|twitter|pinterest|threads|twitch)\b/i.test(t)) {
    return false;
  }
  if ((t.match(/\s/g) || []).length >= (type === 'post' ? 4 : 2)) return false;
  if (type !== 'community' && /^r\//i.test(t) && t.length > 32) return false;
  return true;
}

function isRelevantWatchTarget(t) {
  if (!t?.term || !isValidTargetTerm(t.term, t.type)) return false;
  if (isGenericPlatformTerm(t.term, t.platform)) return false;
  if (t.type === 'post' && t.source !== 'reddit_subreddit_search' && !t.subscribers && !t.followers) {
    if (t.isWebDiscovery || /web_discovery|serp/i.test(String(t.source || ''))) return false;
  }
  if (t.type === 'account' && /^@(quora|linkedin|reddit|youtube|facebook|instagram)$/i.test(t.term)) {
    return false;
  }
  return true;
}

function normalizeTargetTerm(term, platform, type) {
  let t = String(term || '').trim();
  if (!t) return t;
  t = t.replace(/^@\/u\//i, 'u/').replace(/^@\/+/g, '@');
  if (platform === 'Reddit') {
    if (type === 'account' && /^@/i.test(t) && !/^u\//i.test(t)) t = `u/${t.replace(/^@/, '')}`;
    if (type === 'community' && !/^r\//i.test(t)) t = `r/${t.replace(/^@/, '').replace(/^r\//i, '')}`;
  }
  if (!isValidTargetTerm(t)) return '';
  return t;
}

async function discoverSerpProfileTargets(keyword, keys, platformFilter, limit = 24) {
  const path = require('path');
  let serpSearch;
  let isSerpConfigured;
  try {
    ({ serpSearch, isSerpConfigured } = require(path.join(__dirname, '../../../packages/core/src/serpProvider')));
  } catch {
    return [];
  }
  if (!isSerpConfigured(keys)) return [];

  const queries = [
    `${keyword} linkedin company page`,
    `${keyword} youtube channel`,
    `${keyword} twitter account`,
    `${keyword} instagram profile`,
    `${keyword} facebook page`,
    `${keyword} subreddit community`,
    `site:reddit.com/r ${keyword}`,
    `site:linkedin.com/company ${keyword}`,
    `site:youtube.com/@ ${keyword}`,
    `site:twitter.com ${keyword}`,
  ];

  const hits = [];
  const seen = new Set();
  for (const query of queries.slice(0, 6)) {
    try {
      const res = await serpSearch(keys, { query, limit: 8, engine: 'google' });
      (res?.data || []).forEach((row) => {
        const url = row.url || row.link;
        if (!url || seen.has(url)) return;
        const inferred = inferFromUrl(url, platformFilter && platformFilter !== 'All' ? platformFilter : null);
        if (!inferred) return;
        if (platformFilter && platformFilter !== 'All' && inferred.platform !== platformFilter) return;
        seen.add(url);
        hits.push({
          ...inferred,
          label: cleanSerpTitle(row.title, inferred.term),
          samplePost: String(row.snippet || row.description || '').slice(0, 160),
          source: 'serp_profile_search',
        });
      });
    } catch (e) {
      console.warn('SERP profile search:', e.message);
    }
    if (hits.length >= limit) break;
  }
  return hits.slice(0, limit);
}

function cleanSerpTitle(title, fallback) {
  const t = String(title || '').replace(/\s*[-|·].*$/, '').trim();
  return t || fallback;
}

function engagementFromPost(post) {
  const likes = post.stats?.likes ?? post.ups ?? 0;
  const comments = post.stats?.comments ?? post.num_comments ?? 0;
  const views = post.stats?.views ?? 0;
  return Number(likes) + Number(comments) * 2 + Math.floor(Number(views) / 100);
}

function inferFromUrl(url, platformHint) {
  if (!url) return null;
  const hits = [];
  for (const rule of URL_RULES) {
    if (platformHint && rule.platform !== platformHint) continue;
    const m = String(url).match(rule.re);
    if (!m) continue;
    const handle = (m[1] || '').toLowerCase();
    if (rule.skip?.has(handle)) continue;
    hits.push({
      platform: rule.platform,
      type: rule.type,
      term: rule.term(m),
      url,
    });
  }
  return hits[0] || null;
}

function inferFromAuthor(author, platform) {
  const raw = String(author || '').trim();
  if (!raw || raw === 'Unknown' || raw === 'Reddit') return null;
  if (isGenericPlatformTerm(raw, platform)) return null;
  if (GENERIC_AUTHORS.has(raw.toLowerCase().replace(/^@/, ''))) return null;

  if (/^r\//i.test(raw)) {
    return { platform: platform || 'Reddit', type: 'community', term: raw.replace(/^r\//i, 'r/'), url: null };
  }
  if (/^u\//i.test(raw) || /^@/i.test(raw)) {
    const term = raw.startsWith('@') ? raw : (raw.startsWith('u/') ? raw : `@${raw}`);
    return { platform: platform || 'Twitter', type: 'account', term, url: null };
  }
  if (platform === 'Reddit' && raw.includes('/')) {
    const sub = raw.match(/r\/([A-Za-z0-9_]+)/i);
    if (sub) return { platform: 'Reddit', type: 'community', term: `r/${sub[1]}`, url: null };
  }
  return { platform: platform || 'All', type: 'account', term: raw.startsWith('@') ? raw : `@${raw}`, url: null };
}

function upsertTarget(map, seed, post, keyword) {
  const platform = seed.platform || post.platform || 'All';
  const type = seed.type || 'account';
  const term = normalizeTargetTerm(seed.term || post.author || '', platform, type);
  if (!term || isGenericPlatformTerm(term, platform)) return;

  const key = targetKey(platform, type, term);
  const engagement = engagementFromPost(post);
  const existing = map.get(key) || {
    id: key,
    platform,
    type,
    term,
    label: term,
    url: seed.url || post.url || null,
    followers: 0,
    subscribers: 0,
    activityScore: 0,
    postCount: 0,
    engagementTotal: 0,
    matchedKeywords: [],
    samplePost: '',
    rankScore: 0,
  };

  existing.postCount += 1;
  existing.engagementTotal += engagement;
  existing.activityScore = Math.max(existing.activityScore, engagement);
  if (!existing.samplePost && post.content) {
    existing.samplePost = String(post.content).slice(0, 160);
  }
  if (seed.url && !existing.url) existing.url = seed.url;
  if (keyword && !existing.matchedKeywords.includes(keyword)) {
    existing.matchedKeywords.push(keyword);
  }
  map.set(key, existing);
}

function extractTargetsFromPost(post, keyword) {
  const out = [];
  const urlHit = inferFromUrl(post.url, post.platform);
  if (urlHit) out.push(urlHit);

  const redditSub = String(post.url || '').match(/reddit\.com\/r\/([A-Za-z0-9_]+)/i);
  if (redditSub) {
    out.push({
      platform: 'Reddit',
      type: 'community',
      term: `r/${redditSub[1]}`,
      url: post.url || null,
    });
  }

  if (post.subreddit) {
    out.push({
      platform: 'Reddit',
      type: 'community',
      term: post.subreddit.startsWith('r/') ? post.subreddit : `r/${post.subreddit}`,
      url: post.url || null,
    });
  }

  const authorHit = inferFromAuthor(post.author, post.platform);
  if (authorHit) out.push(authorHit);

  if (!post.isWebDiscovery && post.url && post.externalId && post.platform !== 'Quora') {
    const postTerm = String(post.content || '').slice(0, 72);
    if (isValidTargetTerm(postTerm, 'post')) {
      out.push({
        platform: post.platform || 'All',
        type: 'post',
        term: postTerm,
        url: post.url,
      });
    }
  }

  return out;
}

async function searchRedditCommunities(keyword, limit = 20) {
  const out = [];
  try {
    const res = await axios.get('https://www.reddit.com/subreddits/search.json', {
      params: { q: keyword, limit, include_over_18: false },
      headers: { 'User-Agent': UA },
      timeout: 15000,
    });
    (res.data?.data?.children || []).forEach((child) => {
      const s = child.data;
      if (!s?.display_name) return;
      out.push({
        id: targetKey('Reddit', 'community', `r/${s.display_name}`),
        platform: 'Reddit',
        type: 'community',
        term: `r/${s.display_name}`,
        label: s.title || `r/${s.display_name}`,
        url: `https://reddit.com/r/${s.display_name}`,
        subscribers: s.subscribers || 0,
        followers: s.subscribers || 0,
        activityScore: Math.min(99, Math.floor((s.active_user_count || 0) / 10)),
        postCount: 1,
        engagementTotal: s.subscribers || 0,
        matchedKeywords: [keyword],
        samplePost: (s.public_description || s.description || '').slice(0, 160),
        rankScore: 0,
        source: 'reddit_subreddit_search',
      });
    });
  } catch (e) {
    console.warn('Reddit subreddit search:', e.message);
  }
  return out;
}

async function searchRedditPosts(keyword, limit = 25) {
  try {
    const res = await axios.get('https://www.reddit.com/search.json', {
      params: { q: keyword, limit, sort: 'relevance', type: 'link' },
      headers: { 'User-Agent': UA },
      timeout: 15000,
    });
    return (res.data?.data?.children || []).map((child) => {
      const p = child.data;
      return {
        platform: 'Reddit',
        author: `u/${p.author}`,
        subreddit: p.subreddit_name_prefixed,
        content: p.title,
        url: `https://reddit.com${p.permalink}`,
        externalId: p.id,
        ups: p.ups || 0,
        num_comments: p.num_comments || 0,
        stats: { likes: p.ups || 0, comments: p.num_comments || 0, views: 0 },
        matchedKeyword: keyword,
      };
    });
  } catch (e) {
    console.warn('Reddit post search:', e.message);
    return [];
  }
}

async function enrichRedditSubscribers(targetMap) {
  const subs = [...targetMap.values()].filter(
    (t) => t.platform === 'Reddit' && t.type === 'community' && !t.subscribers,
  );
  const batch = subs.slice(0, 12);
  await Promise.all(batch.map(async (t) => {
    const name = String(t.term).replace(/^r\//i, '');
    if (!name) return;
    try {
      const res = await axios.get(`https://www.reddit.com/r/${name}/about.json`, {
        headers: { 'User-Agent': UA },
        timeout: 10000,
      });
      const d = res.data?.data;
      if (!d) return;
      t.subscribers = d.subscribers || 0;
      t.followers = d.subscribers || 0;
      t.activityScore = Math.max(t.activityScore, Math.min(99, Math.floor((d.active_user_count || 0) / 5)));
      if (!t.samplePost && d.public_description) t.samplePost = d.public_description.slice(0, 160);
    } catch (e) { /* optional enrich */ }
  }));
}

function computeRankScore(t) {
  const audience = Number(t.subscribers || t.followers || 0);
  const audienceScore = audience > 0 ? Math.log10(audience + 1) * 25 : 0;
  const activity = Number(t.activityScore || 0) + Number(t.engagementTotal || 0) * 0.5;
  const volume = Number(t.postCount || 0) * 8;
  const typeBoost = t.type === 'community' ? 12 : t.type === 'page' ? 10 : t.type === 'account' ? 8 : 4;
  return Math.round(audienceScore + activity + volume + typeBoost);
}

function finalizeTargets(map, limit = 50) {
  const list = [...map.values()]
    .filter(isRelevantWatchTarget)
    .map((t) => ({
      ...t,
      rankScore: computeRankScore(t),
      matchedKeywords: t.matchedKeywords || [],
    }));
  list.sort((a, b) => b.rankScore - a.rankScore);
  return list.slice(0, limit);
}

async function discoverKeywordTargets({
  keywords: rawKeywords,
  platform = 'All',
  keys = {},
  limit = 50,
  limitPerPlatform = 4,
} = {}) {
  const keywords = parseKeywords(rawKeywords);
  if (!keywords.length) {
    return { success: false, error: 'Enter at least one keyword', targets: [], keywords: [] };
  }

  const platformFilter = platform && platform !== 'All' ? platform : null;
  const allowedPlatforms = platformFilter ? new Set([platformFilter]) : null;
  const targetMap = new Map();
  let postCount = 0;
  const scannedPlatforms = new Set();

  for (const keyword of keywords.slice(0, 5)) {
    const serpProfiles = await discoverSerpProfileTargets(keyword, keys, platformFilter, 20);
    serpProfiles.forEach((seed) => {
      scannedPlatforms.add(seed.platform);
      const term = normalizeTargetTerm(seed.term, seed.platform, seed.type);
      if (!term || isGenericPlatformTerm(term, seed.platform)) return;
      const key = targetKey(seed.platform, seed.type, term);
      const existing = targetMap.get(key);
      if (existing) {
        if (!existing.url && seed.url) existing.url = seed.url;
        if (!existing.samplePost && seed.samplePost) existing.samplePost = seed.samplePost;
        if (!existing.matchedKeywords.includes(keyword)) existing.matchedKeywords.push(keyword);
        existing.activityScore = Math.max(existing.activityScore || 0, 40);
      } else {
        targetMap.set(key, {
          id: key,
          platform: seed.platform,
          type: seed.type,
          term,
          label: seed.label || term,
          url: seed.url || null,
          followers: 0,
          subscribers: 0,
          activityScore: 45,
          postCount: 1,
          engagementTotal: 45,
          matchedKeywords: [keyword],
          samplePost: seed.samplePost || '',
          rankScore: 0,
          source: seed.source || 'serp',
        });
      }
    });

    const [feedPosts, redditPosts, redditCommunities] = await Promise.all([
      fetchRealFeed({
        keywords: [keyword],
        filters: { platform: platformFilter || 'All', sort: 'relevance' },
        keys,
        allowedPlatforms: allowedPlatforms || new Set(),
      }).catch(() => []),
      platformFilter && platformFilter !== 'Reddit'
        ? Promise.resolve([])
        : searchRedditPosts(keyword, 20),
      platformFilter && platformFilter !== 'Reddit'
        ? Promise.resolve([])
        : searchRedditCommunities(keyword, 15),
    ]);

    let webPosts = [];
    try {
      webPosts = await discoverAllPlatformPosts({
        keyword,
        keys,
        allowedPlatforms: allowedPlatforms || undefined,
        limitPerPlatform: keys?.serpApiKey || keys?.siSerpBaseUrl ? Math.max(limitPerPlatform, 5) : limitPerPlatform,
        platformFilter,
      });
    } catch (e) {
      console.warn('Web discovery:', e.message);
    }

    const allPosts = [...feedPosts, ...redditPosts, ...webPosts];
    postCount += allPosts.length;

    allPosts.forEach((post) => {
      if (post.platform) scannedPlatforms.add(post.platform);
      const seeds = extractTargetsFromPost(post, keyword);
      seeds.forEach((seed) => upsertTarget(targetMap, seed, post, keyword));
    });

    redditCommunities.forEach((t) => {
      scannedPlatforms.add('Reddit');
      const key = targetKey(t.platform, t.type, t.term);
      const existing = targetMap.get(key);
      if (existing) {
        existing.subscribers = Math.max(existing.subscribers || 0, t.subscribers || 0);
        existing.followers = Math.max(existing.followers || 0, t.followers || 0);
        if (!existing.samplePost) existing.samplePost = t.samplePost;
        if (!existing.matchedKeywords.includes(keyword)) existing.matchedKeywords.push(keyword);
      } else {
        targetMap.set(key, { ...t, matchedKeywords: [keyword] });
      }
    });
  }

  await enrichRedditSubscribers(targetMap);

  const targets = finalizeTargets(targetMap, limit);

  return {
    success: true,
    keywords,
    targets,
    postCount,
    scannedPlatforms: [...scannedPlatforms],
  };
}

module.exports = {
  discoverKeywordTargets,
  parseKeywords,
  computeRankScore,
};