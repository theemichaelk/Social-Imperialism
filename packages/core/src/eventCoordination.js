/**
 * Cross-feature coordination — wires domain events to notifications, webhooks, and recipes.
 */
const path = require('path');
const eventBus = require('./eventBus');

const NOTIFICATION_MAP = {
  'post.published': (d) => ({
    type: 'publish',
    title: 'Post Published',
    body: `${d.platform || 'Social'}: ${(d.content || '').slice(0, 120)}`,
    link: '/history',
  }),
  'post.scheduled': (d) => ({
    type: 'schedule',
    title: 'Post Scheduled',
    body: `${d.platform || 'Social'} at ${d.timestamp || d.scheduleTime || 'soon'}`,
    link: '/calendar',
  }),
  'keyword.matched': (d) => ({
    type: 'keyword',
    title: 'Keyword Match',
    body: `${d.matchedKeyword || d.topic || 'New post'} on ${d.platform || 'feed'}`,
    link: '/browse-posts',
  }),
  'reply.generated': (d) => ({
    type: 'reply',
    title: 'AI Reply Drafted',
    body: `${d.platform || 'Social'}: ${(d.preview || d.replyContent || '').slice(0, 100)}`,
    link: '/history',
  }),
  'campaign.switched': (d) => ({
    type: 'campaign',
    title: 'Campaign Switched',
    body: `Active campaign: ${d.campaignId || d.brandName || 'updated'}`,
    link: '/dashboard',
  }),
  'search.completed': (d) => ({
    type: 'auto-search',
    title: 'Auto Search Complete',
    body: d.message || `${d.newPostCount || 0} new posts found`,
    link: '/browse-posts',
  }),
  'engagement.queued': (d) => ({
    type: 'engagement',
    title: 'Engagement Queued',
    body: `${d.action || 'Action'} on ${d.platform || 'post'}`,
    link: '/engagement',
  }),
};

function appendIntegrationLog(store, entry) {
  let log = [];
  try { log = JSON.parse(store.getItem('integrationEventLog') || '[]'); } catch (e) {}
  log.unshift({ ...entry, id: `evt_${Date.now()}`, at: new Date().toISOString() });
  store.setItem('integrationEventLog', JSON.stringify(log.slice(0, 100)));
}

async function runRecipes(entry, event) {
  const { store, handlers } = entry;
  const { type, data } = event;

  if (type === 'keywords.updated') {
    try { store.removeItem('discoveredPostsCache'); } catch (e) {}
  }

  if (type === 'post.published' && data?.platform) {
    let rules = {};
    try { rules = JSON.parse(store.getItem('autoRulesEngine') || '{}'); } catch (e) {}
    if (rules?.enabled && handlers['sync-rules-side-effects']) {
      try { await handlers['sync-rules-side-effects'](null); } catch (e) {}
    }
  }

  if (type === 'search.completed' && (data?.newPostCount || 0) > 0) {
    let autoContent = {};
    try { autoContent = JSON.parse(store.getItem('autoContentSettings') || '{}'); } catch (e) {}
    if (autoContent?.enabled && handlers['run-auto-content-now']) {
      handlers['run-auto-content-now'](null).catch((e) => {
        console.warn('[coordination] auto-content after search:', e.message);
      });
    }
  }
}

async function dispatch(entry, event) {
  const { store, handlers } = entry;
  const { type, data = {}, projectId, organizationId } = event;
  if (!type) return;

  const envelope = {
    type,
    data,
    projectId,
    organizationId,
    at: new Date().toISOString(),
  };

  appendIntegrationLog(store, { type: `domain.${type}`, source: 'coordination', payload: data });
  eventBus.emit(type, envelope);
  eventBus.emit('*', envelope);

  const saasNotifications = require(path.join(__dirname, '../../../apps/desktop/services/saasNotifications'));
  const notifFn = NOTIFICATION_MAP[type];
  if (notifFn) {
    try {
      saasNotifications.sendNotification(store, notifFn(data));
    } catch (e) {
      console.warn('[coordination] notification:', e.message);
    }
  }

  if (handlers['dispatch-outbound-webhook']) {
    handlers['dispatch-outbound-webhook'](null, { eventType: type, data }).catch((e) => {
      console.warn('[coordination] outbound webhook:', e.message);
    });
  }

  await runRecipes(entry, envelope);
}

const CHANNEL_EVENT_MAP = {
  'set-active-campaign': (args) => ({ type: 'campaign.switched', data: { campaignId: args[0] } }),
  'schedule-post': (args, result) => ({ type: 'post.scheduled', data: result?.post || args[0] || {} }),
  'publish-post': (args, result) => (result?.success ? { type: 'post.published', data: { ...args[0], ...result.post } } : null),
  'publish-scheduled-post-now': (args, result) => (result?.success ? { type: 'post.published', data: result.post || args[0] } : null),
  'process-due-scheduled-posts': (args, result) => (
    result?.published > 0
      ? { type: 'post.published', data: { batch: true, count: result.published, published: result.published } }
      : null
  ),
  'save-keywords': (args) => ({ type: 'keywords.updated', data: { count: Array.isArray(args[0]) ? args[0].length : args[0]?.keywords?.length } }),
  'engage-post': (args, result) => ({ type: 'engagement.queued', data: { ...args[0], ...result } }),
  'trigger-full-auto-search': (args, result) => (
    result?.success !== false
      ? { type: 'search.completed', data: result || {} }
      : null
  ),
  'save-ai-reply': (args) => ({ type: 'reply.generated', data: args[0] || {} }),
  'draft-post-reply': (args, result) => (
    result ? { type: 'reply.generated', data: { preview: String(result).slice(0, 200), ...args[0] } } : null
  ),
};

function mapChannelEvent(channel, args, result) {
  const mapper = CHANNEL_EVENT_MAP[channel];
  if (!mapper) return null;
  try {
    return mapper(args, result);
  } catch (e) {
    console.warn(`[coordination] map ${channel}:`, e.message);
    return null;
  }
}

module.exports = { dispatch, mapChannelEvent, NOTIFICATION_MAP };