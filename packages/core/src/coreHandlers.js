/**
 * Core IPC handlers ported from apps/desktop/index.js for SaaS.
 */
const path = require('path');
const axios = require('axios');
const { createAiEngine } = require(path.join(__dirname, '../../../apps/desktop/saasAi'));

function registerCoreHandlers(deps) {
  const {
    ipcMain, store, integrations, resolveKeys, buildApiMetrics,
    calendarApi, FREQUENCY_OPTIONS, userDataPath,
  } = deps;

  const { generateAI } = createAiEngine(store);
  deps.generateAI = generateAI;

  const { fetchRealFeed, fetchTrendingTopics } = require(path.join(deps.DESKTOP_SERVICES || '../../../apps/desktop/services', 'feedFetcher'));
  const brandGuidelines = require(path.join(__dirname, '../../../apps/desktop/services/brandGuidelines'));
  const { buildGlobalCustomPromptRequest } = require(path.join(__dirname, '../../../apps/desktop/services/customPromptGenerator'));
  const aiReplyStore = require(path.join(__dirname, '../../../apps/desktop/services/aiReplyStore'));

  const getCampaign = () => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const camps = JSON.parse(store.getItem('campaigns') || '[]');
    return camps.find((c) => c.id === activeId) || { brandName: 'Your Brand' };
  };

  ipcMain.handle('save-settings', (event, data) => {
    store.setItem('campaigns', JSON.stringify(data));
    return { success: true };
  });

  ipcMain.handle('set-active-campaign', (event, campaignId) => {
    store.setItem('activeCampaignId', campaignId);
    return { success: true };
  });

  ipcMain.handle('save-global-keys', (event, keys) => {
    store.setItem('globalApiKeys', JSON.stringify(keys));
    return true;
  });

  ipcMain.handle('get-global-keys', () => {
    let stored = {};
    try { stored = JSON.parse(store.getItem('globalApiKeys') || '{}'); } catch (e) {}
    const keys = resolveKeys(stored);
    store.setItem('globalApiKeys', JSON.stringify(keys));
    return keys;
  });

  ipcMain.handle('get-active-campaign', () => {
    const activeId = store.getItem('activeCampaignId');
    const campaigns = JSON.parse(store.getItem('campaigns') || '[]');
    if (!campaigns.length) return null;
    if (activeId) {
      const found = campaigns.find((c) => c.id === activeId);
      if (found) return found;
    }
    store.setItem('activeCampaignId', campaigns[0].id);
    return campaigns[0];
  });

  ipcMain.handle('get-settings', () => JSON.parse(store.getItem('campaigns') || '[]'));

  ipcMain.handle('get-setup-status', () => {
    const activeCampaignId = store.getItem('activeCampaignId') || 'default';
    const campaigns = JSON.parse(store.getItem('campaigns') || '[]');
    const campaign = campaigns.find((c) => c.id === activeCampaignId) || campaigns[0] || null;
    const hasProject = !!(campaign?.brandName?.trim() && campaign?.domain?.trim());
    const keywords = JSON.parse(store.getItem('keywords') || '[]')
      .filter((k) => k.campaignId === (campaign?.id || activeCampaignId));
    const onboardingComplete = store.getItem('onboardingComplete') === 'true';
    const linkedAccountsCount = JSON.parse(store.getItem(`linkedAccounts_${activeCampaignId}`) || '[]').length;
    const globalKeys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    let nextStep = 1;
    if (hasProject && !keywords.length) nextStep = 2;
    else if (hasProject && keywords.length && !onboardingComplete) nextStep = 3;
    else if (hasProject && keywords.length && onboardingComplete) nextStep = 4;
    return {
      hasProject, hasKeywords: keywords.length > 0, onboardingComplete,
      complete: hasProject && keywords.length && onboardingComplete,
      nextStep, campaign, keywords, linkedAccountsCount,
      hasLinkedAccounts: linkedAccountsCount > 0,
      apiMetrics: buildApiMetrics(globalKeys),
    };
  });

  ipcMain.handle('set-onboarding-complete', (event, value) => {
    store.setItem('onboardingComplete', value ? 'true' : 'false');
    return { success: true };
  });

  ipcMain.handle('delete-campaign', (event, campaignId) => {
    let campaigns = JSON.parse(store.getItem('campaigns') || '[]');
    campaigns = campaigns.filter((c) => c.id !== campaignId);
    store.setItem('campaigns', JSON.stringify(campaigns));
    if (store.getItem('activeCampaignId') === campaignId) {
      if (campaigns.length) store.setItem('activeCampaignId', campaigns[0].id);
      else store.removeItem('activeCampaignId');
    }
    return { success: true, campaigns };
  });

  ipcMain.handle('get-live-feed', async (event, filters = {}) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const activeId = store.getItem('activeCampaignId') || 'default';
    const keywords = JSON.parse(store.getItem('keywords') || '[]')
      .filter((k) => k.campaignId === activeId).map((k) => k.term);
    const allowedPlatforms = new Set(
      JSON.parse(store.getItem('keywords') || '[]')
        .filter((k) => k.campaignId === activeId)
        .flatMap((k) => (k.platforms || ['All'])),
    );
    return fetchRealFeed({ keywords, filters, keys, allowedPlatforms });
  });

  ipcMain.handle('get-simulated-feed', async (event, filters = {}) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return fetchRealFeed({ keywords: ['marketing'], filters, keys, allowedPlatforms: new Set(['All']) });
  });

  ipcMain.handle('generate-keywords', async (event, brandData) => {
    const prompt = `Suggest 8 high-intent social media keywords for brand "${brandData?.brandName || 'brand'}" domain ${brandData?.domain || ''}. Return comma-separated only.`;
    const text = await generateAI(prompt);
    return text.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);
  });

  ipcMain.handle('save-keywords', (event, payload) => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const incoming = Array.isArray(payload) ? payload : (payload?.keywords || []);
    let all = JSON.parse(store.getItem('keywords') || '[]').filter((k) => k.campaignId !== activeId);
    incoming.forEach((kw) => {
      all.push({
        id: kw.id || `kw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        term: kw.term || kw,
        campaignId: activeId,
        platforms: kw.platforms || ['All'],
        intentTags: kw.intentTags || [],
        customPrompt: kw.customPrompt || '',
      });
    });
    store.setItem('keywords', JSON.stringify(all));
    return { success: true, count: incoming.length };
  });

  ipcMain.handle('get-keywords', (event, campaignId) => {
    const id = campaignId || store.getItem('activeCampaignId') || 'default';
    return JSON.parse(store.getItem('keywords') || '[]').filter((k) => k.campaignId === id);
  });

  ipcMain.handle('delete-keyword', (event, payload) => {
    const id = typeof payload === 'string' ? payload : payload?.id;
    const all = JSON.parse(store.getItem('keywords') || '[]').filter((k) => k.id !== id);
    store.setItem('keywords', JSON.stringify(all));
    return { success: true };
  });

  ipcMain.handle('get-auto-rules', () => JSON.parse(store.getItem('autoRulesEngine') || 'null'));
  ipcMain.handle('save-auto-rules', async (event, settings) => {
    store.setItem('autoRulesEngine', JSON.stringify(settings));
    return { success: true };
  });
  ipcMain.handle('get-auto-rules-status', () => integrations.getAutoRulesStatus(store));
  ipcMain.handle('run-auto-rules-now', async () => integrations.runWorkerCycle({ store, generateAI, sendNotification: () => {} }));

  ipcMain.handle('generate-ai', async (event, userPrompt) => generateAI(userPrompt));
  ipcMain.handle('draft-post-reply', async (event, payload) => {
    const campaign = getCampaign();
    const post = payload?.post || payload;
    const prompt = brandGuidelines.buildReplyPrompt(campaign, post, payload?.customPrompt);
    return generateAI(prompt);
  });

  ipcMain.handle('generate-global-custom-prompt', async () => {
    const campaign = getCampaign();
    return generateAI(buildGlobalCustomPromptRequest(campaign));
  });

  ipcMain.handle('get-linked-accounts', (event, campaignId) => {
    const id = campaignId || store.getItem('activeCampaignId') || 'default';
    return JSON.parse(store.getItem(`linkedAccounts_${id}`) || '[]');
  });

  ipcMain.handle('publish-post', async (event, postData) => calendarApi.executePublishPost(postData));
  ipcMain.handle('get-post-history', () => JSON.parse(store.getItem('postHistory') || '[]'));
  ipcMain.handle('get-all-post-history', () => JSON.parse(store.getItem('postHistory') || '[]'));

  ipcMain.handle('engage-post', async (event, payload) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const activeId = store.getItem('activeCampaignId') || 'default';
    const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    return integrations.engagePost(payload, keys, linkedAccounts);
  });

  ipcMain.handle('get-dashboard-stats', async () => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const keywords = JSON.parse(store.getItem('keywords') || '[]').filter((k) => k.campaignId === activeId);
    const replies = JSON.parse(store.getItem('aiRepliesHistory') || '[]');
    const published = JSON.parse(store.getItem('postHistory') || '[]');
    return {
      totalPosts: published.length,
      aiDrafts: replies.filter((r) => r.status === 'draft').length,
      activeKeywords: keywords.length,
      leadsGenerated: JSON.parse(store.getItem('leads') || '[]').length,
    };
  });

  ipcMain.handle('get-trending-topics', async () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return fetchTrendingTopics(keys);
  });

  ipcMain.handle('get-live-news', async (event, query = 'technology') => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const { fetchNewsAsPosts } = require(path.join(__dirname, '../../../apps/desktop/services/feedFetcher'));
    const posts = await fetchNewsAsPosts(keys, query, 4);
    return posts.map((p) => ({ title: p.content.split('\n')[0], url: p.url, source: p.author }));
  });

  ipcMain.handle('get-ai-replies', () => aiReplyStore.getReplies(store));
  ipcMain.handle('get-ai-replies-hub', () => aiReplyStore.getReplies(store));
  ipcMain.handle('save-ai-reply', (event, reply) => aiReplyStore.saveReply(store, reply));
  ipcMain.handle('publish-ai-reply', async (event, id) => aiReplyStore.publishReply(store, id, calendarApi));

  ipcMain.handle('discover-best-questions', async () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return integrations.discoverQuestions(store, keys, getCampaign(), generateAI);
  });

  ipcMain.handle('scan-reddit-now', async () => {
    const leads = await integrations.runRedditProspector(store, resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}')), getCampaign());
    return { success: true, leads };
  });

  ipcMain.handle('get-leads', () => JSON.parse(store.getItem('leads') || '[]'));
  ipcMain.handle('save-lead', (event, lead) => {
    const leads = JSON.parse(store.getItem('leads') || '[]');
    leads.unshift(lead);
    store.setItem('leads', JSON.stringify(leads.slice(0, 100)));
    return { success: true };
  });

  ipcMain.handle('get-schedule-frequency-options', () => FREQUENCY_OPTIONS);
  ipcMain.handle('get-auto-search-settings', () => JSON.parse(store.getItem('autoSearchSettings') || '{}'));
  ipcMain.handle('save-auto-search-settings', (event, s) => {
    store.setItem('autoSearchSettings', JSON.stringify(s));
    return { success: true };
  });

  ipcMain.handle('save-watched-monitors', (event, monitors) => {
    store.setItem('watchedMonitors', JSON.stringify(monitors));
    return { success: true };
  });
  ipcMain.handle('get-watched-monitors', () => JSON.parse(store.getItem('watchedMonitors') || '[]'));

  ipcMain.handle('get-worker-status', () => ({
    running: store.getItem('workerRunningFlag') === 'true',
    tasks: JSON.parse(store.getItem('workerTasks') || '[]').slice(0, 20),
  }));
  ipcMain.handle('start-worker', () => { store.setItem('workerRunningFlag', 'true'); return { success: true }; });
  ipcMain.handle('stop-worker', () => { store.setItem('workerRunningFlag', 'false'); return { success: true }; });

  ipcMain.handle('check-api-status', async () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return buildApiMetrics(keys);
  });

  ipcMain.handle('get-page-health', async () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return { ok: true, apiMetrics: buildApiMetrics(keys), pages: 18 };
  });

  ipcMain.handle('shorten-url', async (event, url) => {
    const key = process.env.TINYURL_API_KEY;
    if (!key) return { shortUrl: url };
    const res = await axios.get(`https://api.tinyurl.com/create?api_token=${key}&url=${encodeURIComponent(url)}`);
    return { shortUrl: res.data?.data?.tiny_url || url };
  });

  ipcMain.handle('export-data', () => {
    const keys = ['campaigns', 'keywords', 'postHistory', 'aiRepliesHistory', 'scheduled_posts', 'leads'];
    const out = {};
    keys.forEach((k) => { if (store.getItem(k)) out[k] = JSON.parse(store.getItem(k)); });
    return out;
  });
}

module.exports = { registerCoreHandlers };