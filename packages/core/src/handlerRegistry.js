/**
 * Registers all desktop IPC handlers into a plain object for SaaS HTTP bridge.
 */
const path = require('path');

const DESKTOP_ROOT = path.join(__dirname, '../../../apps/desktop');
const DESKTOP_SERVICES = path.join(DESKTOP_ROOT, 'services');

function createMockIpc() {
  const handlers = {};
  return {
    handlers,
    ipcMain: {
      handle: (channel, fn) => { handlers[channel] = fn; },
      removeHandler: (channel) => { delete handlers[channel]; },
    },
  };
}

function buildApiMetrics(resolveKeys, keys) {
  const k = resolveKeys(keys);
  const status = (ok) => (ok ? 'Connected' : 'Not configured');
  const {
    hasTwitterKeys, hasRedditKeys, hasLinkedInKeys, hasMetaKeys,
    hasYouTubeKeys, hasTikTokKeys, hasTwitchKeys, hasMediaKeys,
    hasAdvancedWorkflowKey, hasContentStudioKey, hasMozKeys,
    hasVboutKeys, hasMailchimpKeys, hasSmtpKeys, hasAcumbamailKeys,
  } = require(path.join(DESKTOP_SERVICES, 'keys'));
  return {
    'Twitter / X': status(hasTwitterKeys(k)),
    'Reddit OAuth': status(hasRedditKeys(k)),
    'Reddit Feed': 'Live (public API)',
    LinkedIn: status(hasLinkedInKeys(k)),
    'Meta / Facebook': status(hasMetaKeys(k) || !!k.fbStreamingKey),
    YouTube: status(hasYouTubeKeys(k)),
    TikTok: status(hasTikTokKeys(k)),
    Twitch: status(!!k.twitchStreamKey || hasTwitchKeys(k)),
    NewsAPI: status(!!k.newsApiKey),
    SerpAPI: status(!!k.serpApiKey),
    'Gemini AI': status(!!k.gemini),
    OpenRouter: status(!!k.openrouter),
    Unsplash: status(!!k.unsplashAccessKey),
    'Stock Media': status(hasMediaKeys(k)),
    'AI Workflows': status(hasAdvancedWorkflowKey(k)),
    'Content Studio': status(hasContentStudioKey(k)),
    DomDetailer: status(!!k.domDetailer),
    PlayHT: status(!!(k.playhtUserId && k.playhtSecretKey)),
    DeepL: status(!!k.deeplKey),
    TinyURL: status(!!k.tinyurlApiKey),
    MOZ: status(hasMozKeys(k)),
    FAL: status(!!k.falKey),
    Contentful: status(!!(k.contentfulSpaceId && k.contentfulAccessToken)),
    Discord: status(!!k.discordBotToken),
    VBout: status(hasVboutKeys(k)),
    MailChimp: status(hasMailchimpKeys(k)),
    'Amazon SES': status(hasSmtpKeys(k)),
    Acumbamail: status(hasAcumbamailKeys(k)),
  };
}

async function registerAllHandlers(store, deps = {}) {
  const { ipcMain, handlers } = createMockIpc();
  const integrations = require(path.join(DESKTOP_SERVICES, 'index'));
  const { createStoreResolveKeys } = require(path.join(DESKTOP_SERVICES, 'keys'));
  const resolveKeys = createStoreResolveKeys(store);
  const { FREQUENCY_OPTIONS } = require(path.join(DESKTOP_SERVICES, 'scheduleIntervals'));
  const userDataPath = deps.userDataPath || path.join(require('os').tmpdir(), 'si-saas');

  const getGlobalKey = (key) => {
    try {
      const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
      return keys[key];
    } catch (e) { return null; }
  };

  const { createAiEngine } = require(path.join(DESKTOP_ROOT, 'saasAi'));
  const generateAI = deps.generateAI || createAiEngine(store).generateAI;

  const { registerCalendarHandlers } = require(path.join(DESKTOP_SERVICES, 'calendarIpc'));
  const calendarApi = registerCalendarHandlers({
    ipcMain, store, resolveKeys,
    buildApiMetrics: (k) => buildApiMetrics(resolveKeys, k),
    integrations,
  });

  const { registerBackgroundRunHandlers } = require(path.join(DESKTOP_SERVICES, 'backgroundRunIpc'));
  registerBackgroundRunHandlers({ ipcMain, store });

  const { registerSettingsHandlers } = require(path.join(DESKTOP_SERVICES, 'settingsIpc'));
  registerSettingsHandlers({ ipcMain, store });

  const { registerBillingPaymentHandlers } = require(path.join(DESKTOP_SERVICES, 'billingPaymentsIpc'));
  registerBillingPaymentHandlers({
    ipcMain, store,
    shell: { openExternal: (url) => { deps.pendingOAuthUrl = url; return Promise.resolve(); } },
    onPaymentComplete: deps.onPaymentComplete || (() => {}),
  });

  const { registerAccountHandlers } = require(path.join(DESKTOP_SERVICES, 'accountIpc'));
  registerAccountHandlers({
    ipcMain, store, resolveKeys, integrations,
    openExternal: (url) => { deps.pendingOAuthUrl = url; },
  });

  const { registerAccountCreatorHandlers } = require(path.join(DESKTOP_SERVICES, 'accountCreatorIpc'));
  registerAccountCreatorHandlers({ ipcMain, store, generateAI, calendarApi, onBatchProgress: () => {}, userDataPath });

  const { registerGrokHandlers } = require(path.join(DESKTOP_SERVICES, 'grokIpc'));
  registerGrokHandlers({ ipcMain, store, userDataPath });

  const { registerNativeBrowserHandlers } = require(path.join(DESKTOP_SERVICES, 'nativeBrowserIpc'));
  registerNativeBrowserHandlers({ ipcMain, store, userDataPath });

  const { registerRssCategoryHandlers } = require(path.join(DESKTOP_SERVICES, 'rssCategoryIpc'));
  registerRssCategoryHandlers({
    ipcMain, store, resolveKeys, generateAI,
    getFalKey: () => getGlobalKey('falKey'),
  });

  const generateAIWithModel = async (prompt, _modelId) => generateAI(prompt);
  const getScheduledPostsStoreList = () => {
    try { return JSON.parse(store.getItem('scheduled_posts') || '[]'); } catch (e) { return []; }
  };
  const saveScheduledPostsStoreList = (posts) => store.setItem('scheduled_posts', JSON.stringify(posts));

  const { registerRedditAiHandlers } = require(path.join(DESKTOP_SERVICES, 'redditAiIpc'));
  registerRedditAiHandlers({
    ipcMain, store, generateAI, resolveKeys,
    getCampaign: () => {
      try {
        const activeId = store.getItem('activeCampaignId') || 'default';
        return JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeId) || {};
      } catch (e) { return {}; }
    },
  });

  const { registerThumbnailHandlers } = require(path.join(DESKTOP_SERVICES, 'thumbnailIpc'));
  registerThumbnailHandlers({ ipcMain, store, resolveKeys, generateAI });

  const { registerQuantumPagesHandlers } = require(path.join(DESKTOP_SERVICES, 'quantumPagesIpc'));
  registerQuantumPagesHandlers({ ipcMain, store, generateAI });

  const { registerQuoraTrafficOpsHandlers } = require(path.join(DESKTOP_SERVICES, 'quoraTrafficOpsIpc'));
  registerQuoraTrafficOpsHandlers({
    ipcMain, store, generateAI, resolveKeys,
    getCampaign: () => {
      try {
        const activeId = store.getItem('activeCampaignId') || 'default';
        return JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeId) || {};
      } catch (e) { return {}; }
    },
    getLinkedAccounts: () => {
      try {
        const activeId = store.getItem('activeCampaignId') || 'default';
        return JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
      } catch (e) { return []; }
    },
  });

  const { registerSeoToolsHandlers } = require(path.join(DESKTOP_SERVICES, 'seoToolsIpc'));
  registerSeoToolsHandlers({ ipcMain, store, resolveKeys });

  const { registerPageHealthHandlers } = require(path.join(DESKTOP_SERVICES, 'pageHealthCheck'));
  registerPageHealthHandlers({ ipcMain, store, resolveKeys, appRoot: DESKTOP_ROOT });

  const { registerIntegrationHubHandlers } = require(path.join(DESKTOP_SERVICES, 'integrationHubIpc'));
  registerIntegrationHubHandlers({ ipcMain, store });

  const { registerGuardianGatekeeperHandlers } = require('./guardianGatekeeper');
  registerGuardianGatekeeperHandlers({ ipcMain, store, handlers });

  const { registerSovereignThreatHandlers } = require('./sovereignThreatCapture');
  registerSovereignThreatHandlers({ ipcMain, store, handlers });

  const { registerEmailCampaignHandlers } = require(path.join(DESKTOP_SERVICES, 'emailCampaignIpc'));
  registerEmailCampaignHandlers({ ipcMain, store });

  const { registerDnsHandlers } = require(path.join(DESKTOP_SERVICES, 'dnsIpc'));
  registerDnsHandlers({ ipcMain, store });

  // Core index.js handlers
  const { registerCoreHandlers } = require('./coreHandlers');
  registerCoreHandlers({
    ipcMain, store, integrations, resolveKeys, generateAI,
    buildApiMetrics: (k) => buildApiMetrics(resolveKeys, k),
    calendarApi, FREQUENCY_OPTIONS, userDataPath,
    DESKTOP_SERVICES,
    openExternal: (url) => { deps.pendingOAuthUrl = url; },
  });

  const { registerIndexHandlers } = require('./indexHandlers');
  registerIndexHandlers({
    ipcMain, store, integrations, resolveKeys, generateAI,
    buildApiMetrics: (k) => buildApiMetrics(resolveKeys, k),
    calendarApi,
    openExternal: (url) => { deps.pendingOAuthUrl = url; },
  });

  const axios = require('axios');
  const generateImageForStudio = async (prompt) => {
    const k = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const falKey = k.falKey;
    if (!falKey) return { success: false, error: 'No FAL key configured.' };
    try {
      const response = await axios.post('https://fal.run/fal-ai/fast-sdxl', {
        prompt, num_images: 1, image_size: 'square_hd', num_inference_steps: 4,
      }, { headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' }, timeout: 60000 });
      if (response.data?.images?.length) return { success: true, imageUrl: response.data.images[0].url };
      return { success: false, error: 'No image returned' };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const { registerContentStudioHandlers } = require(path.join(DESKTOP_SERVICES, 'contentStudioIpc'));
  registerContentStudioHandlers({
    ipcMain, store,
    generateAIWithModel,
    generateImage: generateImageForStudio,
    getScheduledPosts: getScheduledPostsStoreList,
    saveScheduledPosts: saveScheduledPostsStoreList,
    publishPost: (postData) => calendarApi.executePublishPost(postData),
  });

  const { registerContentLibraryHandlers } = require(path.join(DESKTOP_SERVICES, 'contentLibraryIpc'));
  registerContentLibraryHandlers({ ipcMain, store, generateAI });

  const { registerDesignStudioHandlers } = require(path.join(DESKTOP_SERVICES, 'designStudioIpc'));
  registerDesignStudioHandlers({ ipcMain, store, generateAI });

  const { fetchTrendingTopics } = require(path.join(DESKTOP_SERVICES, 'feedFetcher'));
  const { registerBrowsePostsHandlers } = require(path.join(DESKTOP_SERVICES, 'browsePostsIpc'));
  registerBrowsePostsHandlers({
    ipcMain,
    store,
    resolveKeys,
    buildApiMetrics: (k) => buildApiMetrics(resolveKeys, k),
    fetchTrendingTopics,
  });

  const { registerSectionLiveHandlers } = require(path.join(DESKTOP_SERVICES, 'sectionLiveIpc'));
  registerSectionLiveHandlers({
    ipcMain,
    store,
    resolveKeys,
    buildApiMetrics: (k) => buildApiMetrics(resolveKeys, k),
    fetchTrendingTopics,
  });

  const { runLiveConnectionAudit } = require(path.join(DESKTOP_SERVICES, 'connectionProbeService'));
  const liveAuditFn = async () => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    return runLiveConnectionAudit(handlers, (k) => buildApiMetrics(resolveKeys, k), keys);
  };
  handlers['test-all-connections'] = liveAuditFn;
  handlers['run-live-connection-audit'] = liveAuditFn;
  ipcMain.handle('test-all-connections', liveAuditFn);
  ipcMain.handle('run-live-connection-audit', liveAuditFn);

  return { handlers, calendarApi, integrations, pendingOAuth: () => deps.pendingOAuthUrl };
}

module.exports = { registerAllHandlers, createMockIpc, DESKTOP_ROOT, DESKTOP_SERVICES };