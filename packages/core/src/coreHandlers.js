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

  ipcMain.handle('get-auto-rules', () => {
    try { return JSON.parse(store.getItem('autoRulesEngine') || '{}'); } catch (e) { return {}; }
  });
  ipcMain.handle('save-auto-rules', async (event, settings) => {
    const existing = integrations.getAutoRulesStatus(store).rules || {};
    const merged = {
      ...existing,
      ...(settings || {}),
      enabled: settings?.enabled !== false,
      updatedAt: new Date().toISOString(),
    };
    store.setItem('autoRulesEngine', JSON.stringify(merged));
    integrations.syncRulesSideEffects(store, merged);
    return { success: true, rules: merged };
  });
  ipcMain.handle('get-auto-rules-status', () => integrations.getAutoRulesStatus(store));
  ipcMain.handle('run-auto-rules-now', async () => integrations.runWorkerCycle({ store, generateAI, sendNotification: () => {} }));

  ipcMain.handle('generate-ai', async (event, userPrompt) => generateAI(userPrompt));
  ipcMain.handle('draft-post-reply', async (event, payload) => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const campaigns = JSON.parse(store.getItem('campaigns') || '[]');
    const settings = campaigns.find((c) => c.id === activeId) || getCampaign();
    let rules = null;
    try { rules = JSON.parse(store.getItem('autoRulesEngine') || 'null'); } catch (e) {}
    const postContent = payload?.postContent || payload?.post?.content || payload?.content || '';
    const keywordObj = brandGuidelines.getKeywordFromStore(store, activeId, payload?.matchedKeyword);
    const systemPrompt = `${brandGuidelines.buildReplySystemPrompt(settings, { keywordObj, oneTimeOverride: payload?.oneTimeOverride, rules })}

Post to reply to:
"${postContent}"
`;
    return generateAI(systemPrompt + '\n\nUser requested reply for this post:\n' + postContent);
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
    return fetchTrendingTopics('All', keys);
  });

  ipcMain.handle('get-live-news', async (event, query = 'technology') => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const { fetchNewsAsPosts } = require(path.join(__dirname, '../../../apps/desktop/services/feedFetcher'));
    const posts = await fetchNewsAsPosts(keys, query, 4);
    return posts.map((p) => ({ title: p.content.split('\n')[0], url: p.url, source: p.author }));
  });

  ipcMain.handle('get-ai-replies', (event, campaignId = null) => {
    const hub = aiReplyStore.queryHub(store, {
      campaignId: campaignId === 'all' ? 'all' : (campaignId || store.getItem('activeCampaignId') || 'default'),
    });
    return hub.replies;
  });
  ipcMain.handle('get-ai-replies-hub', (event, filters = {}) => aiReplyStore.queryHub(store, filters));
  ipcMain.handle('save-ai-reply', async (event, replyData) => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    return aiReplyStore.upsertReply(store, replyData, activeId);
  });
  ipcMain.handle('publish-ai-reply', async (event, id) => {
    const replies = aiReplyStore.loadAllReplies(store);
    const reply = replies.find((r) => r.id === id);
    if (!reply) return { success: false, error: 'Reply not found' };
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const activeId = store.getItem('activeCampaignId') || 'default';
    const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    if (reply.externalId) {
      try {
        await integrations.engagePost({
          action: 'reply', platform: reply.platform, content: reply.replyContent,
          externalId: reply.externalId, postId: reply.externalId, url: reply.url,
          author: reply.author, postContent: reply.originalPost,
        }, keys, linkedAccounts);
      } catch (e) { return { success: false, error: e.message }; }
    }
    const idx = replies.findIndex((r) => r.id === id);
    replies[idx] = { ...reply, status: 'published', publishedAt: new Date().toISOString() };
    aiReplyStore.saveAllReplies(store, replies);
    return { success: true, reply: replies[idx] };
  });

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

  // Keyword research
  ipcMain.handle('research-keyword', async (event, term) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return integrations.researchSingleKeyword(term, keys);
  });
  ipcMain.handle('get-keyword-api-status', () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return integrations.getApiStatus(keys);
  });

  // Visual automation builder
  ipcMain.handle('get-automation-flow', () => integrations.getActiveFlow(store) || { status: 'draft', nodes: [], edges: [] });
  ipcMain.handle('save-automation-flow', (event, flowData) => {
    const existing = integrations.getActiveFlow(store) || {};
    const flow = { ...existing, ...flowData, status: flowData.status || existing.status || 'draft', updatedAt: new Date().toISOString() };
    integrations.saveActiveFlow(store, flow);
    return { success: true, flow };
  });
  ipcMain.handle('get-automation-templates', () => integrations.listTemplates(store));
  ipcMain.handle('load-automation-template', (event, templateId) => {
    const template = integrations.getTemplateById(store, templateId);
    if (!template) return { success: false, error: 'Template not found' };
    return { success: true, nodes: template.nodes, edges: template.edges, name: template.name };
  });
  ipcMain.handle('save-automation-template', (event, templateData) => {
    if (!templateData?.name) return { success: false, error: 'Template name required' };
    integrations.saveCustomTemplate(store, {
      name: templateData.name,
      nodes: templateData.nodes || [],
      edges: templateData.edges || [],
      savedAt: new Date().toISOString(),
    });
    return { success: true };
  });
  ipcMain.handle('deploy-automation-flow', async (event, flowData) => integrations.deployFlow(store, flowData));
  ipcMain.handle('undeploy-automation-flow', () => integrations.undeployFlow(store));
  ipcMain.handle('test-automation-flow', async (event, flowData) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return integrations.testAutomationFlow({ store, generateAI, sendNotification: () => {}, keys }, flowData);
  });
  ipcMain.handle('get-automation-webhook-url', (event, nodeId) => {
    const webhookId = integrations.ensureWebhookId(store, nodeId);
    return { webhookId, url: integrations.getWebhookUrl(webhookId), port: integrations.WEBHOOK_PORT };
  });
  ipcMain.handle('get-automation-status', () => integrations.getAutomationStatus(store));
  ipcMain.handle('get-automation-builder-data', async () => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const accounts = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    const keywords = JSON.parse(store.getItem('keywords') || '[]')
      .filter((k) => k.campaignId === activeId).map((k) => k.term);
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const { hasTwitterKeys, hasLinkedInKeys, hasRedditKeys } = require(path.join(__dirname, '../../../apps/desktop/services/keys'));
    return {
      accounts: accounts.map((a) => ({ id: a.id, platform: a.platform, handle: a.handle || a.username || a.id })),
      keywords,
      apiStatus: { twitter: hasTwitterKeys(keys), linkedin: hasLinkedInKeys(keys), reddit: hasRedditKeys(keys), serp: !!keys.serpApiKey, gemini: !!keys.gemini },
    };
  });

  // Engagement CRM
  ipcMain.handle('get-engagement-lists', () => {
    const custom = integrations.getLists(store);
    const top = integrations.buildTopCommentersList(store);
    return [top, ...custom];
  });
  ipcMain.handle('save-engagement-list', (event, listData) => {
    const lists = integrations.getLists(store);
    const profileUrls = (listData.profileUrls || []).flatMap((u) => String(u).split('\n')).map((u) => u.trim()).filter(Boolean);
    const entry = {
      id: listData.id || `elist_${Date.now()}`,
      name: listData.name,
      type: listData.type || 'Custom',
      profileUrls,
      autoEngage: !!listData.autoEngage,
      createdAt: listData.createdAt || new Date().toISOString(),
    };
    const idx = lists.findIndex((l) => l.id === entry.id);
    if (idx >= 0) lists[idx] = { ...lists[idx], ...entry };
    else lists.push(entry);
    integrations.saveLists(store, lists);
    return { success: true, list: entry };
  });
  ipcMain.handle('delete-engagement-list', (event, listId) => {
    if (listId === integrations.TOP_LIST_ID) return { success: false, error: 'Cannot delete the system Top Commenters list' };
    const lists = integrations.getLists(store).filter((l) => l.id !== listId);
    integrations.saveLists(store, lists);
    return { success: true };
  });
  ipcMain.handle('get-engagement-list-feed', async (event, listId) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const allLists = [integrations.buildTopCommentersList(store), ...integrations.getLists(store)];
    const list = allLists.find((l) => l.id === listId);
    if (!list) return { posts: [], error: 'List not found' };
    try {
      const posts = await integrations.fetchListFeed(list, keys);
      return { posts, listName: list.name, profileCount: list.profileUrls?.length || list.supporterCount || 0 };
    } catch (e) {
      return { posts: [], error: e.message };
    }
  });
  ipcMain.handle('toggle-engagement-list-auto', (event, { listId, enabled }) => {
    if (listId === integrations.TOP_LIST_ID) return { success: false, error: 'Auto-engage is not available on the analytics list' };
    const lists = integrations.getLists(store);
    const idx = lists.findIndex((l) => l.id === listId);
    if (idx < 0) return { success: false, error: 'List not found' };
    lists[idx].autoEngage = !!enabled;
    integrations.saveLists(store, lists);
    return { success: true, autoEngage: lists[idx].autoEngage };
  });
  ipcMain.handle('post-linkedin-comment', async (event, payload) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const activeId = store.getItem('activeCampaignId') || 'default';
    const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    try {
      await integrations.engageOnPost({
        action: 'comment', platform: 'LinkedIn', content: payload.comment,
        urn: payload.urn, url: payload.url, externalId: payload.urn || payload.externalId,
        author: payload.author, postContent: payload.postContent,
      }, keys, linkedAccounts);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Account hub
  ipcMain.handle('get-account-hub-status', () => integrations.getAccountHubStatus(store));
  ipcMain.handle('unlink-account', (event, accountId) => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    let accounts = [];
    try { accounts = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]'); } catch (e) {}
    accounts = accounts.filter((a) => a.id !== accountId);
    store.setItem(`linkedAccounts_${activeId}`, JSON.stringify(accounts));
    return { success: true };
  });
  ipcMain.handle('link-account', async (event, payload) => {
    const creds = typeof payload === 'string' ? { platform: payload } : (payload || {});
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const openOAuth = typeof deps.openExternal === 'function' ? deps.openExternal : () => {};
    return integrations.discoverAccounts({
      platform: creds.platform,
      email: creds.email,
      username: creds.username,
      password: creds.password || '',
      useCredentials: creds.method !== 'oauth',
      connectionId: creds.connectionId,
    }, keys, (url) => openOAuth(url));
  });

  // AI replies hub (update/delete)
  ipcMain.handle('update-ai-reply', (event, { id, updates }) => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const replies = aiReplyStore.loadAllReplies(store);
    const idx = replies.findIndex((r) => r.id === id);
    if (idx < 0) return { success: false, error: 'Reply not found' };
    replies[idx] = aiReplyStore.normalizeReply({
      ...replies[idx], ...updates, updatedAt: new Date().toISOString(),
    }, replies[idx].campaignId || activeId);
    aiReplyStore.saveAllReplies(store, replies);
    return { success: true, reply: replies[idx] };
  });
  ipcMain.handle('delete-ai-reply', (event, id) => {
    const replies = aiReplyStore.loadAllReplies(store).filter((r) => r.id !== id);
    aiReplyStore.saveAllReplies(store, replies);
    return { success: true };
  });

  // Q&A / Quora pipeline
  ipcMain.handle('get-qa-settings', () => {
    let settings = {};
    try { settings = JSON.parse(store.getItem('qaSettings') || '{}'); } catch (e) {}
    return { minViews: 500, minTime: '24h', freq: 'daily', requireNoBrandAnswer: true, ...settings };
  });
  ipcMain.handle('save-qa-settings', (event, settings) => {
    store.setItem('qaSettings', JSON.stringify(settings || {}));
    return { success: true };
  });
  ipcMain.handle('get-best-questions', () => {
    try { return JSON.parse(store.getItem('bestQuestionsForBusiness') || '[]'); } catch (e) { return []; }
  });
  ipcMain.handle('compose-qa-answer', async (event, payload) => {
    const campaign = getCampaign();
    const answer = await integrations.composeAnswer({
      question: payload?.question || { content: payload?.postContent || '' },
      campaign, store, generateAI, oneTimeOverride: payload?.oneTimeOverride,
    });
    const platform = payload?.question?.platform || payload?.platform || 'Reddit';
    const formatted = integrations.formatForPlatform(answer, platform);
    return { success: true, answer, formatted, platform };
  });
  ipcMain.handle('get-unanswered-questions', async () => {
    const campaign = getCampaign();
    const lastScan = parseInt(store.getItem('qaLastScan') || '0', 10);
    if (Date.now() - lastScan > 300000) {
      const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
      await integrations.scanUnansweredQuestions(store, keys, campaign, generateAI);
      store.setItem('qaLastScan', Date.now().toString());
    }
    try {
      return JSON.parse(store.getItem('unansweredQuestions') || '[]').slice(0, 80)
        .map((q) => ({ ...q, networkSize: q.networkSize || '30M+' }));
    } catch (e) { return []; }
  });
  ipcMain.handle('publish-qa-answer', async (event, payload) => {
    const { question, answer, platform } = payload || {};
    if (!answer) return { success: false, error: 'No answer provided' };
    const activeId = store.getItem('activeCampaignId') || 'default';
    const globalKeys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    const formatted = integrations.formatForPlatform(answer, platform || question?.platform);
    if (question?.url || question?.externalId) {
      try {
        await integrations.engagePost({
          action: 'reply', platform: platform || question.platform, content: formatted,
          externalId: question.externalId, postId: question.externalId, url: question.url,
          author: question.author, postContent: question.content,
        }, globalKeys, linkedAccounts, null, store);
      } catch (e) { return { success: false, error: e.message }; }
    }
    aiReplyStore.upsertReply(store, {
      id: `qa_${Date.now()}`, originalPost: question?.content || '', replyContent: formatted,
      platform: platform || question?.platform || 'Quora', status: 'published',
    });
    return { success: true, formatted };
  });

  ipcMain.handle('trigger-full-auto-search', async () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const result = await integrations.runWorkerCycle({ store, generateAI, sendNotification: () => {} });
    await integrations.scanUnansweredQuestions(store, keys, getCampaign(), generateAI);
    return { success: true, ...result };
  });

}

module.exports = { registerCoreHandlers };