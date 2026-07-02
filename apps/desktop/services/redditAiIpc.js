const redditAiSuite = require('./redditAiSuite');
const { fetchTrendingTopics } = require('./feedFetcher');

function registerRedditAiHandlers({ ipcMain, store, generateAI, getCampaign, resolveKeys }) {
  const channels = [
    'get-reddit-ai-status',
    'get-reddit-ai-settings',
    'save-reddit-ai-settings',
    'run-reddit-ai-module',
    'get-reddit-ai-queue',
    'approve-reddit-ai-action',
    'dismiss-reddit-ai-action',
    'clear-reddit-ai-queue',
  ];

  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* not registered */ }
  });

  const deps = () => ({
    generateAI,
    campaign: getCampaign(),
    fetchNews: async () => {
      try {
        const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
        const trends = await fetchTrendingTopics('All', keys);
        return {
          articles: (trends || []).map((t) => ({
            title: t.topic || t.title || String(t),
            url: t.url,
            momentum: t.momentum,
          })),
        };
      } catch (e) {
        return { articles: [] };
      }
    },
  });

  ipcMain.handle('get-reddit-ai-status', () => redditAiSuite.getStatus(store));

  ipcMain.handle('get-reddit-ai-settings', () => redditAiSuite.getSettings(store));

  ipcMain.handle('save-reddit-ai-settings', (event, partial) => {
    const saved = redditAiSuite.saveSettings(store, partial || {});
    return { success: true, settings: saved };
  });

  ipcMain.handle('run-reddit-ai-module', async (event, moduleId) => {
    try {
      const result = await redditAiSuite.runModule(store, moduleId, deps());
      return { success: true, ...result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('get-reddit-ai-queue', (event, payload) => {
    const moduleId = typeof payload === 'string' ? payload : payload?.moduleId;
    const status = typeof payload === 'object' && payload?.status ? payload.status : 'pending';
    return {
      queue: redditAiSuite.getQueue(store, moduleId || null, { status }),
      total: redditAiSuite.getQueue(store, moduleId || null).length,
    };
  });

  ipcMain.handle('approve-reddit-ai-action', (event, id) => {
    return redditAiSuite.updateQueueItem(store, id, { status: 'approved', approvedAt: new Date().toISOString() });
  });

  ipcMain.handle('dismiss-reddit-ai-action', (event, id) => {
    return redditAiSuite.updateQueueItem(store, id, { status: 'dismissed' });
  });

  ipcMain.handle('clear-reddit-ai-queue', (event, payload = {}) => {
    const filter = {
      moduleId: payload.moduleId,
      status: payload.status || 'pending',
    };
    return redditAiSuite.clearQueue(store, filter);
  });
}

module.exports = { registerRedditAiHandlers };