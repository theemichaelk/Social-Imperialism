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
    id: 'growth-strategist',
    name: 'Reddit Growth Strategist',
    icon: 'fa-chess',
    color: '#22c55e',
    tagline: 'Expert Reddit growth strategist & community manager — 90/10 manual engagement playbook tailored to your brand.',
    benefits: ['Subreddit map', '30-day roadmap', 'Compliance checklist', 'Comment frameworks'],
  },
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
  growthStrategist: {
    productName: '',
    nicheKeywords: 'social media automation, agency growth, lead generation',
    valueProposition: '',
    warmupWeeks: 3,
    includeMockScenarios: true,
  },
};

function buildGrowthStrategistPrompt(cfg, campaign) {
  const productName = cfg.productName || campaign?.brandName || 'Social Imperialism';
  const keywords = cfg.nicheKeywords || campaign?.domain || 'social media automation, agency growth';
  const valueProp = cfg.valueProposition || campaign?.description || 'AI social growth platform for discovery, replies, and publishing.';
  const warmupWeeks = cfg.warmupWeeks || 3;

  return `Role: You are an expert Reddit Growth Strategist and Community Manager. You specialize in organic, high-value, manual engagement that builds trust, avoids spam filters, and signals authority to search engines and AI models.

Context: Reddit's API restricts automated posting. Therefore, we must use a meticulous, manual engagement strategy. Reddit is highly sensitive to self-promotion, meaning our presence must be 90% pure value and 10% highly contextual product mentions.

Objective: Build a complete, customized Reddit & Community Strategy for this business.

My Business Details:
- Name of Product/Site: ${productName}
- Core Niche / Keywords: ${keywords}
- Main Value Proposition: ${valueProp}

---
STRATEGY GUIDELINES TO IMPLEMENT:

1. TARGET SUBREDDIT IDENTIFICATION
- Brainstorm and list 10-15 specific subreddits fitting our niche.
- Filter these into categories (e.g., General Business, Tech-Specific, Niche/Pain-Point specific).
- Ensure targets fit the "sweet spot" of 5k–500k subscribers for maximum visibility and indexation.

2. THE 90/10 VALUE FRAMEWORK
- Map out exactly what a ${warmupWeeks}-4 week "Warm-Up Phase" looks like (pure helper mode).
- Create 3 distinct frameworks or template structures for how we will answer user questions using real experience, not a homepage pitch.
- Provide examples of how to subtly mention our product as "one option among several" without sounding like an ad.

3. THREAD TRIAGE & SELECTION
- Define the exact operational criteria for a "high-worth thread" (Age under 48 hours, specific title structures, low-quality existing answers).
- Explain step-by-step how to daily audit these subreddits by sorting by "New".

4. COMPLIANCE & RISK MITIGATION
- Detail a checklist of "Red Flags" our team must never cross (link-bombing, alt-account manipulation, lack of affiliate disclosure).
- Explain how to review and adapt to individual subreddit rules.

---
OUTPUT REQUIRED:
Output a highly structured, operational playbook in Markdown. Include:
1. A List of Recommended Subreddits to audit immediately (with category, estimated size band, and why each fits).
2. A 30-Day Content & Engagement Roadmap (Phase 1: Trust Building, Phase 2: Contextual Mentioning — week-by-week actions).
${cfg.includeMockScenarios !== false ? `3. Three Mock Comment Scenarios showing a "Bad/Spammy" response versus an "Intelligent/High-Value" response using our business details (${productName}, keywords: ${keywords}).` : '3. (Skip mock comment scenarios — operator requested playbook only.)'}

Be specific, operational, and ready for a human operator to execute tomorrow. No generic filler.`;
}

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
    growthStrategist: { ...DEFAULT_SETTINGS.growthStrategist, ...(saved.growthStrategist || {}) },
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

function actionSummary(item) {
  const parts = [
    item.type,
    item.subreddit,
    item.postTitle,
    item.draft,
  ].filter(Boolean);
  return parts.join(' · ').slice(0, 280);
}

function enqueueAction(store, action) {
  const queue = loadJson(store, QUEUE_KEY, []);
  const existing = queue.find((q) => q.status === 'pending'
    && q.moduleId === action.moduleId
    && q.type === action.type
    && (q.postUrl || '') === (action.postUrl || '')
    && (q.subreddit || '') === (action.subreddit || ''));
  if (existing) return existing;

  const item = {
    id: `rai_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
    content: '',
    ...action,
  };
  item.content = actionSummary(item);
  queue.unshift(item);
  saveJson(store, QUEUE_KEY, queue.slice(0, 100));
  return item;
}

function parseSubreddits(raw) {
  return String(raw || '')
    .split(/[,\n]+/)
    .map((s) => s.trim().replace(/^r\//i, ''))
    .filter(Boolean);
}

async function fetchSubredditHot(subreddit, limit = 10) {
  try {
    const res = await axios.get(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot.json`, {
      params: { limit, raw_json: 1 },
      headers: { 'User-Agent': 'SocialImperialism/1.2 (by /u/socialimperialism)' },
      timeout: 12000,
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

  if (!posts.length) {
    const msg = subs.length
      ? `No posts fetched from ${subs.slice(0, 3).map((s) => `r/${s}`).join(', ')} — Reddit may be rate-limiting. Wait and retry.`
      : 'Add target subreddits (e.g. r/Entrepreneur) before running.';
    appendLog(store, 'subreddit-ascent', msg);
    return { success: false, error: msg, actionsQueued: 0, postsScanned: 0 };
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

async function runGrowthStrategist(store, { generateAI, campaign }) {
  const cfg = getSettings(store).growthStrategist;
  const productName = cfg.productName || campaign?.brandName || '';
  const keywords = String(cfg.nicheKeywords || '').trim();
  const valueProp = cfg.valueProposition || campaign?.description || '';

  if (!productName && !campaign?.brandName) {
    const msg = 'Add your product/site name (or set brand in Campaign Command) before running.';
    appendLog(store, 'growth-strategist', msg);
    return { success: false, error: msg, actionsQueued: 0 };
  }
  if (!keywords) {
    const msg = 'Add 3–5 core niche keywords before running.';
    appendLog(store, 'growth-strategist', msg);
    return { success: false, error: msg, actionsQueued: 0 };
  }
  if (!valueProp) {
    const msg = 'Add a one-sentence value proposition before running.';
    appendLog(store, 'growth-strategist', msg);
    return { success: false, error: msg, actionsQueued: 0 };
  }

  const prompt = buildGrowthStrategistPrompt(cfg, campaign);
  const playbook = generateAI
    ? await generateAI(prompt)
    : `# Reddit Growth Playbook\n\nPending AI — configure OpenRouter/Gemini keys in Settings.\n\nProduct: ${productName}\nKeywords: ${keywords}`;

  const item = enqueueAction(store, {
    moduleId: 'growth-strategist',
    type: 'strategy_playbook',
    postTitle: `Reddit Growth Playbook — ${productName || campaign?.brandName}`,
    draft: playbook,
    subreddit: 'strategy',
  });

  saveSettings(store, {
    growthStrategist: {
      ...cfg,
      lastPlaybookAt: new Date().toISOString(),
      lastPlaybookId: item.id,
    },
  });

  appendLog(store, 'growth-strategist', `Generated Reddit growth playbook for ${productName || campaign?.brandName}`);
  return { success: true, playbook, queued: item, actionsQueued: 1 };
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
  'growth-strategist': runGrowthStrategist,
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

function getQueue(store, filterModule, options = {}) {
  let queue = loadJson(store, QUEUE_KEY, []);
  if (filterModule) queue = queue.filter((q) => q.moduleId === filterModule);
  if (options.status) queue = queue.filter((q) => q.status === options.status);
  return queue.map((q) => ({
    ...q,
    content: q.content || actionSummary(q),
    action: q.type,
  }));
}

function clearQueue(store, filter = {}) {
  const queue = loadJson(store, QUEUE_KEY, []);
  const kept = queue.filter((q) => {
    if (filter.moduleId && q.moduleId !== filter.moduleId) return true;
    if (filter.status && q.status !== filter.status) return true;
    return false;
  });
  const removed = queue.length - kept.length;
  saveJson(store, QUEUE_KEY, kept);
  return { success: true, removed, count: kept.length };
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
  buildGrowthStrategistPrompt,
  getSettings,
  saveSettings,
  runModule,
  getQueue,
  clearQueue,
  updateQueueItem,
  getStatus,
  appendLog,
  actionSummary,
};