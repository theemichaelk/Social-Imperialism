const axios = require('axios');
const { fetchRealFeed } = require('./feedFetcher');
const { resolveKeys } = require('./keys');
const { engagePost } = require('./engagement');
const { publishPost } = require('./publisher');
const { parseTokens } = require('./intelligenceProfile');
const autoRules = require('./autoRulesEngine');

const UA = 'SocialImperialism/1.0';

function getSeenKey(post) {
  return `${post.platform}:${post.externalId || post.url || post.content?.substring(0, 80)}`;
}

function loadSeen(store) {
  try {
    return new Set(JSON.parse(store.getItem('workerSeenPosts') || '[]'));
  } catch (e) {
    return new Set();
  }
}

function saveSeen(store, seen) {
  const arr = Array.from(seen).slice(-500);
  store.setItem('workerSeenPosts', JSON.stringify(arr));
}

function pushTask(store, action, platform) {
  let tasks = [];
  try { tasks = JSON.parse(store.getItem('workerTasks') || '[]'); } catch (e) {}
  tasks.unshift({ time: new Date().toLocaleTimeString(), action, platform });
  store.setItem('workerTasks', JSON.stringify(tasks.slice(0, 15)));
}

function incrementDrafts(store) {
  const count = parseInt(store.getItem('aiDraftsCount') || '0', 10) + 1;
  store.setItem('aiDraftsCount', String(count));
}

function isBeFirstMonitor(searchLabel) {
  const label = String(searchLabel || '').toLowerCase();
  return label.startsWith('account:') || label.startsWith('page:') || label.startsWith('post:');
}

function resolveReplyIntent(store, campaignId, post) {
  const keywordObj = require('./brandGuidelines').getKeywordFromStore(store, campaignId, post.matchedKeyword);
  const intent = keywordObj?.intent || 'mentions';
  if (intent === 'affiliate') return 'affiliate';
  if (intent === 'client') return 'client';
  if (intent === 'qa') return 'qa';
  return 'brand';
}

async function processPostMatch({
  store, generateAI, keys, campaign, rules, linkedAccounts, sendNotification,
  post, processed, history, seen, searchLabel,
}) {
  const key = getSeenKey(post);
  if (seen.has(key)) return processed;

  const alreadyReplied = history.some(
    (r) => r.externalId === post.externalId || r.originalPost === post.content
  );
  if (alreadyReplied) {
    seen.add(key);
    return processed;
  }

  const beFirst = isBeFirstMonitor(searchLabel);
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const replyMode = autoRules.resolveReplyMode(rules, post);

  if (beFirst) {
    await sendNotification(
      'Be First Alert — New Post Detected',
      `${post.platform} | ${post.author || 'Unknown'}\n"${(post.content || '').substring(0, 200)}"\nMonitor: ${searchLabel}\nMode: ${replyMode === 'manual_approval' ? 'Draft queued — approve in AI Replies' : 'Auto-reply drafting...'}`
    );
  }

  const mod = await autoRules.moderatePost(generateAI, post, rules);
  if (!mod.pass) {
    if (mod.escalate && rules?.modEscalation) {
      await sendNotification(
        'Crisis Escalation — Immediate Review',
        `${post.platform} | ${post.author}\n"${(post.content || '').substring(0, 200)}"\nReason: ${mod.reason}`
      );
      pushTask(store, `Crisis escalated (${mod.reason})`, post.platform);
    } else {
      pushTask(store, `Filtered ${mod.reason} content`, post.platform);
    }
    seen.add(key);
    return processed;
  }

  const isNegative = mod.sentiment === 'negative';
  if (isNegative && rules?.alertNegative) {
    await sendNotification(
      'Negative Sentiment Detected',
      `${post.platform} | ${post.author}\n"${(post.content || '').substring(0, 200)}"`
    );
  }

  let replyText;
  try {
    replyText = await autoRules.draftReplyForPost(generateAI, campaign, post, rules, isNegative, store, history);
  } catch (e) {
    replyText = `Hi! ${campaign.brandName} can help with that. Learn more at ${campaign.domain || 'our site'}.`;
  }

  const replyIntent = resolveReplyIntent(store, activeCampaignId, post);
  const domain = campaign.domain || '';
  const hasUtm = domain && replyText.toLowerCase().includes(domain.toLowerCase());

  const aiReplyStore = require('./aiReplyStore');
  const entry = {
    id: `reply_${Date.now()}_${processed}`,
    originalPost: post.content,
    replyContent: replyText,
    platform: post.platform,
    externalId: post.externalId,
    url: post.url,
    author: post.author,
    matchedKeyword: post.matchedKeyword,
    timestamp: new Date().toISOString(),
    status: 'draft',
    sentiment: mod.sentiment,
    campaignId: activeCampaignId,
    intent: replyIntent,
    replyMode,
    beFirst,
    hasUtmLink: hasUtm,
    searchLabel,
    source: aiReplyStore.deriveWorkerSource(searchLabel, post),
  };

  const accounts = autoRules.filterAccounts(rules, linkedAccounts);
  const shouldPublish = autoRules.shouldPublishReply(rules, post, campaign);

  if (shouldPublish) {
    const engageAccount = accounts.find((a) => a.platform === post.platform || a.platform?.includes(post.platform)) || accounts[0];
    const rateCheck = autoRules.checkAccountRateLimit(store, engageAccount?.id, rules);
    if (!rateCheck.allowed) {
      entry.status = 'draft';
      entry.rateLimited = true;
      pushTask(store, `Rate limit — draft saved for "${searchLabel}"`, post.platform);
      await sendNotification(
        'Rate Limit — Reply Queued',
        `${post.platform}: Account hit hourly reply cap. Draft saved for manual approval.`
      );
    } else {
      try {
        if (rules?.beFirstDelay !== false || beFirst) {
          const delayMs = autoRules.getPublishDelayMs(rules, engageAccount);
          await autoRules.sleep(delayMs);
        }
        await engagePost(
          {
            action: 'reply',
            platform: post.platform,
            externalId: post.externalId,
            postId: post.externalId,
            content: replyText,
            accountId: engageAccount?.id,
          },
          keys,
          accounts,
          rules,
          store
        );
        autoRules.recordAccountReply(store, engageAccount?.id);
        entry.status = 'published';
        entry.publishedAt = new Date().toISOString();
        pushTask(store, `Auto-replied (${searchLabel})`, post.platform);
      } catch (e) {
        console.error('Auto-reply failed:', e.message);
        pushTask(store, `Drafted reply (publish failed) for "${searchLabel}"`, post.platform);
      }
    }
  } else {
    pushTask(store, `Drafted reply for "${searchLabel}"`, post.platform);
    if (replyMode === 'manual_approval' && rules?.fastApprovalNotify !== false) {
      await sendNotification(
        'Approval Required — Fast Review',
        `${post.platform} | ${post.author || 'Unknown'}\n"${(post.content || '').substring(0, 120)}..."\n\nDraft ready in AI Replies hub.`
      );
    }
  }

  await autoRules.applyEngagementActions({
    post, replyText, rules, keys, linkedAccounts: accounts, engagePost, store, pushTask,
  });

  if (rules?.modCommunity !== false && mod.sentiment !== 'negative') {
    await sendNotification(
      'New Match — Reply Queue',
      `${post.platform} | ${post.author}\n"${(post.content || '').substring(0, 120)}..."\n\nDraft: ${replyText}`
    );
  }

  history.unshift(entry);
  seen.add(key);
  incrementDrafts(store);
  return processed + 1;
}

async function processWatchedMonitors({ store, generateAI, keys, campaign, watched, rules, linkedAccounts, sendNotification }) {
  if (!watched.length) return 0;

  let processed = 0;
  const seen = loadSeen(store);
  let history = [];
  try { history = JSON.parse(store.getItem('aiRepliesHistory') || '[]'); } catch (e) {}

  for (const monitor of watched) {
    const monitorType = monitor.type || monitor.target || 'keyword';
    let searchTerm = monitor.term || campaign.brandName;
    const platformFilter = monitor.platform && monitor.platform !== 'All' ? monitor.platform : null;

    if (monitorType === 'account') {
      searchTerm = searchTerm.startsWith('@') ? searchTerm : `@${searchTerm}`;
    }

    const posts = await fetchRealFeed({
      keywords: [searchTerm.replace(/^@/, '')],
      filters: { platform: platformFilter || 'All', sort: 'recent' },
      keys,
      allowedPlatforms: new Set(platformFilter ? [platformFilter] : []),
    });

    let filtered = posts;
    if (monitorType === 'account') {
      const handle = (monitor.term || '').replace(/^@/, '').toLowerCase();
      filtered = posts.filter((p) => (p.author || '').toLowerCase().includes(handle));
    } else if (monitorType === 'page') {
      const page = (monitor.term || '').toLowerCase();
      filtered = posts.filter(
        (p) => (p.author || '').toLowerCase().includes(page)
          || (p.content || '').toLowerCase().includes(page)
      );
    } else if (monitorType === 'post') {
      if (monitor.url) {
        filtered = posts.filter((p) => p.url === monitor.url);
      } else {
        const snippet = (monitor.term || '').toLowerCase();
        filtered = posts.filter((p) => (p.content || '').toLowerCase().includes(snippet));
      }
    }

    for (const post of filtered) {
      processed = await processPostMatch({
        store, generateAI, keys, campaign, rules, linkedAccounts, sendNotification,
        post, processed, history, seen, searchLabel: `${monitorType}:${searchTerm}`,
      });
    }
  }

  store.setItem('aiRepliesHistory', JSON.stringify(history.slice(0, 200)));
  saveSeen(store, seen);
  return processed;
}

async function processKeywordDiscovery({ store, generateAI, keys, campaign, rules, linkedAccounts, sendNotification }) {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let keywords = [];
  try {
    keywords = JSON.parse(store.getItem('keywords') || '[]')
      .filter((k) => k.campaignId === activeCampaignId)
      .map((k) => k.term);
  } catch (e) {}

  if (!keywords.length) keywords = [campaign.brandName || 'marketing'];

  const seen = loadSeen(store);
  const posts = await fetchRealFeed({ keywords, filters: {}, keys, allowedPlatforms: new Set() });
  let processed = 0;

  let history = [];
  try { history = JSON.parse(store.getItem('aiRepliesHistory') || '[]'); } catch (e) {}

  for (const post of posts.slice(0, 5)) {
    const before = processed;
    processed = await processPostMatch({
      store, generateAI, keys, campaign, rules, linkedAccounts, sendNotification,
      post, processed, history, seen, searchLabel: post.matchedKeyword || 'keyword',
    });
    if (processed > before) {
      pushTask(store, `Discovered keyword match on ${post.platform}`, post.platform);
    }
  }

  if (processed > 0) {
    store.setItem('aiRepliesHistory', JSON.stringify(history.slice(0, 200)));
    saveSeen(store, seen);
  }

  return processed;
}

async function scanUnansweredQuestions(store, keys, campaign, generateAI) {
  const qaDiscovery = require('./qaDiscovery');
  const questions = await qaDiscovery.discoverQuestions(store, keys, campaign, generateAI);
  pushTask(store, `Q&A discovery: ${questions.length} ranked questions`, 'Multi');
  return questions;
}

async function runRedditProspector(store, keys, campaign) {
  const brand = campaign.brandName || 'saas';
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let keywords = [];
  try {
    keywords = JSON.parse(store.getItem('keywords') || '[]')
      .filter((k) => k.campaignId === activeCampaignId)
      .map((k) => k.term);
  } catch (e) {}

  const query = keywords[0] || brand;
  const leads = [];

  try {
    const res = await axios.get('https://www.reddit.com/search.json', {
      params: { q: query, limit: 15, sort: 'new' },
      headers: { 'User-Agent': UA },
      timeout: 15000,
    });

    (res.data?.data?.children || []).forEach((child) => {
      const p = child.data;
      const intent = (p.title || '').toLowerCase();
      const isLead = intent.includes('recommend') || intent.includes('best') || intent.includes('alternative') || intent.includes('help') || intent.includes('?');
      if (isLead) {
        leads.push({
          platform: `Reddit / ${p.subreddit_name_prefixed}`,
          author: `u/${p.author}`,
          content: p.title,
          ups: p.ups,
          url: `https://reddit.com${p.permalink}`,
          externalId: p.id,
          score: (p.ups || 0) + (p.num_comments || 0) * 2,
          timestamp: new Date(p.created_utc * 1000).toISOString(),
        });
      }
    });
  } catch (e) {
    console.error('Reddit prospector error:', e.message);
    try {
      const { discoverRedditPosts } = require('./webDiscovery');
      const hits = await discoverRedditPosts(query, keys, 15);
      hits.forEach((p) => {
        const intent = (p.content || '').toLowerCase();
        const isLead = intent.includes('recommend') || intent.includes('best') || intent.includes('alternative') || intent.includes('help') || intent.includes('?');
        if (isLead) {
          leads.push({
            platform: 'Reddit',
            author: p.author || 'Reddit',
            content: p.content,
            ups: 0,
            url: p.url,
            externalId: p.externalId,
            score: 10,
            timestamp: new Date().toISOString(),
          });
        }
      });
    } catch (err) {
      console.error('Reddit prospector web fallback:', err.message);
    }
  }

  leads.sort((a, b) => b.score - a.score);
  store.setItem('leads', JSON.stringify(leads.slice(0, 50)));
  pushTask(store, `Reddit Prospector: ${leads.length} leads`, 'Reddit');
  return leads;
}

async function runWorkerCycle(deps) {
  const { store, generateAI, sendNotification } = deps;
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));

  let campaign = { brandName: 'Your Brand', audience: 'Your Audience' };
  try {
    campaign = JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeCampaignId) || campaign;
  } catch (e) {}

  let rules = null;
  try { rules = JSON.parse(store.getItem('autoRulesEngine') || 'null'); } catch (e) {}

  if (!rules?.enabled) {
    return { monitorCount: 0, discoveryCount: 0, skipped: true, reason: 'Auto-rules disabled' };
  }

  const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeCampaignId}`) || '[]');
  let watched = [];
  try { watched = JSON.parse(store.getItem('watchedMonitors') || '[]'); } catch (e) {}

  let monitorCount = 0;
  if (watched.length > 0 && autoRules.shouldRunBeFirstMonitors(store, rules)) {
    monitorCount = await processWatchedMonitors({
      store, generateAI, keys, campaign, watched, rules, linkedAccounts, sendNotification,
    });
    autoRules.markBeFirstMonitorRun(store);
  }

  let discoveryCount = 0;
  if (autoRules.shouldRunKeywordDiscovery(store, rules)) {
    discoveryCount = await processKeywordDiscovery({
      store, generateAI, keys, campaign, rules, linkedAccounts, sendNotification,
    });
    autoRules.markDailySearchRun(store);
  }

  if (monitorCount + discoveryCount > 0) {
    console.log(`Worker cycle: ${monitorCount} monitor matches, ${discoveryCount} keyword discoveries`);
  }

  return { monitorCount, discoveryCount };
}

module.exports = {
  runWorkerCycle,
  scanUnansweredQuestions,
  runRedditProspector,
  processWatchedMonitors,
  processKeywordDiscovery,
};