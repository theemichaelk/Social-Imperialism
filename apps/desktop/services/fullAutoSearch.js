/**
 * One-Click Full Auto Search — scans all platforms, Q&A, Reddit leads.
 * Shared by Electron desktop and SaaS coreHandlers.
 */
const { ALL_PLATFORMS } = require('./platformCatalog');

async function runFullAutoSearch(store, deps) {
  const { integrations, resolveKeys, fetchRealFeed, generateAI, scanUnansweredQuestions, runRedditProspector } = deps;
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));

  let keywords = [];
  try {
    keywords = JSON.parse(store.getItem('keywords') || '[]')
      .filter((k) => k.campaignId === activeCampaignId)
      .map((k) => k.term);
  } catch (e) { /* ignore */ }

  const campaigns = JSON.parse(store.getItem('campaigns') || '[]');
  const campaign = campaigns.find((c) => c.id === activeCampaignId) || { brandName: 'marketing' };
  if (!keywords.length) keywords = [campaign.brandName || 'marketing'];

  let timestamps = {};
  try { timestamps = JSON.parse(store.getItem('platformFetchTimestamps') || '{}'); } catch (e) { /* ignore */ }

  let discoveredCache = [];
  try { discoveredCache = JSON.parse(store.getItem('discoveredPostsCache') || '[]'); } catch (e) { /* ignore */ }

  const seen = new Set(discoveredCache.map((p) => `${p.platform}:${p.externalId || p.url}`));
  let newPostCount = 0;
  const platformResults = [];

  const fetchFn = fetchRealFeed || integrations.fetchRealFeed;

  for (const platform of ALL_PLATFORMS) {
    try {
      const posts = await fetchFn({
        keywords: keywords.slice(0, 5),
        filters: { platform, sort: 'recent' },
        keys,
        allowedPlatforms: new Set([platform]),
      });
      const lastRun = timestamps[platform] || 0;
      const fresh = (posts || []).filter((p) => {
        const ts = p.createdAt || (p.timestamp ? new Date(p.timestamp).getTime() : 0);
        return typeof ts === 'number' && ts > 0 ? ts > lastRun : true;
      });
      fresh.forEach((p) => {
        const key = `${p.platform}:${p.externalId || p.url}`;
        if (!seen.has(key)) {
          seen.add(key);
          discoveredCache.unshift({ ...p, campaignId: activeCampaignId, discoveredAt: new Date().toISOString() });
          newPostCount += 1;
        }
      });
      timestamps[platform] = Date.now();
      platformResults.push({ platform, found: (posts || []).length, new: fresh.length });
    } catch (e) {
      console.error(`Auto-search ${platform} error:`, e.message);
      platformResults.push({ platform, error: e.message });
    }
  }

  store.setItem('platformFetchTimestamps', JSON.stringify(timestamps));
  store.setItem('discoveredPostsCache', JSON.stringify(discoveredCache.slice(0, 500)));

  if (scanUnansweredQuestions) {
    await scanUnansweredQuestions(store, keys, campaign, generateAI);
  } else if (integrations?.scanUnansweredQuestions) {
    await integrations.scanUnansweredQuestions(store, keys, campaign, generateAI);
  }

  if (runRedditProspector) {
    await runRedditProspector(store, keys, campaign);
  } else if (integrations?.runRedditProspector) {
    await integrations.runRedditProspector(store, keys, campaign);
  }

  store.setItem('fullAutoSearchLastRun', String(Date.now()));

  let tasks = [];
  try { tasks = JSON.parse(store.getItem('workerTasks') || '[]'); } catch (e) { /* ignore */ }
  tasks.unshift({
    time: new Date().toLocaleTimeString(),
    action: `One-Click Full Auto Search — ${newPostCount} new posts across ${ALL_PLATFORMS.length} platforms + Q&A + Reddit`,
    platform: 'All',
  });
  store.setItem('workerTasks', JSON.stringify(tasks.slice(0, 15)));

  return {
    success: true,
    newPostCount,
    platformCount: ALL_PLATFORMS.length,
    platformResults,
    message: `Full auto search completed — ${newPostCount} new posts across ${ALL_PLATFORMS.length} platforms.`,
  };
}

function getAutoSearchSettings(store) {
  let settings = { dailyEnabled: true, frequency: 'daily' };
  try { settings = { dailyEnabled: true, frequency: 'daily', ...JSON.parse(store.getItem('autoSearchSettings') || '{}') }; } catch (e) { /* ignore */ }
  let rules = {};
  try { rules = JSON.parse(store.getItem('autoRulesEngine') || '{}'); } catch (e) { /* ignore */ }
  if (!settings.frequency && rules.autoSearchFrequency) settings.frequency = rules.autoSearchFrequency;
  settings.lastRun = parseInt(store.getItem('fullAutoSearchLastRun') || '0', 10) || null;
  settings.beFirstMonitorFrequency = rules.beFirstMonitorFrequency || rules.frequency || '10m';
  settings.beFirstLastRun = parseInt(store.getItem('beFirstMonitorLastRun') || '0', 10) || null;
  return settings;
}

function saveAutoSearchSettings(store, integrations, settings) {
  const merged = { dailyEnabled: true, frequency: 'daily', ...(settings || {}) };
  store.setItem('autoSearchSettings', JSON.stringify(merged));
  try {
    const rules = JSON.parse(store.getItem('autoRulesEngine') || '{}');
    rules.autoSearchFrequency = merged.frequency;
    rules.oneClickAutoSearchEnabled = merged.dailyEnabled !== false;
    if (merged.beFirstMonitorFrequency) rules.beFirstMonitorFrequency = merged.beFirstMonitorFrequency;
    store.setItem('autoRulesEngine', JSON.stringify(rules));
    if (integrations?.syncRulesSideEffects) integrations.syncRulesSideEffects(store, rules);
  } catch (e) { /* ignore */ }
  return { success: true, settings: merged };
}

module.exports = { runFullAutoSearch, getAutoSearchSettings, saveAutoSearchSettings };