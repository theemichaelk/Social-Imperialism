const { withTimeout } = require('./asyncUtils');
const { summarizeEngageability } = require('../../../packages/core/src/postEngageability');
const { decodeHtmlEntities } = require('../../../packages/core/src/textUtils');

function registerBrowsePostsHandlers({ ipcMain, store, resolveKeys, buildApiMetrics, fetchTrendingTopics }) {
  const channels = ['get-browse-posts-live'];
  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* noop */ }
  });

  ipcMain.handle('get-browse-posts-live', async () => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));

    let keywords = [];
    let linkedAccounts = [];
    let engagementQueue = [];
    let monitors = [];
    let postHistory = [];

    try { keywords = JSON.parse(store.getItem('keywords') || '[]').filter((k) => k.campaignId === activeId); } catch (e) {}
    try { linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]'); } catch (e) {}
    try { engagementQueue = JSON.parse(store.getItem('engagementQueue') || '[]').slice(0, 12); } catch (e) {}
    try { monitors = JSON.parse(store.getItem('watchedMonitors') || '[]').slice(0, 15); } catch (e) {}
    try { postHistory = JSON.parse(store.getItem('postHistory') || '[]'); } catch (e) {}

    let feedSample = [];
    try {
      const { fetchRealFeed } = require('./feedFetcher');
      feedSample = await withTimeout(
        fetchRealFeed({
          keywords: keywords.map((k) => k.term).slice(0, 3),
          filters: { quick: true, sort: 'engagement' },
          keys,
          allowedPlatforms: new Set(['All']),
        }),
        15000,
        [],
      );
    } catch (e) { /* optional */ }

    const { engageable, viewOnly, platformCounts } = summarizeEngageability(feedSample);

    let trending = [];
    if (fetchTrendingTopics) {
      try {
        trending = await withTimeout(
          fetchTrendingTopics(keys, keywords.map((k) => k.term).slice(0, 3)),
          12000,
          [],
        );
      } catch (e) { /* optional */ }
    }

    const replies = JSON.parse(store.getItem('aiRepliesHistory') || '[]');
    const drafts = replies.filter((r) => r.status === 'draft').length;

    const queueByAction = {};
    engagementQueue.forEach((q) => {
      const a = q.action || 'other';
      queueByAction[a] = (queueByAction[a] || 0) + 1;
    });

    const apiMetrics = buildApiMetrics ? buildApiMetrics(keys) : {};
    const connectedApis = Object.entries(apiMetrics).filter(([, v]) => v === 'Connected').length;
    const totalApis = Object.keys(apiMetrics).length;

    return {
      success: true,
      updatedAt: new Date().toISOString(),
      stats: {
        feedPosts: feedSample.length,
        engageable,
        viewOnly,
        keywords: keywords.length,
        accounts: linkedAccounts.length,
        monitors: monitors.length,
        drafts,
        published: postHistory.length,
        queuePending: engagementQueue.filter((q) => q.status === 'queued').length,
      },
      platformCounts,
      queueByAction,
      trending: (trending || []).slice(0, 8).map((t) => ({
        topic: decodeHtmlEntities(t.topic || t.title || t.name || ''),
        momentum: t.momentum || t.volume || 'rising',
        platform: t.platform || 'Social',
      })),
      engagementQueue: engagementQueue.map((q) => ({
        id: q.id,
        platform: q.platform,
        action: q.action,
        status: q.status,
        queuedAt: q.queuedAt,
        error: q.error,
      })),
      monitors: monitors.map((m) => ({
        id: m.id,
        label: m.label,
        platform: m.platform,
        type: m.type,
        target: m.target,
      })),
      accounts: linkedAccounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        handle: a.handle,
        status: a.status || 'connected',
      })),
      apiMetrics,
      apiHealth: { connected: connectedApis, total: totalApis, pct: totalApis ? Math.round((connectedApis / totalApis) * 100) : 0 },
    };
  });
}

module.exports = { registerBrowsePostsHandlers };