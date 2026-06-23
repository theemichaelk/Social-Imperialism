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

  const desktopServicesPath = deps.DESKTOP_SERVICES || path.join(__dirname, '../../../apps/desktop/services');
  const { fetchRealFeed, fetchTrendingTopics } = require(path.join(desktopServicesPath, 'feedFetcher'));
  const { fetchLinkedAccountFeed } = require(path.join(desktopServicesPath, 'accountFeedFetcher'));
  const feedCache = new Map();
  const FEED_CACHE_TTL_MS = 3 * 60 * 1000;
  const qaDiscoveryCache = { data: null, ts: 0 };
  const QA_DISCOVERY_CACHE_TTL_MS = 10 * 60 * 1000;
  const { withTimeout } = require(path.join(desktopServicesPath, 'asyncUtils'));
  const brandGuidelines = require(path.join(__dirname, '../../../apps/desktop/services/brandGuidelines'));
  const { buildGlobalCustomPromptRequest } = require(path.join(__dirname, '../../../apps/desktop/services/customPromptGenerator'));
  const aiReplyStore = require(path.join(__dirname, '../../../apps/desktop/services/aiReplyStore'));
  const { runFullAutoSearch, getAutoSearchSettings, saveAutoSearchSettings } = require(path.join(__dirname, '../../../apps/desktop/services/fullAutoSearch'));
  const saasNotifications = require(path.join(__dirname, '../../../apps/desktop/services/saasNotifications'));
  const sendNotification = (payload) => saasNotifications.sendNotification(store, payload);

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

  const s3Upload = require(path.join(desktopServicesPath, 's3Upload'));

  ipcMain.handle('get-s3-status', () => s3Upload.getS3Status());
  ipcMain.handle('list-s3-uploads', async (event, payload = {}) => s3Upload.listUploads(payload));
  ipcMain.handle('upload-to-s3', async (event, payload = {}) => {
    const { dataUrl, filename, folder } = payload || {};
    if (!dataUrl) throw new Error('dataUrl required');
    return s3Upload.uploadDataUrl(dataUrl, filename, folder);
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
    const effFilters = {
      ...filters,
      quick: filters?.quick !== false && filters?.refresh !== true,
    };
    const cacheKey = `${activeId}:${JSON.stringify({ platform: effFilters?.platform, sort: effFilters?.sort, quick: effFilters?.quick })}`;
    if (!effFilters?.refresh) {
      const cached = feedCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < FEED_CACHE_TTL_MS) return cached.data;
    }
    const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    linkedAccounts.forEach((acc) => { if (acc.platform) allowedPlatforms.add(acc.platform); });

    let discovered = [];
    try {
      discovered = JSON.parse(store.getItem('discoveredPostsCache') || '[]')
        .filter((p) => !p.campaignId || p.campaignId === activeId);
    } catch (e) { /* ignore */ }

    const feedTimeoutMs = effFilters.quick ? 22000 : 48000;
    const buildFeed = async () => {
      const [keywordPosts, accountPosts] = await Promise.all([
        fetchRealFeed({ keywords, filters: effFilters, keys, allowedPlatforms }),
        fetchLinkedAccountFeed({ linkedAccounts, filters: effFilters, keys, limitPerAccount: effFilters?.quick ? 5 : 8 }),
      ]);

      const seen = new Set();
      let data = [...discovered, ...accountPosts, ...keywordPosts].filter((p) => {
        const key = `${p.platform}:${p.externalId || p.url || p.content?.substring(0, 50)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const { applyFeedFilters } = require(path.join(desktopServicesPath, 'feedFilters'));
      data = applyFeedFilters(data, effFilters);
      return data;
    };

    let data = await withTimeout(buildFeed(), feedTimeoutMs, null);
    if (!data || !data.length) {
      const stale = feedCache.get(cacheKey);
      if (stale?.data?.length) return stale.data;
      if (discovered.length) return discovered;
      data = await fetchRealFeed({
        keywords: keywords.length ? keywords.slice(0, 2) : ['marketing'],
        filters: { ...effFilters, quick: true },
        keys,
        allowedPlatforms: new Set(['All']),
      }).catch(() => []);
    }

    feedCache.set(cacheKey, { data, ts: Date.now() });
    return data;
  });

  ipcMain.handle('get-simulated-feed', async (event, filters = {}) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return fetchRealFeed({ keywords: ['marketing'], filters, keys, allowedPlatforms: new Set(['All']) });
  });

  ipcMain.handle('generate-keywords', async (event, brandData) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const fastKeywords = async () => {
      const prompt = `Suggest 8 high-intent social media keywords for brand "${brandData?.brandName || 'brand'}" domain ${brandData?.domain || ''}. Return comma-separated only.`;
      const text = await withTimeout(generateAI(prompt), 22000, '');
      return String(text || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);
    };
    try {
      const result = await withTimeout(
        integrations.researchBrandKeywords(brandData, keys, generateAI),
        28000,
        null,
      );
      if (result && Array.isArray(result.keywords) && result.keywords.length) return result.keywords;
      return await fastKeywords();
    } catch (e) {
      return await fastKeywords();
    }
  });

  ipcMain.handle('save-keywords', (event, payload) => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const merge = payload?.merge === true;
    const incoming = Array.isArray(payload) ? payload : (payload?.keywords || []);
    let all = JSON.parse(store.getItem('keywords') || '[]');
    if (!merge) all = all.filter((k) => k.campaignId !== activeId);
    incoming.forEach((kw) => {
      const term = (kw.term || kw || '').toString().trim();
      if (!term) return;
      const intentTags = kw.intentTags || (kw.intent ? [kw.intent] : []);
      const entry = {
        id: kw.id || `kw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        term,
        campaignId: activeId,
        platforms: kw.platforms?.length ? kw.platforms : ['All'],
        intentTags,
        intent: kw.intent || intentTags[0] || 'mentions',
        customPrompt: kw.customPrompt || '',
      };
      const idx = all.findIndex((k) => k.campaignId === activeId && (kw.id ? k.id === kw.id : k.term.toLowerCase() === term.toLowerCase()));
      if (idx >= 0) all[idx] = { ...all[idx], ...entry };
      else all.push(entry);
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
    if (settings?.replyMode) {
      merged.autoReplyMode = settings.replyMode === 'mentions' ? 'mentions_only'
        : settings.replyMode === 'all' ? 'all_matching' : 'draft_only';
      merged.replyMode = settings.replyMode;
    }
    store.setItem('autoRulesEngine', JSON.stringify(merged));
    integrations.syncRulesSideEffects(store, merged);
    return { success: true, rules: merged };
  });
  ipcMain.handle('get-auto-rules-status', () => integrations.getAutoRulesStatus(store));
  ipcMain.handle('run-auto-rules-now', async () => integrations.runWorkerCycle({ store, generateAI, sendNotification }));

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
    const raw = await generateAI(systemPrompt + '\n\nUser requested reply for this post:\n' + postContent);
    const { injectUtmInReply } = require(path.join(desktopServicesPath, 'utmLinks'));
    const text = injectUtmInReply(String(raw || ''), settings).text || String(raw || '').trim();
    return text || 'Thanks for sharing — we would love to connect and explore how we can help.';
  });

  ipcMain.handle('search-discovered-posts', (event, query = {}) => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const q = (query.q || query.keyword || '').toString().toLowerCase().trim();
    const platform = query.platform;
    let posts = [];
    try {
      posts = JSON.parse(store.getItem('discoveredPostsCache') || '[]')
        .filter((p) => !p.campaignId || p.campaignId === activeId);
    } catch (e) { /* ignore */ }
    if (platform && platform !== 'All') {
      posts = posts.filter((p) => (p.platform || '').toLowerCase().includes(platform.toLowerCase()));
    }
    if (q) {
      posts = posts.filter((p) => `${p.content || ''} ${p.author || ''} ${p.matchedKeyword || ''}`.toLowerCase().includes(q));
    }
    const limit = Math.min(parseInt(query.limit, 10) || 50, 200);
    return posts.slice(0, limit);
  });

  ipcMain.handle('get-qa-ad-suggestions', async () => {
    const campaign = getCampaign();
    let questions = [];
    try { questions = JSON.parse(store.getItem('bestQuestionsForBusiness') || '[]'); } catch (e) {}
    if (!questions.length) {
      try {
        const unanswered = JSON.parse(store.getItem('unansweredQuestions') || '[]');
        questions = unanswered.slice(0, 5);
      } catch (e) { /* ignore */ }
    }
    const top = questions.slice(0, 5).map((q) => q.content || q.question || '').filter(Boolean);
    if (!top.length) {
      return { suggestions: [], message: 'Discover questions first to generate ad campaign ideas.' };
    }
    const prompt = `Brand: ${campaign.brandName || 'Brand'} (${campaign.domain || ''})
Top Q&A questions for inbound marketing:
${top.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Suggest 3 social ad campaign concepts (Meta, X, LinkedIn) targeting these questions.
Return JSON array: [{ "platform": "...", "headline": "...", "audience": "...", "cta": "..." }]`;
    try {
      const text = await generateAI(prompt);
      const match = text.match(/\[[\s\S]*\]/);
      const suggestions = match ? JSON.parse(match[0]) : [];
      return { suggestions, questionsUsed: top.length };
    } catch (e) {
      return { suggestions: [], error: e.message };
    }
  });

  ipcMain.handle('generate-global-custom-prompt', async () => {
    const campaign = getCampaign();
    const prompt = await generateAI(buildGlobalCustomPromptRequest(campaign));
    return { success: true, prompt, customPrompt: prompt };
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
    try {
      return await integrations.engagePost(payload, keys, linkedAccounts);
    } catch (e) {
      const { isEngageablePost } = require(path.join(__dirname, '../../../apps/desktop/services/postIdUtils'));
      if (!isEngageablePost(payload)) {
        throw new Error('This post was found via web search — open the link to engage on the platform directly.');
      }
      const log = {
        id: `eng_${Date.now()}`,
        platform: payload.platform,
        action: payload.action,
        externalId: payload.externalId,
        content: payload.content || payload.postContent,
        status: 'queued',
        error: e.message,
        queuedAt: new Date().toISOString(),
        campaignId: activeId,
      };
      let queue = [];
      try { queue = JSON.parse(store.getItem('engagementQueue') || '[]'); } catch (err) {}
      queue.unshift(log);
      store.setItem('engagementQueue', JSON.stringify(queue.slice(0, 100)));
      return {
        success: true,
        queued: true,
        message: `Live ${payload.action} queued — ${e.message}`,
        engagement: log,
      };
    }
  });

  ipcMain.handle('get-dashboard-stats', async () => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const keywords = JSON.parse(store.getItem('keywords') || '[]').filter((k) => k.campaignId === activeId);
    const replies = JSON.parse(store.getItem('aiRepliesHistory') || '[]');
    const published = JSON.parse(store.getItem('postHistory') || '[]');
    let totalEngagement = 0;
    published.forEach((post) => {
      const s = post.stats || {};
      totalEngagement += (s.likes || 0) + (s.shares || 0) + (s.views || 0) + (s.comments || 0);
    });
    const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    const scheduled = JSON.parse(store.getItem('scheduled_posts') || '[]')
      .filter((p) => !p.campaignId || p.campaignId === activeId);
    const leads = JSON.parse(store.getItem('leads') || '[]');
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    let autoRulesEnabled = false;
    try {
      const rules = JSON.parse(store.getItem('autoRulesEngine') || 'null');
      autoRulesEnabled = !!(rules && rules.enabled);
    } catch (e) {}
    const workerTasks = JSON.parse(store.getItem('workerTasks') || '[]');
    return {
      totalPosts: published.length,
      aiDrafts: replies.filter((r) => r.status === 'draft').length,
      totalEngagement,
      activeKeywords: keywords.length,
      leadsGenerated: leads.length,
      linkedAccounts: linkedAccounts.length,
      scheduled: scheduled.length,
      workerStatus: store.getItem('workerRunningFlag') === 'true' ? 'Running' : (workerTasks.length ? 'Scanning' : 'Idle'),
      autoRulesEnabled,
      activeCampaignId: activeId,
      apiMetrics: buildApiMetrics(keys),
    };
  });

  ipcMain.handle('get-trending-topics', async () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const activeId = store.getItem('activeCampaignId') || 'default';
    const seedKeywords = JSON.parse(store.getItem('keywords') || '[]')
      .filter((k) => k.campaignId === activeId).map((k) => k.term);
    return fetchTrendingTopics('All', keys, seedKeywords);
  });

  async function fetchRssHeadlines(limit = 4) {
    const res = await axios.get('https://feeds.feedburner.com/TechCrunch', { timeout: 10000 });
    const items = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(res.data)) && items.length < limit) {
      const itemXml = match[1];
      const title = ((itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '')
        .replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const link = ((itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '').trim();
      if (title) items.push({ title, url: link, source: 'TechCrunch RSS' });
    }
    return items;
  }

  ipcMain.handle('get-live-news', async (event, query = 'technology') => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const newsKey = keys.newsApiKey || process.env.NEWS_API_KEY;
    if (!newsKey) return { error: 'No NewsAPI key configured' };
    try {
      const res = await axios.get('https://newsapi.org/v2/top-headlines', {
        params: { category: query || 'technology', language: 'en', pageSize: 10, apiKey: newsKey },
        timeout: 15000,
      });
      if (res.data?.articles?.length) {
        return res.data.articles.slice(0, 4).map((a) => ({
          title: a.title, url: a.url, source: a.source?.name || 'NewsAPI',
        }));
      }
    } catch (e) {
      try {
        const rssItems = await fetchRssHeadlines(4);
        if (rssItems.length) return rssItems;
      } catch (rssErr) { /* ignore */ }
      return { error: e.message };
    }
    try {
      const rssItems = await fetchRssHeadlines(4);
      if (rssItems.length) return rssItems;
    } catch (e) { /* ignore */ }
    return { error: 'NewsAPI returned no articles for this category.' };
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
    if (qaDiscoveryCache.data && Date.now() - qaDiscoveryCache.ts < QA_DISCOVERY_CACHE_TTL_MS) {
      return qaDiscoveryCache.data;
    }
    try {
      const stored = JSON.parse(store.getItem('bestQuestionsForBusiness') || '[]');
      if (Array.isArray(stored) && stored.length) {
        qaDiscoveryCache.data = stored;
        qaDiscoveryCache.ts = Date.now();
      }
    } catch (e) { /* ignore */ }

    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const result = await withTimeout(
      integrations.discoverQuestions(store, keys, getCampaign(), generateAI),
      45000,
      null,
    );
    if (Array.isArray(result) && result.length) {
      qaDiscoveryCache.data = result;
      qaDiscoveryCache.ts = Date.now();
      return result;
    }
    return qaDiscoveryCache.data || [];
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
  ipcMain.handle('get-auto-search-settings', () => getAutoSearchSettings(store));
  ipcMain.handle('save-auto-search-settings', (event, s) => saveAutoSearchSettings(store, integrations, s));

  ipcMain.handle('get-notifications', () => saasNotifications.getNotifications(store));
  ipcMain.handle('mark-notification-read', (event, id) => saasNotifications.markNotificationRead(store, id));
  ipcMain.handle('get-notification-settings', () => saasNotifications.getNotificationSettings(store));
  ipcMain.handle('save-notification-settings', (event, s) => saasNotifications.saveNotificationSettings(store, s));

  ipcMain.handle('get-brand-guidelines', () => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const campaigns = JSON.parse(store.getItem('campaigns') || '[]');
    const campaign = campaigns.find((c) => c.id === activeId) || {};
    return {
      success: true,
      brandName: campaign.brandName || '',
      domain: campaign.domain || '',
      description: campaign.description || '',
      tone: campaign.tone || '',
      disallowedTopics: campaign.disallowedTopics || '',
      sampleMessages: campaign.sampleMessages || '',
      affiliateLinks: campaign.affiliateLinks || '',
      brandGuidelines: campaign.brandGuidelines || {},
    };
  });

  ipcMain.handle('save-brand-guidelines', (event, payload) => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const campaigns = JSON.parse(store.getItem('campaigns') || '[]');
    const idx = campaigns.findIndex((c) => c.id === activeId);
    if (idx < 0) return { success: false, error: 'No active campaign' };
    campaigns[idx] = {
      ...campaigns[idx],
      brandName: payload?.brandName ?? campaigns[idx].brandName,
      domain: payload?.domain ?? campaigns[idx].domain,
      description: payload?.description ?? campaigns[idx].description,
      tone: payload?.tone ?? campaigns[idx].tone,
      brandGuidelines: { ...(campaigns[idx].brandGuidelines || {}), ...(payload?.brandGuidelines || {}) },
      disallowedTopics: payload?.disallowedTopics ?? campaigns[idx].disallowedTopics,
      sampleMessages: payload?.sampleMessages ?? campaigns[idx].sampleMessages,
      affiliateLinks: payload?.affiliateLinks ?? campaigns[idx].affiliateLinks,
    };
    store.setItem('campaigns', JSON.stringify(campaigns));
    return { success: true, campaign: campaigns[idx] };
  });

  ipcMain.handle('seed-brand-from-website', async (event, { url } = {}) => {
    const raw = String(url || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!raw) return { success: false, error: 'Enter your business website' };
    const domain = raw.split('/')[0];
    const target = raw.startsWith('http') ? raw : `https://${domain}`;
    try {
      const axios = require('axios');
      const res = await axios.get(target, {
        timeout: 15000,
        headers: { 'User-Agent': 'SocialImperialism/1.0' },
      });
      const html = String(res.data || '');
      const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1]?.trim() || domain;
      const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || [])[1]?.trim() || '';

      let aiSummary = desc;
      try {
        aiSummary = await generateAI(
          `Summarize brand voice, target audience, and 5 social content topics for website ${target}. Title: ${title}. Description: ${desc}. Return 4-6 sentences.`,
        );
      } catch (e) { /* use desc */ }

      const activeId = store.getItem('activeCampaignId') || 'default';
      const campaigns = JSON.parse(store.getItem('campaigns') || '[]');
      const idx = campaigns.findIndex((c) => c.id === activeId);
      if (idx < 0) return { success: false, error: 'No active campaign — complete Setup Wizard first' };

      campaigns[idx] = {
        ...campaigns[idx],
        brandName: campaigns[idx].brandName || title,
        domain,
        description: String(aiSummary || desc).trim(),
        sampleMessages: campaigns[idx].sampleMessages || desc,
        brandGuidelines: {
          ...(campaigns[idx].brandGuidelines || {}),
          doList: campaigns[idx].brandGuidelines?.doList || `Speak as ${title}. Be helpful, authoritative, on-brand.`,
          websiteSeededAt: new Date().toISOString(),
        },
      };
      store.setItem('campaigns', JSON.stringify(campaigns));

      try {
        const { importWebsiteToLibrary } = require(path.join(DESKTOP_SERVICES, 'contentLibraryIpc'));
        await importWebsiteToLibrary(store, generateAI, { url: domain });
      } catch (e) { /* library import optional */ }

      return { success: true, campaign: campaigns[idx], domain, title };
    } catch (e) {
      return { success: false, error: e.message || 'Could not analyze website' };
    }
  });

  ipcMain.handle('save-watched-monitors', (event, monitors) => {
    store.setItem('watchedMonitors', JSON.stringify(monitors));
    return { success: true };
  });
  ipcMain.handle('get-watched-monitors', () => JSON.parse(store.getItem('watchedMonitors') || '[]'));

  ipcMain.handle('get-worker-status', () => {
    const tasks = JSON.parse(store.getItem('workerTasks') || '[]');
    const running = store.getItem('workerRunningFlag') === 'true';
    const statusString = running
      ? `● Scanning Network (${tasks.length} tasks)`
      : (tasks.length ? `Idle (${tasks.length} queued)` : 'Worker Idle');
    return {
      running,
      isRunning: running,
      pendingTasks: tasks.length,
      statusString,
      tasks: tasks.slice(0, 20),
    };
  });
  ipcMain.handle('start-worker', () => { store.setItem('workerRunningFlag', 'true'); return { success: true }; });
  ipcMain.handle('stop-worker', () => { store.setItem('workerRunningFlag', 'false'); return { success: true }; });

  ipcMain.handle('check-api-status', async () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return buildApiMetrics(keys);
  });

  ipcMain.handle('get-key-sources', () => {
    let stored = {};
    try { stored = JSON.parse(store.getItem('globalApiKeys') || '{}'); } catch (e) {}
    const servicesPath = deps.DESKTOP_SERVICES || path.join(__dirname, '../../../apps/desktop/services');
    const { getKeySources } = require(path.join(servicesPath, 'keys'));
    const sources = getKeySources(stored);
    const envCount = Object.values(sources).filter((s) => s === 'env').length;
    const userCount = Object.values(sources).filter((s) => s === 'user').length;
    return {
      sources,
      isAdminEnv: envCount > 0,
      envKeyCount: envCount,
      userKeyCount: userCount,
      message: envCount > 0
        ? 'Admin .env keys loaded — clients must configure their own credentials to run features.'
        : 'No .env keys detected — configure credentials below to enable live features.',
    };
  });

  ipcMain.handle('shorten-url', async (event, url) => {
    const target = url || 'https://example.com';
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const key = keys.tinyurlApiKey || process.env.TINYURL_API_KEY;
    if (!key) return { shortUrl: target };
    try {
      const res = await axios.get(`https://api.tinyurl.com/create?api_token=${key}&url=${encodeURIComponent(target)}`, { timeout: 8000 });
      return { shortUrl: res.data?.data?.tiny_url || target };
    } catch (e) {
      return { shortUrl: target, fallback: true, error: e.message };
    }
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

  ipcMain.handle('get-engagement-queue', () => {
    try {
      return JSON.parse(store.getItem('engagementQueue') || '[]');
    } catch (e) {
      return [];
    }
  });

  ipcMain.handle('retry-engagement-queue', async () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const activeId = store.getItem('activeCampaignId') || 'default';
    const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
    let queue = [];
    try { queue = JSON.parse(store.getItem('engagementQueue') || '[]'); } catch (e) {}
    const pending = queue.filter((q) => q.status === 'queued').slice(0, 5);
    const results = [];
    for (const item of pending) {
      try {
        const res = await integrations.engagePost({
          action: item.action,
          platform: item.platform,
          postContent: item.content,
          content: item.content,
          externalId: item.externalId,
          postId: item.externalId,
        }, keys, linkedAccounts);
        item.status = 'completed';
        item.completedAt = new Date().toISOString();
        results.push({ id: item.id, success: true, result: res });
      } catch (e) {
        item.error = e.message;
        item.lastRetryAt = new Date().toISOString();
        results.push({ id: item.id, success: false, error: e.message });
      }
    }
    store.setItem('engagementQueue', JSON.stringify(queue));
    return { success: true, retried: pending.length, results };
  });

  ipcMain.handle('clear-engagement-queue', () => {
    store.setItem('engagementQueue', '[]');
    return { success: true };
  });

  // Engagement CRM
  ipcMain.handle('get-engagement-lists', () => {
    const custom = integrations.getLists(store);
    const top = integrations.buildTopCommentersList(store);
    return [top, ...custom];
  });
  ipcMain.handle('save-engagement-list', (event, listData) => {
    const lists = integrations.getLists(store);
    const rawUrls = listData.profileUrls;
    const urlList = Array.isArray(rawUrls) ? rawUrls : String(rawUrls || '').split('\n');
    const profileUrls = urlList.flatMap((u) => String(u).split(/[\n,]/)).map((u) => u.trim()).filter(Boolean);
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
    const proxyManager = require(path.join(desktopServicesPath, 'proxyManager'));
    proxyManager.releaseProxyForAccount(store, accountId);
    accounts = accounts.filter((a) => a.id !== accountId);
    store.setItem(`linkedAccounts_${activeId}`, JSON.stringify(accounts));
    return { success: true };
  });
  ipcMain.handle('link-account', async (event, payload) => {
    const creds = typeof payload === 'string' ? { platform: payload } : (payload || {});
    const { connectPlatform } = require(path.join(desktopServicesPath, 'connectionService'));
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const openOAuth = typeof deps.openExternal === 'function' ? deps.openExternal : () => {};
    const method = creds.method === 'oauth' ? 'oauth' : 'credentials';

    if (method === 'oauth') {
      return {
        success: false,
        error: 'Use OAuth Connect button — opens authorization popup immediately.',
        useAsyncOAuth: true,
      };
    }

    return connectPlatform({
      platform: creds.platform,
      email: creds.email,
      username: creds.username,
      password: creds.password || '',
      method,
      keys,
      openExternal: openOAuth,
      store,
      integrations,
    });
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
    const readStored = () => {
      try {
        return JSON.parse(store.getItem('unansweredQuestions') || '[]').slice(0, 80)
          .map((q) => ({ ...q, networkSize: q.networkSize || '30M+' }));
      } catch (e) { return []; }
    };

    const campaign = getCampaign();
    const lastScan = parseInt(store.getItem('qaLastScan') || '0', 10);
    if (Date.now() - lastScan > 300000) {
      const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
      const scanned = await withTimeout(
        integrations.scanUnansweredQuestions(store, keys, campaign, generateAI),
        35000,
        null,
      );
      if (scanned !== null) store.setItem('qaLastScan', Date.now().toString());
    }
    return readStored();
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
    try {
      const { fetchRealFeed } = require(path.join(deps.DESKTOP_SERVICES || '../../../apps/desktop/services', 'feedFetcher'));
      const runSearch = () => runFullAutoSearch(store, {
        integrations,
        resolveKeys,
        fetchRealFeed,
        generateAI,
        scanUnansweredQuestions: integrations.scanUnansweredQuestions,
        runRedditProspector: integrations.runRedditProspector,
      });
      const result = await withTimeout(runSearch(), 42000, null);
      if (!result) {
        runSearch().then((r) => {
          sendNotification({
            type: 'auto-search',
            title: 'Full Auto Search Complete',
            body: r?.message || `${r?.newPostCount || 0} new posts found`,
            link: '/browse-posts',
          });
        }).catch((e) => console.error('trigger-full-auto-search background:', e.message));
        return { success: true, message: 'Auto search started — refresh Browse Posts in a moment', background: true };
      }
      sendNotification({
        type: 'auto-search',
        title: 'Full Auto Search Complete',
        body: result.message || `${result.newPostCount} new posts found`,
        link: '/browse-posts',
      });
      return result;
    } catch (e) {
      console.error('trigger-full-auto-search:', e.message);
      return { success: false, error: e.message };
    }
  });

}

module.exports = { registerCoreHandlers };