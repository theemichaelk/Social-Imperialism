const { withTimeout } = require('./asyncUtils');

function readJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function getActiveCampaignBrand(store, activeId) {
  const campaigns = readJson(store, 'campaigns', []);
  const campaign = campaigns.find((c) => c.id === activeId) || {};
  const legacy = readJson(store, `brandGuidelines_${activeId}`, {});
  const bg = campaign.brandGuidelines || {};
  const name = campaign.brandName || legacy.brandName || '';
  const domain = campaign.domain || legacy.domain || '';
  const voice = campaign.description || legacy.voice || legacy.description || '';
  const ruleLines = [
    ...String(bg.doList || legacy.doList || '').split('\n').map((s) => s.trim()).filter(Boolean),
    ...String(bg.dontList || legacy.dontList || '').split('\n').map((s) => s.trim()).filter(Boolean),
    ...String(campaign.disallowedTopics || legacy.disallowedTopics || '').split('\n').map((s) => s.trim()).filter(Boolean),
  ];
  return { name, domain, voice, rulesCount: ruleLines.length, brandReady: !!(name || domain) };
}

function buildSectionMetrics(store, activeId, section, keys, buildApiMetrics) {
  const keywords = readJson(store, 'keywords', []).filter((k) => k.campaignId === activeId);
  const linkedAccounts = readJson(store, `linkedAccounts_${activeId}`, []);
  const scheduled = readJson(store, 'scheduled_posts', []).filter((p) => !p.campaignId || p.campaignId === activeId);
  const postHistory = readJson(store, 'postHistory', []);
  const replies = readJson(store, 'aiRepliesHistory', []);
  const engagementQueue = readJson(store, 'engagementQueue', []);
  const monitors = readJson(store, 'watchedMonitors', []);
  const library = readJson(store, `contentLibrary_${activeId}`, []);
  const brandSnapshot = getActiveCampaignBrand(store, activeId);
  const engagementLists = readJson(store, 'engagementLists', []);
  const autoRules = readJson(store, 'autoRulesEngine', {});
  const apiMetrics = buildApiMetrics ? buildApiMetrics(keys) : {};
  const connectedApis = Object.values(apiMetrics).filter((v) => v === 'Connected').length;

  const platformSchedule = {};
  scheduled.forEach((p) => {
    const plat = p.platform || 'Other';
    platformSchedule[plat] = (platformSchedule[plat] || 0) + 1;
  });

  const base = {
    section,
    updatedAt: new Date().toISOString(),
    stats: {
      accounts: linkedAccounts.length,
      keywords: keywords.length,
      scheduled: scheduled.length,
      published: postHistory.length,
      drafts: replies.filter((r) => r.status === 'draft').length,
      library: library.length,
      monitors: monitors.length,
      queue: engagementQueue.length,
      apiConnected: connectedApis,
      apiTotal: Object.keys(apiMetrics).length,
    },
    platformSchedule,
    accounts: linkedAccounts.map((a) => ({
      id: a.id, platform: a.platform, handle: a.handle, status: a.status || 'connected',
    })),
    apiMetrics,
  };

  switch (section) {
    case 'content-hub':
    case 'content-library':
      return {
        ...base,
        assetTypes: library.reduce((acc, a) => {
          const t = a.type || 'other';
          acc[t] = (acc[t] || 0) + 1;
          return acc;
        }, {}),
        stats: { ...base.stats, brandReady: brandSnapshot.brandReady },
      };
    case 'design-studio':
      return {
        ...base,
        stats: { ...base.stats, templates: 6, libraryImages: library.filter((a) => a.type === 'image').length },
      };
    case 'brand':
      return {
        ...base,
        brand: {
          name: brandSnapshot.name,
          domain: brandSnapshot.domain,
          voice: brandSnapshot.voice,
          rulesCount: brandSnapshot.rulesCount,
        },
        stats: { ...base.stats, brandReady: brandSnapshot.brandReady },
      };
    case 'calendar':
    case 'scheduler': {
      const upcoming = scheduled.filter((p) => new Date(p.scheduleTime || p.timestamp).getTime() > Date.now());
      const hourCounts = {};
      scheduled.forEach((p) => {
        const t = p.scheduleTime || p.timestamp;
        if (!t) return;
        const h = new Date(t).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      });
      const bg = readJson(store, 'backgroundRunSettings', {});
      return {
        ...base,
        stats: { ...base.stats, upcoming: upcoming.length, backgroundEnabled: !!bg.enabled },
        bestHours: Object.entries(hourCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([h, c]) => ({ hour: parseInt(h, 10), count: c })),
      };
    }
    case 'engagement':
      return {
        ...base,
        stats: { ...base.stats, lists: engagementLists.length },
        lists: engagementLists.slice(0, 8).map((l) => ({ id: l.id, name: l.name, type: l.type, auto: !!l.autoEngage })),
      };
    case 'history':
      return {
        ...base,
        replyStats: {
          draft: replies.filter((r) => r.status === 'draft').length,
          published: replies.filter((r) => r.status === 'published' || r.status === 'Published').length,
          total: replies.length,
        },
        byPlatform: replies.reduce((acc, r) => {
          const p = r.platform || 'Other';
          acc[p] = (acc[p] || 0) + 1;
          return acc;
        }, {}),
      };
    case 'keywords':
      return {
        ...base,
        keywordTerms: keywords.slice(0, 10).map((k) => k.term),
        byIntent: keywords.reduce((acc, k) => {
          const i = k.intent || 'mentions';
          acc[i] = (acc[i] || 0) + 1;
          return acc;
        }, {}),
      };
    case 'seo-tools':
      return {
        ...base,
        stats: { ...base.stats, serpConnected: apiMetrics.SerpAPI === 'Connected' },
      };
    case 'reddit-ai': {
      const redditStatus = readJson(store, 'redditAiStatus', {});
      const leads = readJson(store, 'leads', []);
      return {
        ...base,
        stats: { ...base.stats, leads: leads.length, modulesActive: redditStatus.activeModules || 0 },
      };
    }
    case 'quora-traffic': {
      const quora = readJson(store, 'quoraTrafficSettings', {});
      const answers = readJson(store, 'quoraTrafficAnswers', []);
      return {
        ...base,
        stats: { ...base.stats, answers: answers.length, quoraLinked: !!quora.linkedAccount },
      };
    }
    case 'automations':
    case 'rules':
      return {
        ...base,
        stats: {
          ...base.stats,
          rulesEnabled: !!autoRules.enabled,
          workerRunning: store.getItem('workerRunningFlag') === 'true',
        },
      };
    case 'account-hub':
    case 'account-creator': {
      const proxies = readJson(store, 'proxyPool', []);
      const kits = readJson(store, 'profileKits', []);
      return {
        ...base,
        stats: { ...base.stats, proxies: proxies.length, kits: kits.length },
      };
    }
    case 'integrations':
    case 'settings':
      return {
        ...base,
        apiHealth: {
          connected: connectedApis,
          total: Object.keys(apiMetrics).length,
          pct: Object.keys(apiMetrics).length ? Math.round((connectedApis / Object.keys(apiMetrics).length) * 100) : 0,
        },
      };
    case 'onboarding': {
      const setup = readJson(store, 'onboardingProgress', {});
      return {
        ...base,
        stats: { ...base.stats, step: setup.step || 1, complete: store.getItem('onboardingComplete') === 'true' },
      };
    }
    case 'dashboard': {
      const leads = readJson(store, 'leads', []);
      const workerRunning = store.getItem('workerRunningFlag') === 'true';
      const recentPublished = postHistory.filter((p) => {
        const t = new Date(p.timestamp || 0).getTime();
        return t > Date.now() - 7 * 86400000;
      }).length;
      return {
        ...base,
        stats: {
          ...base.stats,
          leads: leads.length,
          workerRunning,
          recentPublished,
          scheduled: scheduled.length,
        },
        byPlatform: postHistory.slice(0, 50).reduce((acc, p) => {
          const plat = p.platform || 'Other';
          acc[plat] = (acc[plat] || 0) + 1;
          return acc;
        }, {}),
      };
    }
    default:
      return base;
  }
}

function registerSectionLiveHandlers({ ipcMain, store, resolveKeys, buildApiMetrics, fetchTrendingTopics }) {
  try { ipcMain.removeHandler('get-section-live'); } catch (e) { /* noop */ }

  ipcMain.handle('get-section-live', async (event, section = 'dashboard') => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const keys = resolveKeys(readJson(store, 'globalApiKeys', {}));
    const id = String(section || 'dashboard').replace(/^\/+/, '').split('/')[0] || 'dashboard';

    const metrics = buildSectionMetrics(store, activeId, id, keys, buildApiMetrics);

    let trending = [];
    if (fetchTrendingTopics) {
      try {
        const kws = readJson(store, 'keywords', []).filter((k) => k.campaignId === activeId).map((k) => k.term);
        trending = await withTimeout(fetchTrendingTopics(keys, kws.slice(0, 3)), 10000, []);
      } catch (e) { /* optional */ }
    }

    return {
      success: true,
      ...metrics,
      trending: (trending || []).slice(0, 6).map((t) => ({
        topic: t.topic || t.title || t.name,
        momentum: t.momentum || 'rising',
      })),
    };
  });
}

module.exports = { registerSectionLiveHandlers, buildSectionMetrics };