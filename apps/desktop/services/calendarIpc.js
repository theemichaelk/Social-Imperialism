/**
 * Content Calendar IPC — loaded at app startup so handlers are always registered.
 */
const calendarAnalytics = require('./calendarAnalytics');

function registerCalendarHandlers({ ipcMain, store, resolveKeys, buildApiMetrics, integrations }) {
  function getScheduledPostsStore() {
    const data = store.getItem('scheduled_posts');
    if (!data) return [];
    try { return JSON.parse(data); } catch (e) { return []; }
  }

  function saveScheduledPostsStore(posts) {
    store.setItem('scheduled_posts', JSON.stringify(posts));
  }

  function filterScheduledByCampaign(posts, campaignId) {
    return posts.filter((p) => !p.campaignId || p.campaignId === campaignId);
  }

  async function executePublishPost(postData) {
    const globalKeys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const activeCampaignId = store.getItem('activeCampaignId') || 'default';
    const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeCampaignId}`) || '[]');

    const humanLike = process.env.SI_TEST_QUICK === '1' ? false : postData.humanLike !== false;
    try {
      const publishResult = await integrations.publishPost(postData, globalKeys, linkedAccounts, { humanLike });
      if (publishResult && publishResult.success === false) {
        return { success: false, error: publishResult.error || 'Platform publish failed', platform: postData.platform };
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.statusText || err.message;
      return { success: false, error: msg, statusCode: err?.response?.status, platform: postData.platform };
    }

    if (postData.accountId && integrations.recordAccountAction) {
      integrations.recordAccountAction(store, postData.accountId);
    }

    let history = [];
    const data = store.getItem('postHistory');
    if (data) {
      try { history = JSON.parse(data); } catch (e) {}
    }

    const newPost = {
      id: 'post_' + Date.now(),
      accountId: postData.accountId,
      platform: postData.platform,
      content: postData.content,
      hasMedia: postData.hasMedia,
      mediaUrl: postData.mediaUrl,
      timestamp: new Date().toISOString(),
      stats: { likes: 0, shares: 0, views: 0, comments: 0 },
    };

    history.unshift(newPost);
    store.setItem('postHistory', JSON.stringify(history));
    return { success: true, post: newPost };
  }

  async function processDueScheduledPosts() {
    const posts = getScheduledPostsStore();
    if (!posts.length) return { published: 0, failed: 0, skipped: 0 };

    const now = Date.now();
    let published = 0;
    let failed = 0;
    let skipped = 0;
    const remaining = [];
    const maxBatch = parseInt(process.env.SI_SCHEDULER_BATCH_MAX || '8', 10);
    let processed = 0;

    for (const sched of posts) {
      const dueAt = new Date(sched.timestamp || sched.scheduleTime).getTime();
      if (Number.isNaN(dueAt) || dueAt > now) {
        remaining.push(sched);
        continue;
      }

      if (processed >= maxBatch) {
        remaining.push(sched);
        skipped++;
        continue;
      }

      const prevCampaign = store.getItem('activeCampaignId');
      if (sched.campaignId) store.setItem('activeCampaignId', sched.campaignId);

      try {
        const result = await executePublishPost({
          accountId: sched.accountId,
          platform: sched.platform,
          content: sched.content,
          hasMedia: !!(sched.mediaUrl || sched.hasMedia),
          mediaUrl: sched.mediaUrl,
          isVideo: !!sched.isVideo,
          videoPath: sched.videoPath || null,
          title: sched.title || sched.content?.slice(0, 100),
          humanLike: false,
        });
        if (result?.success === false) {
          sched.lastError = result.error || 'Publish failed';
          sched.status = 'failed';
          remaining.push(sched);
          failed++;
        } else {
          published++;
        }
        processed++;
      } catch (err) {
        console.error('Scheduled publish failed:', sched.id, err.message);
        sched.lastError = err.message;
        sched.status = 'failed';
        remaining.push(sched);
        failed++;
        processed++;
      } finally {
        if (sched.campaignId) {
          if (prevCampaign != null) store.setItem('activeCampaignId', prevCampaign);
          else store.removeItem('activeCampaignId');
        }
      }
    }

    saveScheduledPostsStore(remaining);
    return { published, failed, skipped, processed };
  }

  const channels = [
    'schedule-post',
    'get-scheduled-posts',
    'delete-scheduled-post',
    'update-scheduled-post',
    'publish-scheduled-post-now',
    'process-due-scheduled-posts',
    'get-calendar-status',
    'get-best-post-times',
    'get-upcoming-by-platform',
    'get-calendar-settings',
    'save-calendar-settings',
  ];

  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* not registered yet */ }
  });

  ipcMain.handle('schedule-post', async (event, postData) => {
    const scheduled_posts = getScheduledPostsStore();
    const activeCampaignId = store.getItem('activeCampaignId') || 'default';
    const dateObj = new Date(postData.scheduleTime);
    const newPost = {
      id: 'sched_' + Date.now(),
      campaignId: postData.campaignId || activeCampaignId,
      platform: postData.platform,
      accountId: postData.accountId,
      content: postData.content,
      mediaUrl: postData.mediaUrl || null,
      hasMedia: !!(postData.mediaUrl || postData.hasMedia),
      isVideo: !!postData.isVideo,
      rules: postData.rules || {},
      timestamp: postData.scheduleTime,
      dateIndex: dateObj.getDate(),
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };
    scheduled_posts.push(newPost);
    saveScheduledPostsStore(scheduled_posts);
    return { success: true, post: newPost };
  });

  ipcMain.handle('get-scheduled-posts', (event, campaignId) => {
    const activeCampaignId = campaignId || store.getItem('activeCampaignId') || 'default';
    return filterScheduledByCampaign(getScheduledPostsStore(), activeCampaignId);
  });

  ipcMain.handle('delete-scheduled-post', (event, id) => {
    try {
      saveScheduledPostsStore(getScheduledPostsStore().filter((p) => p.id !== id));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('update-scheduled-post', (event, { id, updates }) => {
    const posts = getScheduledPostsStore();
    const idx = posts.findIndex((p) => p.id === id);
    if (idx < 0) return { success: false, error: 'Scheduled post not found' };
    const next = { ...posts[idx], ...updates };
    if (updates?.scheduleTime) {
      next.timestamp = updates.scheduleTime;
      next.dateIndex = new Date(updates.scheduleTime).getDate();
    }
    if (updates?.timestamp) {
      next.timestamp = updates.timestamp;
      next.dateIndex = new Date(updates.timestamp).getDate();
    }
    posts[idx] = next;
    saveScheduledPostsStore(posts);
    return { success: true, post: posts[idx] };
  });

  ipcMain.handle('publish-scheduled-post-now', async (event, id) => {
    const posts = getScheduledPostsStore();
    const sched = posts.find((p) => p.id === id);
    if (!sched) return { success: false, error: 'Scheduled post not found' };
    try {
      const result = await executePublishPost({
        accountId: sched.accountId,
        platform: sched.platform,
        content: sched.content,
        hasMedia: !!(sched.mediaUrl || sched.hasMedia),
        mediaUrl: sched.mediaUrl,
        isVideo: !!sched.isVideo,
      });
      saveScheduledPostsStore(posts.filter((p) => p.id !== id));
      return { success: true, ...result, message: 'Scheduled post published now via platform API.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('process-due-scheduled-posts', async () => processDueScheduledPosts());

  ipcMain.handle('get-calendar-status', async () => {
    const activeCampaignId = store.getItem('activeCampaignId') || 'default';
    const posts = filterScheduledByCampaign(getScheduledPostsStore(), activeCampaignId);
    const now = Date.now();
    const globalKeys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const byPlatform = calendarAnalytics.groupScheduledByPlatform(posts);
    return {
      scheduledCount: posts.length,
      dueNow: posts.filter((p) => new Date(p.timestamp).getTime() <= now).length,
      upcoming: posts.filter((p) => new Date(p.timestamp).getTime() > now).length,
      activeCampaignId,
      apiMetrics: buildApiMetrics(globalKeys),
      platformCounts: Object.fromEntries(Object.entries(byPlatform).map(([k, v]) => [k, v.length])),
    };
  });

  ipcMain.handle('get-best-post-times', () => {
    const activeCampaignId = store.getItem('activeCampaignId') || 'default';
    return calendarAnalytics.analyzeEngagementPatterns(store, activeCampaignId);
  });

  ipcMain.handle('get-upcoming-by-platform', (event, daysAhead = 14) => {
    const activeCampaignId = store.getItem('activeCampaignId') || 'default';
    const posts = filterScheduledByCampaign(getScheduledPostsStore(), activeCampaignId);
    return calendarAnalytics.getUpcomingByPlatform(posts, daysAhead);
  });

  ipcMain.handle('get-calendar-settings', () => {
    let settings = { timezone: 'local', platformFilter: 'all', viewMode: 'month' };
    try { settings = { ...settings, ...JSON.parse(store.getItem('calendarSettings') || '{}') }; } catch (e) {}
    return settings;
  });

  ipcMain.handle('save-calendar-settings', (event, settings) => {
    let existing = { timezone: 'local', platformFilter: 'all', viewMode: 'month' };
    try { existing = { ...existing, ...JSON.parse(store.getItem('calendarSettings') || '{}') }; } catch (e) {}
    store.setItem('calendarSettings', JSON.stringify({ ...existing, ...(settings || {}) }));
    return { success: true };
  });

  return { executePublishPost, processDueScheduledPosts };
}

module.exports = { registerCalendarHandlers };