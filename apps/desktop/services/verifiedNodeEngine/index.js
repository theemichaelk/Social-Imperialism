const { registerVerifiedNodeHandlers } = require('./verifiedNodeIpc');
const { runVerificationLoop, runTier1, runTier2, runTier3 } = require('./threeTierVerificationLoop');
const { executeRepair } = require('./autoRepairHandler');
const { discoverAndPopulate, getVerifiedTree, bindCampaignNodes, setCampaignControl } = require('./verifiedNodeStore');
const { buildTrackedUrl } = require('./utmGenerator');
const { buildPlatformVariant, validateDryRunPayload } = require('./contentTransformer');
const { PLATFORM_DISCOVERY_SCHEMA, ALL_PLATFORMS, mapAccountToNodes, validateEntityData } = require('./platformDiscoverySchema');
const { STATES, canBindToCampaign } = require('./nodeStateMachine');

module.exports = {
  registerVerifiedNodeHandlers,
  runVerificationLoop,
  runTier1,
  runTier2,
  runTier3,
  executeRepair,
  discoverAndPopulate,
  getVerifiedTree,
  bindCampaignNodes,
  setCampaignControl,
  buildTrackedUrl,
  buildPlatformVariant,
  validateDryRunPayload,
  PLATFORM_DISCOVERY_SCHEMA,
  ALL_PLATFORMS,
  mapAccountToNodes,
  validateEntityData,
  STATES,
  canBindToCampaign,
};