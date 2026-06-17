const { resolveKeys } = require('./keys');
const { shouldRunOnSchedule, markScheduleRun } = require('./scheduleIntervals');
const brandGuidelines = require('./brandGuidelines');
const { normalizePlatform } = require('./platformCatalog');
const { hasTwitterKeys, hasRedditKeys, hasLinkedInKeys, hasMetaKeys } = require('./keys');

const INDUSTRY_PROMPTS = {
  ecommerce: 'Focus on returns, shipping delays, restocks, and order status. Be empathetic and solution-oriented.',
  finance: 'Use compliance-safe language. Never give specific financial advice. Escalate fraud and security concerns immediately.',
  automotive: 'Address service appointments, recalls, warranty questions, and sales inquiries with clear next steps.',
  general: 'Maintain professional, helpful brand voice across all interactions.',
};

function loadJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function filterAccounts(rules, linkedAccounts) {
  if (!linkedAccounts?.length) return [];
  let pool = linkedAccounts.filter((a) => a.settings?.automationEnabled !== false);
  if (rules?.activeAccountIds?.length) {
    const filtered = pool.filter((a) => rules.activeAccountIds.includes(a.id));
    return filtered.length ? filtered : pool;
  }
  return pool;
}

function isMentionPost(post, campaign) {
  const brand = (campaign.brandName || '').toLowerCase();
  const content = (post.content || '').toLowerCase();
  return content.includes('@') || (brand && content.includes(brand)) || content.includes('mention');
}

function isDmPost(post) {
  const channel = String(post.channel || post.type || '').toLowerCase();
  const url = String(post.url || '').toLowerCase();
  return post.isDm === true
    || channel.includes('dm')
    || channel.includes('direct message')
    || channel.includes('inbox')
    || url.includes('/messages/')
    || url.includes('/inbox/');
}

function resolveReplyMode(rules, post) {
  const platform = normalizePlatform(post?.platform);
  const overrides = rules?.platformReplyModes || {};
  const override = overrides[platform];
  if (override && override !== 'inherit') return override;
  return rules?.autoReplyMode || 'mentions_only';
}

function shouldPublishReply(rules, post, campaign) {
  if (!rules?.autoReplyEnabled) return false;
  const mode = resolveReplyMode(rules, post);
  if (mode === 'manual_approval') return false;
  if (mode === 'auto_post_all') return true;
  if (mode === 'mentions_only') return isMentionPost(post, campaign) || isDmPost(post);
  return false;
}

function buildDiversificationBlock(history, rules) {
  if (rules?.diversifyResponses === false) return '';
  const recent = (history || []).slice(0, 8).map((r) => r.replyContent).filter(Boolean);
  if (!recent.length) return '';
  const snippets = recent.map((t, i) => `${i + 1}. "${String(t).substring(0, 80)}..."`).join('\n');
  return `\nDIVERSIFICATION: Do NOT repeat phrasing from these recent replies. Vary openings, structure, and CTAs:\n${snippets}\n`;
}

function getRateLimitState(store) {
  return loadJson(store, 'accountRateLimitState', {});
}

function checkAccountRateLimit(store, accountId, rules) {
  const maxPerHour = rules?.rateLimitPerAccount ?? rules?.maxRepliesPerHour;
  if (!maxPerHour || maxPerHour <= 0) return { allowed: true };
  const state = getRateLimitState(store);
  const now = Date.now();
  const bucket = (state[accountId] || []).filter((t) => now - t < 3600000);
  if (bucket.length >= maxPerHour) {
    return { allowed: false, reason: 'rate_limit', retryAfterMs: 3600000 - (now - bucket[0]) };
  }
  return { allowed: true };
}

function recordAccountReply(store, accountId) {
  if (!accountId) return;
  const state = getRateLimitState(store);
  const now = Date.now();
  const bucket = (state[accountId] || []).filter((t) => now - t < 3600000);
  bucket.push(now);
  state[accountId] = bucket;
  store.setItem('accountRateLimitState', JSON.stringify(state));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPublishDelayMs(rules, account) {
  const min = account?.settings?.humanDelayMin ?? rules?.publishDelayMin ?? 2;
  const max = account?.settings?.humanDelayMax ?? rules?.publishDelayMax ?? 45;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(Math.random() * (hi - lo + 1) + lo) * 1000;
}

function buildReplyPrompt(campaign, post, rules, store = null, recentHistory = []) {
  const campaignId = store?.getItem('activeCampaignId') || 'default';
  const keywordObj = brandGuidelines.getKeywordFromStore(store, campaignId, post.matchedKeyword);
  const industry = INDUSTRY_PROMPTS[rules?.industryRouting] || INDUSTRY_PROMPTS.general;
  const diversify = buildDiversificationBlock(recentHistory, rules);
  return `${brandGuidelines.buildReplySystemPrompt(campaign, { keywordObj, rules })}
Industry context: ${industry}
${diversify}Post by ${post.author}: "${post.content}"
Return ONLY the reply text.`;
}

async function moderatePost(generateAI, post, rules) {
  const needsMod = rules?.modSpamBot || rules?.modOffensive || rules?.modEscalation;
  if (!needsMod) return { pass: true, sentiment: 'neutral' };

  const prompt = `Analyze this social media post for moderation. Return ONLY valid JSON:
{"spam":boolean,"offensive":boolean,"crisis":boolean,"sentiment":"positive"|"negative"|"neutral"|"question"}
Post: "${(post.content || '').substring(0, 500)}"`;

  try {
    const raw = await generateAI(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    if (rules.modSpamBot && parsed.spam) return { pass: false, reason: 'spam', sentiment: parsed.sentiment };
    if (rules.modOffensive && parsed.offensive) return { pass: false, reason: 'offensive', sentiment: parsed.sentiment };
    if (rules.modEscalation && parsed.crisis) {
      return { pass: false, reason: 'crisis', escalate: true, sentiment: parsed.sentiment };
    }
    return { pass: true, sentiment: parsed.sentiment || 'neutral' };
  } catch (e) {
    return { pass: true, sentiment: 'neutral' };
  }
}

async function draftReplyForPost(generateAI, campaign, post, rules, isNegative = false, store = null, recentHistory = []) {
  if (isNegative && rules?.autoReplyNegative) {
    const prompt = `Write a brief, empathetic apology reply (max 280 chars) from "${campaign.brandName}" addressing this concern:
"${post.content}"
Return ONLY the reply text.`;
    return generateAI(prompt);
  }
  return generateAI(buildReplyPrompt(campaign, post, rules, store, recentHistory));
}

async function applyEngagementActions({ post, replyText, rules, keys, linkedAccounts, engagePost, store, pushTask }) {
  const accounts = filterAccounts(rules, linkedAccounts);
  if (!accounts.length) return;
  const engageAccount = accounts.find((a) => a.platform === post.platform || a.platform?.includes(post.platform)) || accounts[0];

  if (rules?.autoLike) {
    try {
      await engagePost(
        { action: 'like', platform: post.platform, externalId: post.externalId, postId: post.externalId, accountId: engageAccount?.id },
        keys,
        accounts,
        rules,
        store
      );
      pushTask(store, 'Auto-liked match', post.platform);
    } catch (e) {
      console.error('Auto-like failed:', e.message);
    }
  }

  if (rules?.autoShare) {
    try {
      await engagePost(
        { action: 'share', platform: post.platform, externalId: post.externalId, postId: post.externalId, accountId: engageAccount?.id },
        keys,
        accounts,
        rules,
        store
      );
      pushTask(store, 'Auto-shared/retweeted match', post.platform);
    } catch (e) {
      console.error('Auto-share failed:', e.message);
    }
  }

  if (rules?.autoFollow && post.author) {
    try {
      await engagePost(
        { action: 'follow', platform: post.platform, author: post.author, externalId: post.externalId, accountId: engageAccount?.id },
        keys,
        accounts,
        rules,
        store
      );
      pushTask(store, `Auto-follow ${post.author}`, post.platform);
    } catch (e) {
      pushTask(store, `Follow skipped (${post.platform} API)`, post.platform);
    }
  }
}

function syncRulesSideEffects(store, rules) {
  const autoContent = loadJson(store, 'autoContentSettings', {
    enabled: false, rssUrls: [], targetAccountIds: [], frequency: 'daily',
  });

  if (rules.fbAutoPost || rules.fbHandsFree) {
    autoContent.enabled = true;
    if (rules.activeAccountIds?.length) {
      autoContent.targetAccountIds = rules.activeAccountIds;
    }
    if (rules.frequency === 'realtime' || rules.frequency === '5m') autoContent.frequency = 'realtime';
    else if (rules.frequency === '15m' || rules.frequency === '10m') autoContent.frequency = 'hourly';
    else autoContent.frequency = 'daily';
  } else if (!rules.fbAutoPost && !rules.fbHandsFree) {
    autoContent.enabled = autoContent.enabled && !!(autoContent.rssUrls?.length);
  }

  store.setItem('autoContentSettings', JSON.stringify(autoContent));

  const autoSearch = loadJson(store, 'autoSearchSettings', { dailyEnabled: true, frequency: 'daily' });
  autoSearch.dailyEnabled = rules.oneClickAutoSearchEnabled !== false;
  autoSearch.frequency = rules.autoSearchFrequency || rules.frequency || autoSearch.frequency || 'daily';
  store.setItem('autoSearchSettings', JSON.stringify(autoSearch));

  store.setItem('autoRulesLastSaved', new Date().toISOString());
}

function shouldRunKeywordDiscovery(store, rules) {
  if (!rules?.enabled) return false;
  if (rules.oneClickAutoSearchEnabled === false) return false;
  const freq = rules.autoSearchFrequency || rules.frequency || 'daily';
  return shouldRunOnSchedule(store, 'autoRulesDailySearchLastRun', freq);
}

function shouldRunBeFirstMonitors(store, rules) {
  if (!rules?.enabled) return false;
  if (rules.realTimeMonitoringEnabled === false) return false;
  const freq = rules.beFirstMonitorFrequency || rules.frequency || '10m';
  return shouldRunOnSchedule(store, 'beFirstMonitorLastRun', freq);
}

function markDailySearchRun(store) {
  markScheduleRun(store, 'autoRulesDailySearchLastRun');
}

function markBeFirstMonitorRun(store) {
  markScheduleRun(store, 'beFirstMonitorLastRun');
}

function getApiStatus(keys) {
  return {
    twitter: hasTwitterKeys(keys),
    reddit: hasRedditKeys(keys),
    linkedin: hasLinkedInKeys(keys),
    meta: hasMetaKeys(keys),
    serp: !!keys.serpApiKey,
    ai: !!(keys.gemini || keys.openai || keys.openrouter),
    slack: !!keys.slackWebhook,
    discord: !!keys.discordWebhook,
  };
}

function getAutoRulesStatus(store) {
  const rules = loadJson(store, 'autoRulesEngine', {});
  const keys = resolveKeys(loadJson(store, 'globalApiKeys', {}));
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const keywords = loadJson(store, 'keywords', []).filter((k) => k.campaignId === activeCampaignId);
  const accounts = loadJson(store, `linkedAccounts_${activeCampaignId}`, []);
  const tasks = loadJson(store, 'workerTasks', []).slice(0, 8);
  const workerRunning = store.getItem('workerRunningFlag') === 'true';
  const draftCount = parseInt(store.getItem('aiDraftsCount') || '0', 10);
  const lastSaved = store.getItem('autoRulesLastSaved');

  return {
    rules,
    enabled: !!rules.enabled,
    workerRunning,
    recentTasks: tasks,
    apiStatus: getApiStatus(keys),
    keywordCount: keywords.length,
    accountCount: accounts.length,
    activeAccountCount: rules.activeAccountIds?.length || 0,
    draftCount,
    lastSaved,
    monitorsCount: loadJson(store, 'watchedMonitors', []).length,
  };
}

module.exports = {
  filterAccounts,
  shouldPublishReply,
  resolveReplyMode,
  buildReplyPrompt,
  buildDiversificationBlock,
  moderatePost,
  draftReplyForPost,
  applyEngagementActions,
  syncRulesSideEffects,
  shouldRunKeywordDiscovery,
  shouldRunBeFirstMonitors,
  markDailySearchRun,
  markBeFirstMonitorRun,
  getAutoRulesStatus,
  getApiStatus,
  isMentionPost,
  isDmPost,
  checkAccountRateLimit,
  recordAccountReply,
  getPublishDelayMs,
  sleep,
};