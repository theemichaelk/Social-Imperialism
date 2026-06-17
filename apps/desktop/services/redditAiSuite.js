/**
 * Reddit & content AI suite — six rebranded growth modules.
 */
const axios = require('axios');
const reddit = require('./platforms/reddit');

const STORAGE_KEY = 'redditAiSuiteSettings';
const QUEUE_KEY = 'redditAiActionQueue';
const LOG_KEY = 'redditAiSuiteLog';

const MODULES = [
  {
    id: 'subreddit-ascent',
    name: 'Subreddit Ascent',
    icon: 'fa-rocket',
    color: '#f97316',
    tagline: 'Effortless organic Reddit presence — browse, vote, comment, subscribe, and reshare on autopilot.',
    benefits: ['Effortless growth', 'Genuine engagement', 'Increased visibility', 'Reclaim your time'],
  },
  {
    id: 'thread-weaver',
    name: 'Thread Weaver',
    icon: 'fa-comments',
    color: '#38bdf8',
    tagline: 'Turn Reddit conversations into targeted traffic with AI-crafted, link-woven comments.',
    benefits: ['Targeted traffic', 'Spark real discussions', 'Skip manual hunting', 'Brand visibility'],
  },
  {
    id: 'front-page-forge',
    name: 'Front Page Forge',
    icon: 'fa-fire',
    color: '#ef4444',
    tagline: 'Forge scroll-stopping titles and posts engineered for Reddit visibility.',
    benefits: ['More traffic', 'Lively discussions', 'Thought leadership', 'Faster creation'],
  },
  {
    id: 'inbox-echo',
    name: 'Inbox Echo',
    icon: 'fa-inbox',
    color: '#a78bfa',
    tagline: 'Your AI engagement manager — thoughtful replies to mentions even when you are away.',
    benefits: ['Auto replies', 'Stay in the loop', 'Active presence', 'Full control'],
  },
  {
    id: 'headline-bridge',
    name: 'Headline Bridge',
    icon: 'fa-newspaper',
    color: '#10b981',
    tagline: 'Bridge breaking news to Medium — thought-leadership articles that convert readers.',
    benefits: ['Timely articles', 'News-to-narrative', 'Subtle promotion', '24/7 content team'],
  },
  {
    id: 'momentum-lens',
    name: 'Momentum Lens',
    icon: 'fa-chart-line',
    color: '#f59e0b',
    tagline: 'Spot rising trends early and spin them into product ideas and campaign angles.',
    benefits: ['Beat competitors', 'Timely campaigns', 'Less research', 'Hidden niches'],
  },
];

const DEFAULT_SETTINGS = {
  modules: Object.fromEntries(MODULES.map((m) => [m.id, {
    enabled: false,
    autoRun: false,
    requireApproval: true,
  }])),
  subredditAscent: {
    targetSubreddits: 'r/Entrepreneur, r/marketing, r/SaaS',
    upvoteRatio: 0.7,
    commentTemplates: 'Great point — thanks for sharing!\nThis resonates. What worked for you?',
    browsePostsPerRun: 15,
    autoSubscribe: true,
    reshareEnabled: false,
  },
  threadWeaver: {
    promoteUrl: '',
    nicheKeywords: 'social media automation, marketing tools',
    maxThreads: 10,
    tone: 'helpful',
  },
  frontPageForge: {
    contentUrl: '',
    targetSubreddit: 'r/Entrepreneur',
    style: 'informative',
  },
  inboxEcho: {
    monitorSubreddits: '',
    replyStyle: 'friendly',
    autoApprove: false,
  },
  headlineBridge: {
    newsSources: 'tech, business, marketing',
    mediumTone: 'thought-leadership',
    brandAngle: true,
  },
  momentumLens: {
    industries: 'ecommerce, saas, ai',
    productFocus: 'digital tools',
    scanDepth: 'headlines',
  },
};

function loadJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJson(store, key, data) {
  store.setItem(key, JSON.stringify(data));
}

function getSettings(store) {
  const saved = loadJson(store, STORAGE_KEY, {});
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    modules: { ...DEFAULT_SETTINGS.modules, ...(saved.modules || {}) },
    subredditAscent: { ...DEFAULT_SETTINGS.subredditAscent, ...(saved.subredditAscent || {}) },
    threadWeaver: { ...DEFAULT_SETTINGS.threadWeaver, ...(saved.threadWeaver || {}) },
    frontPageForge: { ...DEFAULT_SETTINGS.frontPageForge, ...(saved.frontPageForge || {}) },
    inboxEcho: { ...DEFAULT_SETTINGS.inboxEcho, ...(saved.inboxEcho || {}) },
    headlineBridge: { ...DEFAULT_SETTINGS.headlineBridge, ...(saved.headlineBridge || {}) },
    momentumLens: { ...DEFAULT_SETTINGS.momentumLens, ...(saved.momentumLens || {}) },
  };
}

function saveSettings(store, partial) {
  const merged = { ...getSettings(store), ...partial, updatedAt: new Date().toISOString() };
  saveJson(store, STORAGE_KEY, merged);
  return merged;
}

function appendLog(store, moduleId, message) {
  const log = loadJson(store, LOG_KEY, []);
  log.unshift({ at: new Date().toISOString(), moduleId, message });
  saveJson(store, LOG_KEY, log.slice(0, 40));
}

function enqueueAction(store, action) {
  const queue = loadJson(store, QUEUE_KEY, []);
  queue.unshift({
    id: `rai_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...action,
  });
  saveJson(store, QUEUE_KEY, queue.slice(0, 100));
  return queue[0];
}

function parseSubreddits(raw) {
  return String(raw || '')
    .split(/[,\n]+/)
    .map((s) => s.trim().replace(/^r\//i, ''))
    .filter(Boolean);
}

async function fetchSubredditHot(subreddit, limit = 10) {
  try {
    const res = await axios.get(`https://www.reddit.com/r/${subreddit}/hot.json`, {
      params: { limit },
      headers: { 'User-Agent': 'SocialImperialism/1.0' },
    });
    return (res.data?.data?.children || []).map((c) => {
      const p = c.data;
      return {
        id: p.id,
        title: p.title,
        subreddit: p.subreddit_name_prefixed,
        url: `https://reddit.com${p.permalink}`,
        ups: p.ups,
        num_comments: p.num_comments,
        selftext: (p.selftext || '').slice(0, 400),
      };
    });
  } catch (e) {
    return [];
  }
}

async function runSubredditAscent(store, { generateAI, campaign }) {
  const settings = getSettings(store).subredditAscent;
  const subs = parseSubreddits(settings.targetSubreddits);
  const actions = [];
  const posts = [];

  for (const sub of subs.slice(0, 5)) {
    const hot = await fetchSubredditHot(sub, settings.browsePostsPerRun || 10);
    posts.push(...hot);
  }

  for (const post of posts.slice(0, settings.browsePostsPerRun || 15)) {
    const vote = Math.random() < (settings.upvoteRatio || 0.7) ? 'upvote' : 'downvote';
    actions.push(enqueueAction(store, {
      moduleId: 'subreddit-ascent',
      type: vote,
      postUrl: post.url,
      postTitle: post.title,
      subreddit: post.subreddit,
    }));

    if (settings.commentTemplates) {
      const template = settings.commentTemplates.split('\n').filter(Boolean)[0];
      let comment = template;
      if (generateAI) {
        comment = await generateAI(
          `Write a short, authentic Reddit comment (2-3 sentences) for post titled "${post.title}". Brand: ${campaign?.brandName || 'our brand'}. No spam. Template vibe: ${template}`,
        );
      }
      actions.push(enqueueAction(store, {
        moduleId: 'subreddit-ascent',
        type: 'comment',
        postUrl: post.url,
        postTitle: post.title,
        draft: comment,
        subreddit: post.subreddit,
      }));
    }
  }

  if (settings.autoSubscribe) {
    subs.forEach((sub) => {
      actions.push(enqueueAction(store, {
        moduleId: 'subreddit-ascent',
        type: 'subscribe',
        subreddit: `r/${sub}`,
      }));
    });
  }

  appendLog(store, 'subreddit-ascent', `Queued ${actions.length} actions across ${posts.length} posts`);
  return { success: true, actionsQueued: actions.length, postsScanned: posts.length, posts: posts.slice(0, 8) };
}

async function runThreadWeaver(store, { generateAI, campaign }) {
  const cfg = getSettings(store).threadWeaver;
  const keywords = String(cfg.nicheKeywords || campaign?.domain || 'marketing').split(/[,\n]+/).map((k) => k.trim()).filter(Boolean);
  const threads = [];

  for (const kw of keywords.slice(0, 4)) {
    const found = await reddit.searchPosts(kw, {}, cfg.maxThreads || 8);
    threads.push(...found);
  }

  const unique = [...new Map(threads.map((t) => [t.url, t])).values()].slice(0, cfg.maxThreads || 10);
  const drafts = [];

  for (const thread of unique) {
    const prompt = `Write a natural Reddit comment for thread: "${thread.content}". Subtly mention ${cfg.promoteUrl || campaign?.domain || 'our site'} if relevant. Tone: ${cfg.tone}. No spam, add value first.`;
    const comment = generateAI ? await generateAI(prompt) : 'Draft comment pending AI.';
    const item = enqueueAction(store, {
      moduleId: 'thread-weaver',
      type: 'comment',
      postUrl: thread.url,
      postTitle: thread.content?.slice(0, 120),
      draft: comment,
      subreddit: thread.subreddit,
    });
    drafts.push(item);
  }

  appendLog(store, 'thread-weaver', `Found ${unique.length} threads, drafted ${drafts.length} comments`);
  return { success: true, threads: unique, drafts, count: drafts.length };
}

async function runFrontPageForge(store, { generateAI, campaign }) {
  const cfg = getSettings(store).frontPageForge;
  const url = cfg.contentUrl || campaign?.domain || campaign?.primaryLink || '';
  const prompt = `Create a viral Reddit post for r/${(cfg.targetSubreddit || 'Entrepreneur').replace(/^r\//, '')}.
Content to promote: ${url}
Brand: ${campaign?.brandName || 'Brand'} — ${campaign?.description || ''}
Style: ${cfg.style}
Return JSON with keys: title, body, suggestedFlair, visibilityTips`;
  const raw = generateAI ? await generateAI(prompt) : '{"title":"Draft title","body":"Draft body"}';
  let parsed = { title: 'Draft Reddit Post', body: raw, suggestedFlair: '', visibilityTips: '' };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = { ...parsed, ...JSON.parse(jsonMatch[0]) };
  } catch (e) { parsed.body = raw; }

  const item = enqueueAction(store, {
    moduleId: 'front-page-forge',
    type: 'submit_post',
    subreddit: cfg.targetSubreddit,
    title: parsed.title,
    draft: parsed.body,
    tips: parsed.visibilityTips,
  });

  appendLog(store, 'front-page-forge', `Forged post: ${parsed.title?.slice(0, 60)}`);
  return { success: true, post: parsed, queued: item };
}

async function runInboxEcho(store, { generateAI, campaign }) {
  const cfg = getSettings(store).inboxEcho;
  const keywords = parseSubreddits(cfg.monitorSubreddits).length
    ? parseSubreddits(cfg.monitorSubreddits)
    : ['Entrepreneur', 'marketing'];

  const mentions = [];
  for (const sub of keywords.slice(0, 3)) {
    const hot = await fetchSubredditHot(sub, 5);
    hot.filter((p) => (p.num_comments || 0) > 2).forEach((p) => mentions.push(p));
  }

  const replies = [];
  for (const m of mentions.slice(0, 8)) {
    const prompt = `Draft a ${cfg.replyStyle} Reddit reply to discussion on "${m.title}". Brand voice: ${campaign?.tone || 'helpful'}. 2-4 sentences.`;
    const reply = generateAI ? await generateAI(prompt) : 'Thanks for sharing — great discussion!';
    const item = enqueueAction(store, {
      moduleId: 'inbox-echo',
      type: 'reply',
      postUrl: m.url,
      postTitle: m.title,
      draft: reply,
      subreddit: m.subreddit,
    });
    replies.push(item);
  }

  appendLog(store, 'inbox-echo', `Drafted ${replies.length} notification-style replies`);
  return { success: true, replies, count: replies.length };
}

async function runHeadlineBridge(store, { generateAI, campaign, fetchNews }) {
  const cfg = getSettings(store).headlineBridge;
  let headlines = [];
  if (fetchNews) {
    try {
      const news = await fetchNews(cfg.newsSources || 'technology');
      headlines = (news?.articles || news || []).slice(0, 5).map((a) => a.title || a);
    } catch (e) { /* fallback */ }
  }
  if (!headlines.length) {
    headlines = ['AI transforms marketing automation', 'Social platforms shift algorithm priorities', 'Creators monetize niche communities faster'];
  }

  const articles = [];
  for (const headline of headlines.slice(0, 3)) {
    const prompt = `Turn this headline into a Medium thought-leadership article outline + intro paragraph.
Headline: ${headline}
Brand: ${campaign?.brandName} (${campaign?.domain})
Tone: ${cfg.mediumTone}
${cfg.brandAngle ? 'Subtly weave in product/service value.' : ''}
Return: title, subtitle, intro (3 paragraphs), cta`;
    const body = generateAI ? await generateAI(prompt) : `Article draft for: ${headline}`;
    const item = enqueueAction(store, {
      moduleId: 'headline-bridge',
      type: 'medium_article',
      headline,
      draft: body,
    });
    articles.push({ headline, body, queued: item });
  }

  appendLog(store, 'headline-bridge', `Generated ${articles.length} Medium article drafts`);
  return { success: true, articles, count: articles.length };
}

async function runMomentumLens(store, { generateAI, campaign, fetchNews }) {
  const cfg = getSettings(store).momentumLens;
  let topics = [];
  if (fetchNews) {
    try {
      const news = await fetchNews(cfg.industries || 'business');
      topics = (news?.articles || news || []).slice(0, 8).map((a) => a.title || a);
    } catch (e) { /* ignore */ }
  }
  if (!topics.length) topics = ['AI agents in workflows', 'Short-form video commerce', 'Community-led growth'];

  const prompt = `Analyze these trending topics for ${cfg.industries}:
${topics.join('\n')}
Focus products: ${cfg.productFocus}
Brand context: ${campaign?.brandName || 'startup'}
Return: top 5 trends with momentum score 1-10, why rising, and 2 product ideas each.`;
  const analysis = generateAI ? await generateAI(prompt) : 'Trend analysis pending.';

  const item = enqueueAction(store, {
    moduleId: 'momentum-lens',
    type: 'trend_report',
    draft: analysis,
    topics,
  });

  appendLog(store, 'momentum-lens', 'Generated trend + product idea report');
  return { success: true, analysis, topics, queued: item };
}

const RUNNERS = {
  'subreddit-ascent': runSubredditAscent,
  'thread-weaver': runThreadWeaver,
  'front-page-forge': runFrontPageForge,
  'inbox-echo': runInboxEcho,
  'headline-bridge': runHeadlineBridge,
  'momentum-lens': runMomentumLens,
};

async function runModule(store, moduleId, deps) {
  const runner = RUNNERS[moduleId];
  if (!runner) throw new Error(`Unknown module: ${moduleId}`);
  return runner(store, deps);
}

function getQueue(store, filterModule) {
  const queue = loadJson(store, QUEUE_KEY, []);
  if (!filterModule) return queue;
  return queue.filter((q) => q.moduleId === filterModule);
}

function updateQueueItem(store, id, updates) {
  const queue = loadJson(store, QUEUE_KEY, []);
  const item = queue.find((q) => q.id === id);
  if (!item) return { success: false, error: 'Not found' };
  Object.assign(item, updates, { updatedAt: new Date().toISOString() });
  saveJson(store, QUEUE_KEY, queue);
  return { success: true, item };
}

function getStatus(store) {
  return {
    modules: MODULES,
    settings: getSettings(store),
    queue: getQueue(store).slice(0, 20),
    log: loadJson(store, LOG_KEY, []).slice(0, 15),
    pendingCount: getQueue(store).filter((q) => q.status === 'pending').length,
  };
}

module.exports = {
  MODULES,
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  runModule,
  getQueue,
  updateQueueItem,
  getStatus,
  appendLog,
};