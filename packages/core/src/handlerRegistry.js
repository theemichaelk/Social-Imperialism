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
    hasYouTubeKeys, hasTikTokKeys, hasTwitchKeys,
  } = require(path.join(DESKTOP_SERVICES, 'keys'));
  return {
    'Twitter / X': status(hasTwitterKeys(k)),
    'Reddit OAuth': status(hasRedditKeys(k)),
    'Reddit Feed': 'Live (public API)',
    LinkedIn: status(hasLinkedInKeys(k)),
    'Meta / Facebook': status(hasMetaKeys(k)),
    YouTube: status(hasYouTubeKeys(k)),
    TikTok: status(hasTikTokKeys(k)),
    Twitch: status(hasTwitchKeys(k)),
    NewsAPI: status(!!k.newsApiKey),
    SerpAPI: status(!!k.serpApiKey),
    'Gemini AI': status(!!k.gemini),
    OpenRouter: status(!!k.openrouter),
  };
}

async function registerAllHandlers(store, deps = {}) {
  const { ipcMain, handlers } = createMockIpc();
  const integrations = require(path.join(DESKTOP_SERVICES, 'index'));
  const { resolveKeys } = require(path.join(DESKTOP_SERVICES, 'keys'));
  const { FREQUENCY_OPTIONS } = require(path.join(DESKTOP_SERVICES, 'scheduleIntervals'));
  const userDataPath = deps.userDataPath || path.join(require('os').tmpdir(), 'si-saas');

  const getGlobalKey = (key) => {
    try {
      const keys = JSON.parse(store.getItem('globalApiKeys') || '{}');
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
  registerAccountCreatorHandlers({ ipcMain, store, generateAI, calendarApi, onBatchProgress: () => {} });

  const { registerGrokHandlers } = require(path.join(DESKTOP_SERVICES, 'grokIpc'));
  registerGrokHandlers({ ipcMain, store, userDataPath });

  const { registerRssCategoryHandlers } = require(path.join(DESKTOP_SERVICES, 'rssCategoryIpc'));
  registerRssCategoryHandlers({
    ipcMain, store, resolveKeys, generateAI,
    getFalKey: () => getGlobalKey('falKey') || process.env.FAL_KEY,
  });

  const { registerContentStudioHandlers } = require(path.join(DESKTOP_SERVICES, 'contentStudioIpc'));
  registerContentStudioHandlers({ ipcMain, store, generateAI, calendarApi, integrations });

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
  registerQuoraTrafficOpsHandlers({ ipcMain, store, generateAI, resolveKeys, userDataPath });

  const { registerSeoToolsHandlers } = require(path.join(DESKTOP_SERVICES, 'seoToolsIpc'));
  registerSeoToolsHandlers({ ipcMain, store, resolveKeys });

  const { registerPageHealthHandlers } = require(path.join(DESKTOP_SERVICES, 'pageHealthCheck'));
  registerPageHealthHandlers({ ipcMain, store, resolveKeys, appRoot: DESKTOP_ROOT });

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

  return { handlers, calendarApi, integrations, pendingOAuth: () => deps.pendingOAuthUrl };
}

module.exports = { registerAllHandlers, createMockIpc, DESKTOP_ROOT, DESKTOP_SERVICES };