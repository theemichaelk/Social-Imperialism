/**
 * Lightweight entity accessors — maps blueprint data model to localStorage keys.
 * Desktop app uses node-localstorage; this layer provides structured CRUD.
 */

function loadJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJson(store, key, data) {
  store.setItem(key, JSON.stringify(data));
}

const EntityStore = {
  users: {
    get: (store) => loadJson(store, 'users', []),
    save: (store, users) => saveJson(store, 'users', users),
  },
  projects: {
    get: (store) => loadJson(store, 'campaigns', []),
    getActive: (store) => store.getItem('activeCampaignId') || 'default',
    save: (store, projects) => saveJson(store, 'campaigns', projects),
  },
  socialAccounts: {
    get: (store, campaignId) => loadJson(store, `linkedAccounts_${campaignId}`, []),
    save: (store, campaignId, accounts) => saveJson(store, `linkedAccounts_${campaignId}`, accounts),
  },
  keywords: {
    get: (store, campaignId) => loadJson(store, 'keywords', []).filter((k) => k.campaignId === campaignId),
    getAll: (store) => loadJson(store, 'keywords', []),
    saveAll: (store, keywords) => saveJson(store, 'keywords', keywords),
  },
  platformSettings: {
    get: (store) => loadJson(store, 'autoRulesEngine', {}).platformReplyModes || {},
    save: (store, modes) => {
      const rules = loadJson(store, 'autoRulesEngine', {});
      rules.platformReplyModes = modes;
      saveJson(store, 'autoRulesEngine', rules);
    },
  },
  posts: {
    getDiscovered: (store) => loadJson(store, 'discoveredPostsCache', []),
    getPublished: (store) => loadJson(store, 'postHistory', []),
  },
  aiReplies: {
    get: (store, campaignId) => {
      const all = loadJson(store, 'aiRepliesHistory', []);
      return campaignId ? all.filter((r) => !r.campaignId || r.campaignId === campaignId) : all;
    },
    save: (store, replies) => saveJson(store, 'aiRepliesHistory', replies),
  },
  automations: {
    getRules: (store) => loadJson(store, 'autoRulesEngine', {}),
    getMonitors: (store) => loadJson(store, 'watchedMonitors', []),
    getFlow: (store) => loadJson(store, 'automationFlow', null),
  },
  rssFeeds: {
    get: (store) => loadJson(store, 'autoContentSettings', {}).rssUrls || [],
    getFanpage: (store) => loadJson(store, 'fanpageSettings', {}).rssUrls || [],
  },
  scheduledPosts: {
    get: (store) => loadJson(store, 'scheduled_posts', []),
    save: (store, posts) => saveJson(store, 'scheduled_posts', posts),
  },
  notifications: {
    getSettings: (store) => loadJson(store, 'qaSettings', {}),
    getLog: (store) => loadJson(store, 'notificationLog', []),
    append: (store, entry) => {
      const log = loadJson(store, 'notificationLog', []);
      log.unshift({ ...entry, at: new Date().toISOString() });
      saveJson(store, 'notificationLog', log.slice(0, 100));
    },
  },
  metrics: {
    getProject: (store, campaignId) => {
      const replies = EntityStore.aiReplies.get(store, campaignId);
      const published = replies.filter((r) => /published|sent/i.test(r.status || '')).length;
      const fanpage = loadJson(store, 'fanpageMetrics', {});
      return {
        campaignId,
        repliesSent: published,
        repliesDraft: replies.length - published,
        fanpageMetrics: fanpage,
        leads: loadJson(store, 'leads', []).length,
      };
    },
  },
};

module.exports = EntityStore;