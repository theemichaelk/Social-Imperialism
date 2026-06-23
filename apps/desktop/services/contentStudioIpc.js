const contentStudio = require('./contentStudio');
const fs = require('fs');
const path = require('path');

async function resolveMediaUrl(mediaUrl) {
  if (!mediaUrl) return null;
  if (mediaUrl.startsWith('http') || mediaUrl.startsWith('data:') || mediaUrl.startsWith('file:')) {
    return mediaUrl;
  }
  if (fs.existsSync(mediaUrl)) {
    const ext = path.extname(mediaUrl).toLowerCase();
    let mime = 'image/jpeg';
    if (ext === '.png') mime = 'image/png';
    if (ext === '.mp4') mime = 'video/mp4';
    if (ext === '.mov') mime = 'video/quicktime';
    const data = fs.readFileSync(mediaUrl);
    return `data:${mime};base64,${data.toString('base64')}`;
  }
  return mediaUrl;
}

async function normalizeItemsMedia(items) {
  return Promise.all((items || []).map(async (item) => ({
    ...item,
    mediaUrl: await resolveMediaUrl(item.mediaUrl),
  })));
}

function registerContentStudioHandlers({
  ipcMain,
  store,
  generateAIWithModel,
  generateImage,
  generateInfographic,
  generateGrokImagine,
  getScheduledPosts,
  saveScheduledPosts,
  publishPost,
}) {
  const channels = [
    'get-content-studio-config',
    'get-content-studio-live',
    'generate-content-batch',
    'schedule-content-batch',
    'run-content-studio',
  ];

  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* not registered */ }
  });

  const deps = {
    generateAIWithModel,
    generateImage,
    generateInfographic,
    generateGrokImagine,
  };

  ipcMain.handle('get-content-studio-config', () => ({
    models: contentStudio.AI_MODELS,
    contentTypes: contentStudio.CONTENT_TYPES,
    frequencies: Object.entries(contentStudio.FREQUENCIES).map(([id, v]) => ({ id, label: v.label })),
    maxCampaignDays: contentStudio.MAX_CAMPAIGN_DAYS,
    maxScheduledPosts: contentStudio.MAX_SCHEDULED_POSTS,
  }));

  ipcMain.handle('get-content-studio-live', async () => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const keywords = JSON.parse(store.getItem('keywords') || '[]').filter((k) => k.campaignId === activeId);
    const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    const scheduled = JSON.parse(store.getItem('scheduled_posts') || '[]')
      .filter((p) => !p.campaignId || p.campaignId === activeId);
    const published = JSON.parse(store.getItem('postHistory') || '[]');
    const queue = JSON.parse(store.getItem('contentQueue') || '[]');
    let libraryCount = 0;
    try {
      const libKey = `contentLibrary_${activeId}`;
      libraryCount = JSON.parse(store.getItem(libKey) || '[]').length;
    } catch (e) { /* ignore */ }

    const platformSchedule = {};
    scheduled.forEach((p) => {
      const plat = p.platform || 'Other';
      platformSchedule[plat] = (platformSchedule[plat] || 0) + 1;
    });

    const last7 = published.filter((p) => {
      const ts = p.publishedAt || p.createdAt;
      if (!ts) return false;
      return Date.now() - new Date(ts).getTime() < 7 * 86400000;
    });

    const engagementByDay = {};
    last7.forEach((p) => {
      const day = (p.publishedAt || p.createdAt || '').slice(0, 10) || 'unknown';
      const s = p.stats || {};
      engagementByDay[day] = (engagementByDay[day] || 0) + (s.likes || 0) + (s.comments || 0) + (s.shares || 0);
    });

    let brand = {};
    try {
      brand = JSON.parse(store.getItem(`brandGuidelines_${activeId}`) || '{}');
    } catch (e) { /* ignore */ }

    let trending = [];
    try {
      const { fetchTrendingTopics } = require('./feedFetcher');
      const { resolveKeys } = require('./keys');
      trending = await fetchTrendingTopics(resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}')), keywords.map((k) => k.term).slice(0, 3));
    } catch (e) { /* optional */ }

    const hourCounts = {};
    scheduled.forEach((p) => {
      const t = p.scheduleTime || p.scheduledAt;
      if (!t) return;
      const h = new Date(t).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const bestHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([h, c]) => ({ hour: parseInt(h, 10), count: c }));

    return {
      success: true,
      updatedAt: new Date().toISOString(),
      stats: {
        accounts: linkedAccounts.length,
        library: libraryCount,
        queue: queue.length,
        scheduled: scheduled.length,
        published7d: last7.length,
        keywords: keywords.length,
        brandReady: !!(brand.brandName || brand.domain || brand.voice),
      },
      platformSchedule,
      engagementByDay,
      bestHours: bestHours.length ? bestHours : [{ hour: 10, count: 0 }, { hour: 14, count: 0 }, { hour: 18, count: 0 }],
      trending: (trending || []).slice(0, 8).map((t) => ({
        topic: t.topic || t.title || t.name,
        momentum: t.momentum || t.volume || 'rising',
        platform: t.platform || 'Social',
      })),
      accounts: linkedAccounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        handle: a.handle,
        status: a.status || 'connected',
      })),
    };
  });

  ipcMain.handle('generate-content-batch', async (event, payload) => {
    try {
      return await contentStudio.generateContentBatch({ ...deps, store }, payload || {});
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('schedule-content-batch', async (event, { items, scheduleConfig }) => {
    try {
      return await contentStudio.scheduleGeneratedItems(
        store,
        { getAll: getScheduledPosts, save: saveScheduledPosts },
        items || [],
        scheduleConfig || {},
      );
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('run-content-studio', async (event, payload) => {
    try {
      const gen = await contentStudio.generateContentBatch({ ...deps, store }, payload || {});
      if (!gen.success) return gen;

      const scheduleConfig = payload.scheduleConfig || { mode: 'preview' };
      if (scheduleConfig.mode === 'preview' || scheduleConfig.mode === 'generate_only') {
        return { ...gen, scheduled: [], message: `Generated ${gen.count} content piece(s).` };
      }

      const normalizedItems = await normalizeItemsMedia(gen.items);

      if (scheduleConfig.mode === 'now' || scheduleConfig.publishNow) {
        const published = [];
        for (const item of normalizedItems) {
          if (publishPost) {
            try {
              const res = await publishPost({
                accountId: item.accountId,
                platform: item.platform,
                content: item.content,
                mediaUrl: item.mediaUrl,
                hasMedia: !!item.mediaUrl,
                isVideo: !!item.isVideo,
              });
              published.push({ item, res });
            } catch (e) {
              published.push({ item, error: e.message });
            }
          }
        }
        return { ...gen, items: normalizedItems, published, message: `Published ${published.length} item(s) now.` };
      }

      const sched = await contentStudio.scheduleGeneratedItems(
        store,
        { getAll: getScheduledPosts, save: saveScheduledPosts },
        normalizedItems,
        scheduleConfig,
      );
      return {
        ...gen,
        items: normalizedItems,
        scheduled: sched.scheduled,
        scheduledCount: sched.count,
        dateRange: sched.dateRange,
        message: `Generated ${gen.count} and scheduled ${sched.count} post(s).`,
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

module.exports = { registerContentStudioHandlers };