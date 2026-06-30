/**
 * Phase 2: Auto-repair exception handler — 3-strike recovery protocol.
 *
 * Strike 1: Session refresh (OAuth token / cookie clear)
 * Strike 2: Environment rotation (proxy IP + user-agent fingerprint)
 * Strike 3: Human-in-the-loop — freeze node, webhook alert
 */
const { prisma } = require('@si/db');
const { STATES } = require('./nodeStateMachine');

const REPAIR_WEBHOOK_URL = process.env.VERIFIED_NODE_WEBHOOK_URL || process.env.REPAIR_ALERT_WEBHOOK_URL;

async function sendRepairWebhook(node, strike, errorLog) {
  if (!REPAIR_WEBHOOK_URL) return false;
  try {
    const res = await fetch(REPAIR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'verified_node_repair_exhausted',
        nodeId: node.id,
        platform: node.platform,
        nodeType: node.nodeType,
        externalId: node.externalId,
        strike,
        verificationState: node.verificationState,
        error: errorLog,
        timestamp: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function refreshSession(ctx, node) {
  const { store, resolveKeys, account } = ctx;
  if (!account) return { refreshed: false, reason: 'No linked account' };

  try {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const oauthFlowStore = require('../oauthFlowStore');
    const meta = account.metadata ? JSON.parse(account.metadata) : account;

    if (meta.oauthTokens?.refresh_token) {
      const oauth = require('../oauth');
      const refreshed = await oauth.refreshTokens(account.platform, meta.oauthTokens, keys);
      if (refreshed?.access_token) {
        meta.oauthTokens = refreshed;
        return { refreshed: true, method: 'oauth_refresh' };
      }
    }

    if (account.encryptedTokens) {
      return { refreshed: true, method: 'token_present_reauth_deferred' };
    }

    return { refreshed: false, reason: 'No refresh token available' };
  } catch (e) {
    return { refreshed: false, reason: e.message };
  }
}

function rotateEnvironment(node) {
  const proxyPool = ['residential-us-east', 'residential-us-west', 'residential-eu', 'mobile-4g'];
  const uaPool = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/17.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148',
  ];
  const idx = (node.strikeCount || 0) % proxyPool.length;
  return {
    proxyProfile: proxyPool[idx],
    userAgentProfile: uaPool[idx % uaPool.length],
    proxyRotated: true,
  };
}

/**
 * Execute repair for current strike, update node state, log attempt.
 */
async function executeRepair(ctx, node, tierResult) {
  const strike = (node.strikeCount || 0) + 1;
  const previousState = node.verificationState;
  let action = 'unknown';
  let sessionRefreshed = false;
  let proxyRotated = false;
  let newState = STATES.REPAIR_LOOP;
  let webhookSent = false;
  const errorLog = tierResult?.error || node.lastError || 'Verification tier failed';

  const updates = { strikeCount: strike, lastError: errorLog, lastTestedAt: new Date() };

  if (strike === 1) {
    action = 'session_refresh';
    const refresh = await refreshSession(ctx, node);
    sessionRefreshed = refresh.refreshed;
    newState = STATES.REPAIR_LOOP;
  } else if (strike === 2) {
    action = 'environment_rotation';
    const env = rotateEnvironment(node);
    updates.proxyProfile = env.proxyProfile;
    updates.userAgentProfile = env.userAgentProfile;
    proxyRotated = env.proxyRotated;
    newState = STATES.REPAIR_LOOP;
  } else {
    action = 'human_in_the_loop';
    newState = STATES.AWAITING_ACTION;
    webhookSent = await sendRepairWebhook(node, strike, errorLog);
  }

  updates.verificationState = newState;

  await prisma.verifiedPlatformNode.update({
    where: { id: node.id },
    data: updates,
  });

  await prisma.nodeRepairAttempt.create({
    data: {
      nodeId: node.id,
      strike,
      action,
      previousState,
      newState,
      proxyRotated,
      sessionRefreshed,
      errorLog: JSON.stringify({ tier: tierResult?.tier, error: errorLog, action }),
      webhookSent,
    },
  });

  if (node.continuousMode && strike >= 3) {
    const { coreRequire } = require('../../coreRequire');
    const { enqueue } = coreRequire('src/jobRunner');
    await enqueue({
      type: 'verified_node_reverify',
      projectId: node.projectId,
      payload: { nodeId: node.id, channel: 'run-node-verification', args: [node.id, { continuous: true }] },
      runAt: new Date(Date.now() + 15 * 60 * 1000),
    });
  }

  return {
    strike,
    action,
    previousState,
    newState,
    sessionRefreshed,
    proxyRotated,
    webhookSent,
    retryRecommended: strike < 3,
    frozen: strike >= 3,
  };
}

async function transitionToRepairLoop(nodeId, reason) {
  return prisma.verifiedPlatformNode.update({
    where: { id: nodeId },
    data: {
      verificationState: STATES.REPAIR_LOOP,
      lastError: reason,
      lastTestedAt: new Date(),
    },
  });
}

module.exports = {
  executeRepair,
  refreshSession,
  rotateEnvironment,
  sendRepairWebhook,
  transitionToRepairLoop,
};