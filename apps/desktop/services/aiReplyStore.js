/**
 * AI Replies hub — normalized records, source taxonomy, filtering & stats.
 */
const REPLY_SOURCES = {
  manual: 'Manual (Feed)',
  keyword: 'Keywords',
  monitor: 'Monitors',
  automation: 'Auto-Rules',
  'automation-flow': 'Visual Builder',
  engagement: 'Engagement Lists',
  qa: 'Q&A Discovery',
  lead: 'Lead Discovery',
  onboarding: 'Setup Wizard',
  'content-hub': 'Content Hub',
};

const SOURCE_ORDER = [
  'manual', 'keyword', 'monitor', 'automation', 'automation-flow',
  'engagement', 'qa', 'lead', 'onboarding', 'content-hub',
];

function normalizeStatus(status) {
  const s = String(status || 'draft').toLowerCase();
  if (s === 'published' || s === 'sent') return 'published';
  if (s === 'saved locally') return 'draft';
  if (s === 'draft') return 'draft';
  return 'draft';
}

function deriveSourceFromLegacy(reply) {
  if (reply.source && REPLY_SOURCES[reply.source]) return reply.source;
  const id = String(reply.id || '');
  if (id.startsWith('flow_')) return 'automation-flow';
  if (id.startsWith('qa_')) return 'qa';
  if (reply.intent === 'qa') return 'qa';
  const label = String(reply.searchLabel || '');
  if (/^(account|page|post):/i.test(label)) return 'monitor';
  if (/^keyword:/i.test(label) || reply.matchedKeyword) return 'keyword';
  if (reply.replyMode || reply.beFirst !== undefined || label) return 'automation';
  return 'manual';
}

function normalizeReply(replyData, fallbackCampaignId) {
  const source = replyData.source || deriveSourceFromLegacy(replyData);
  return {
    id: replyData.id || `reply_${Date.now()}`,
    originalPost: replyData.originalPost || '',
    replyContent: replyData.replyContent || '',
    platform: replyData.platform || 'Unknown',
    timestamp: replyData.timestamp || new Date().toISOString(),
    status: normalizeStatus(replyData.status),
    externalId: replyData.externalId || null,
    url: replyData.url || null,
    author: replyData.author || null,
    campaignId: replyData.campaignId || fallbackCampaignId || 'default',
    intent: replyData.intent || 'brand',
    replyMode: replyData.replyMode || (source === 'manual' || source === 'engagement' ? 'manual' : null),
    matchedKeyword: replyData.matchedKeyword || null,
    searchLabel: replyData.searchLabel || null,
    source,
    sourceLabel: REPLY_SOURCES[source] || source,
    beFirst: !!replyData.beFirst,
    hasUtmLink: !!replyData.hasUtmLink,
    sentiment: replyData.sentiment || null,
    listId: replyData.listId || null,
    listName: replyData.listName || null,
    publishedAt: replyData.publishedAt || null,
    updatedAt: replyData.updatedAt || null,
    rateLimited: !!replyData.rateLimited,
  };
}

function loadAllReplies(store) {
  try {
    return JSON.parse(store.getItem('aiRepliesHistory') || '[]');
  } catch (e) {
    return [];
  }
}

function saveAllReplies(store, replies) {
  store.setItem('aiRepliesHistory', JSON.stringify(replies.slice(0, 500)));
}

function deriveWorkerSource(searchLabel, post) {
  const label = String(searchLabel || '');
  if (/^(account|page|post):/i.test(label)) return 'monitor';
  if (/^keyword:/i.test(label) || post?.matchedKeyword) return 'keyword';
  return 'automation';
}

function getHubStats(replies) {
  const bySource = {};
  const byIntent = {};
  const byReplyMode = {};
  const byPlatform = {};
  const byStatus = { published: 0, draft: 0 };
  const keywords = new Map();

  replies.forEach((r) => {
    const src = r.source || 'manual';
    bySource[src] = (bySource[src] || 0) + 1;
    const intent = r.intent || 'brand';
    byIntent[intent] = (byIntent[intent] || 0) + 1;
    const mode = r.replyMode || 'unspecified';
    byReplyMode[mode] = (byReplyMode[mode] || 0) + 1;
    const plat = r.platform || 'Unknown';
    byPlatform[plat] = (byPlatform[plat] || 0) + 1;
    const st = normalizeStatus(r.status);
    byStatus[st] = (byStatus[st] || 0) + 1;
    if (r.matchedKeyword) {
      keywords.set(r.matchedKeyword, (keywords.get(r.matchedKeyword) || 0) + 1);
    }
  });

  return {
    total: replies.length,
    bySource,
    byIntent,
    byReplyMode,
    byPlatform,
    byStatus,
    keywords: [...keywords.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([term, count]) => ({ term, count })),
  };
}

function filterReplies(replies, filters = {}) {
  const {
    source = 'all',
    intent = 'all',
    platform = 'all',
    status = 'all',
    replyMode = 'all',
    keyword = 'all',
    search = '',
  } = filters;

  const q = String(search || '').trim().toLowerCase();

  return replies.filter((r) => {
    const st = normalizeStatus(r.status);
    const plat = r.platform || 'Unknown';
    const src = r.source || 'manual';
    const intentVal = r.intent || 'brand';
    const mode = r.replyMode || 'unspecified';

    if (source !== 'all' && src !== source) return false;
    if (intent !== 'all' && intentVal !== intent) return false;
    if (status !== 'all' && st !== status) return false;
    if (replyMode !== 'all' && mode !== replyMode) return false;
    if (keyword !== 'all' && (r.matchedKeyword || '') !== keyword) return false;
    if (platform !== 'all' && !plat.includes(platform)) return false;

    if (q) {
      const hay = `${r.originalPost} ${r.replyContent} ${r.author} ${r.matchedKeyword} ${r.searchLabel}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function queryHub(store, filters = {}) {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const campaignScope = filters.campaignId || activeCampaignId;
  const raw = loadAllReplies(store);
  const normalized = raw.map((r) => normalizeReply(r, r.campaignId || activeCampaignId));

  const campaignScoped = campaignScope === 'all'
    ? normalized
    : normalized.filter((r) => !r.campaignId || r.campaignId === campaignScope);

  const replies = filterReplies(campaignScoped, filters);

  return {
    replies,
    stats: getHubStats(replies),
    campaignStats: getHubStats(campaignScoped),
    allStats: getHubStats(normalized),
    activeCampaignId,
    sources: SOURCE_ORDER.map((id) => ({
      id,
      label: REPLY_SOURCES[id],
      count: (getHubStats(campaignScoped).bySource[id] || 0),
    })),
  };
}

function upsertReply(store, replyData, activeCampaignId) {
  const replies = loadAllReplies(store);
  const normalized = normalizeReply(replyData, activeCampaignId);

  if (replyData.id) {
    const idx = replies.findIndex((r) => r.id === replyData.id);
    if (idx >= 0) {
      replies[idx] = { ...normalizeReply(replies[idx], replies[idx].campaignId), ...normalized };
      saveAllReplies(store, replies);
      return replies[idx];
    }
  }

  replies.unshift(normalized);
  saveAllReplies(store, replies);
  return normalized;
}

module.exports = {
  REPLY_SOURCES,
  SOURCE_ORDER,
  normalizeStatus,
  normalizeReply,
  deriveSourceFromLegacy,
  deriveWorkerSource,
  loadAllReplies,
  saveAllReplies,
  getHubStats,
  filterReplies,
  queryHub,
  upsertReply,
};