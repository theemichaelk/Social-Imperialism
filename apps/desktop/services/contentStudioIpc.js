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

  ipcMain.handle('generate-content-batch', async (event, payload) => {
    try {
      return await contentStudio.generateContentBatch(deps, payload || {});
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
      const gen = await contentStudio.generateContentBatch(deps, payload || {});
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