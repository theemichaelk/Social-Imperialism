const { resolveKeys } = require('./keys');
const {
  handleOAuthCallback,
  startOAuthFlow,
  ensureOAuthLoopbackServer,
  GOOGLE_LOOPBACK_REDIRECT_URI,
} = require('./oauth');
const { fetchRealFeed } = require('./feedFetcher');
const { fetchLinkedAccountFeed } = require('./accountFeedFetcher');
const { discoverAccounts } = require('./accountDiscovery');
const { buildIntelligenceProfile } = require('./intelligenceProfile');
const { publishPost } = require('./publisher');
const { engagePost } = require('./engagement');
const workerMonitor = require('./workerMonitor');
const engagementLists = require('./engagementLists');
const keywordResearch = require('./keywordResearch');
const automationEngine = require('./automationEngine');
const autoRulesEngine = require('./autoRulesEngine');
const accountHub = require('./accountHub');
const accountAutomation = require('./accountAutomation');
const { makeConnectionId } = require('./credentialAuth');
const connectionService = require('./connectionService');
const qaDiscovery = require('./qaDiscovery');
const contentAutomation = require('./contentAutomation');
const fanpageAutomation = require('./fanpageAutomation');
const calendarAnalytics = require('./calendarAnalytics');
const EntityStore = require('./entityStore');

module.exports = {
  resolveKeys,
  handleOAuthCallback,
  startOAuthFlow,
  ensureOAuthLoopbackServer,
  GOOGLE_LOOPBACK_REDIRECT_URI,
  fetchRealFeed,
  fetchLinkedAccountFeed,
  discoverAccounts,
  buildIntelligenceProfile,
  publishPost,
  engagePost,
  ...workerMonitor,
  ...engagementLists,
  ...keywordResearch,
  ...automationEngine,
  ...autoRulesEngine,
  ...accountHub,
  ...accountAutomation,
  makeConnectionId,
  ...connectionService,
  ...qaDiscovery,
  ...contentAutomation,
  ...fanpageAutomation,
  ...calendarAnalytics,
  EntityStore,
};