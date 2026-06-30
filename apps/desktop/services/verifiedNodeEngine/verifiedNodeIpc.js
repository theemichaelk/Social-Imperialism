/**
 * IPC handlers for Autonomous Social Media Infrastructure Engine.
 */
const { prisma } = require('@si/db');
const { getLinkedAccounts } = require('../accountAutomation');
const {
  discoverAndPopulate,
  getVerifiedTree,
  bindCampaignNodes,
  setCampaignControl,
} = require('./verifiedNodeStore');
const { runVerificationLoop } = require('./threeTierVerificationLoop');
const { buildTrackedUrl } = require('./utmGenerator');
const { buildPlatformVariant } = require('./contentTransformer');
const { ALL_PLATFORMS } = require('./platformDiscoverySchema');
const { STATES, canBindToCampaign } = require('./nodeStateMachine');

function registerVerifiedNodeHandlers({ ipcMain, store, resolveKeys }) {
  const channels = [
    'discover-verify-platform-tree',
    'run-node-verification',
    'run-verification-loop-all',
    'get-verified-node-tree',
    'bind-campaign-verified-nodes',
    'set-campaign-control',
    'generate-utm-payload',
    'get-platform-discovery-schema',
  ];

  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch { /* noop */ }
  });

  function projectId() {
    return store.getItem('activeCampaignId') || store.getItem('activeProjectId') || 'default';
  }

  function buildCtx() {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const accounts = getLinkedAccounts(store);
    return { store, resolveKeys, keys, accounts };
  }

  ipcMain.handle('get-platform-discovery-schema', async () => ({
    platforms: ALL_PLATFORMS,
    count: ALL_PLATFORMS.length,
  }));

  ipcMain.handle('discover-verify-platform-tree', async (_event, opts = {}) => {
    const pid = opts.projectId || projectId();
    const ctx = buildCtx();
    const accounts = opts.accountId
      ? ctx.accounts.filter((a) => a.id === opts.accountId)
      : ctx.accounts;

    const discovery = await discoverAndPopulate(pid, accounts);
    const verifyResults = [];

    if (opts.autoVerify !== false) {
      for (const node of discovery.nodes) {
        if (node.verificationState !== STATES.PENDING_VERIFICATION) continue;
        const full = await prisma.verifiedPlatformNode.findUnique({ where: { id: node.id } });
        const result = await runVerificationLoop(ctx, full, {
          campaignName: opts.campaignName,
          targetUrl: opts.targetUrl,
          continuous: opts.continuousMode,
        });
        verifyResults.push(result);
      }
    }

    return {
      success: true,
      discovery,
      verification: verifyResults,
      verified: verifyResults.filter((r) => r.success).length,
      failed: verifyResults.filter((r) => !r.success).length,
    };
  });

  ipcMain.handle('run-node-verification', async (_event, nodeId, opts = {}) => {
    const node = await prisma.verifiedPlatformNode.findUnique({ where: { id: nodeId } });
    if (!node) return { success: false, error: 'Node not found' };
    const ctx = buildCtx();
    const result = await runVerificationLoop(ctx, node, opts);
    return result;
  });

  ipcMain.handle('run-verification-loop-all', async (_event, opts = {}) => {
    const pid = opts.projectId || projectId();
    const nodes = await prisma.verifiedPlatformNode.findMany({
      where: {
        projectId: pid,
        verificationState: { notIn: [STATES.VERIFIED] },
      },
    });
    const ctx = buildCtx();
    const results = [];
    for (const node of nodes) {
      results.push(await runVerificationLoop(ctx, node, opts));
    }
    return {
      success: results.every((r) => r.success),
      total: results.length,
      passed: results.filter((r) => r.success).length,
      results,
    };
  });

  ipcMain.handle('get-verified-node-tree', async (_event, opts = {}) => {
    const pid = opts.projectId || projectId();
    const tree = await getVerifiedTree(pid);
    return {
      nodes: tree,
      verifiedCount: tree.filter((n) => n.verified).length,
      awaitingAction: tree.filter((n) => n.verificationState === STATES.AWAITING_ACTION).length,
    };
  });

  ipcMain.handle('bind-campaign-verified-nodes', async (_event, { campaignId, nodeIds }) => {
    try {
      const bindings = await bindCampaignNodes(campaignId, nodeIds);
      return { success: true, bindings };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('set-campaign-control', async (_event, { campaignId, action, payload }) => {
    try {
      const result = await setCampaignControl(campaignId, action, payload);
      return { success: true, ...result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('generate-utm-payload', async (_event, { nodeId, campaignName, targetUrl }) => {
    const node = await prisma.verifiedPlatformNode.findUnique({ where: { id: nodeId } });
    if (!node) return { success: false, error: 'Node not found' };
    if (!canBindToCampaign(node)) {
      return { success: false, error: 'Node must pass all 3 verification tiers first' };
    }

    const tracked = buildTrackedUrl(targetUrl, node, campaignName, node.entityData);
    const variant = buildPlatformVariant(node.platform, node, campaignName, targetUrl);

    await prisma.utmPublishEvent.create({
      data: {
        nodeId: node.id,
        platform: node.platform,
        utmSource: tracked.utmSource,
        utmMedium: tracked.utmMedium,
        utmCampaign: tracked.utmCampaign,
        fullUrl: tracked.fullUrl,
      },
    });

    return { success: true, tracked, variant };
  });

  console.log('[verifiedNodeEngine] Registered autonomous infrastructure handlers');
}

module.exports = { registerVerifiedNodeHandlers };