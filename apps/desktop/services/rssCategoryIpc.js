const { discoverSiteFeeds, getSiteRssSources, saveSiteRssSources } = require('./siteRssDiscovery');
const { matchCategoryToTargets } = require('./categoryCommunityMatcher');
const {
  runCategoryRssRouter,
  syncAutoContentFromSiteSources,
  upsertSiteSource,
  updateFeedMappings,
  autoMapFeedsToTargets,
} = require('./rssCategoryRouter');

function registerRssCategoryHandlers({
  ipcMain,
  store,
  resolveKeys,
  generateAI,
  getFalKey,
}) {
  const channels = [
    'discover-site-rss',
    'get-site-rss-sources',
    'save-site-rss-source',
    'update-category-feed-mappings',
    'match-category-targets',
    'run-category-rss-router',
    'remove-site-rss-source',
  ];

  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* not registered */ }
  });

  ipcMain.handle('discover-site-rss', async (event, payload) => {
    try {
      const siteUrl = payload?.siteUrl || payload?.url;
      const discovery = await discoverSiteFeeds(siteUrl);
      const campaignId = store.getItem('activeCampaignId') || 'default';
      const feedsWithMappings = autoMapFeedsToTargets(store, campaignId, discovery.feeds);
      return {
        success: true,
        discovery: { ...discovery, feeds: feedsWithMappings },
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('get-site-rss-sources', () => {
    return { success: true, sources: getSiteRssSources(store) };
  });

  ipcMain.handle('save-site-rss-source', (event, payload) => {
    try {
      const { discovery, feeds } = payload || {};
      if (!discovery?.siteUrl) return { success: false, error: 'discovery.siteUrl required' };

      const mappingsByFeedId = {};
      (feeds || discovery.feeds || []).forEach((f) => {
        mappingsByFeedId[f.id] = f.targetMappings || [];
      });

      const saved = upsertSiteSource(store, discovery, mappingsByFeedId);
      const settings = syncAutoContentFromSiteSources(store);
      return { success: true, source: saved, autoContentSettings: settings };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('update-category-feed-mappings', (event, payload) => {
    const { sourceId, feedId, targetMappings } = payload || {};
    if (!sourceId || !feedId) return { success: false, error: 'sourceId and feedId required' };
    const feed = updateFeedMappings(store, sourceId, feedId, targetMappings);
    if (!feed) return { success: false, error: 'Feed not found' };
    syncAutoContentFromSiteSources(store);
    return { success: true, feed };
  });

  ipcMain.handle('match-category-targets', (event, payload) => {
    const campaignId = store.getItem('activeCampaignId') || 'default';
    const result = matchCategoryToTargets({
      categoryLabel: payload?.category || payload?.categoryLabel,
      categorySlug: payload?.categorySlug,
      store,
      campaignId,
      minScore: payload?.minScore ?? 15,
      limit: payload?.limit ?? 10,
    });
    return { success: true, ...result };
  });

  ipcMain.handle('run-category-rss-router', async () => {
    const settingsRaw = store.getItem('autoContentSettings');
    let publishMode = 'queue';
    try {
      const s = settingsRaw ? JSON.parse(settingsRaw) : {};
      publishMode = s.publishMode || 'queue';
    } catch (e) {}

    const result = await runCategoryRssRouter({
      store,
      generateAI,
      falKey: getFalKey?.() || process.env.FAL_KEY,
      resolveKeys,
      publishMode,
    });
    return { success: true, ...result };
  });

  ipcMain.handle('remove-site-rss-source', (event, sourceId) => {
    const sources = getSiteRssSources(store).filter((s) => s.id !== sourceId);
    saveSiteRssSources(store, sources);
    syncAutoContentFromSiteSources(store);
    return { success: true, sources };
  });

  console.log('[rssCategoryIpc] Registered site RSS discovery + category routing handlers');
}

module.exports = { registerRssCategoryHandlers };