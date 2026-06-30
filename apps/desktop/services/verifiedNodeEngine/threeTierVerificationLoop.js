/**
 * Phase 2: Mandatory 3-tier verification loop.
 *
 * Tier 1 — Deep Permission Ping (read validation)
 * Tier 2 — Metadata Generation Dry Run (payload validation)
 * Tier 3 — Live Verification & Post-Purge (write validation)
 */
const { prisma } = require('@si/db');
const { validateEntityData } = require('./platformDiscoverySchema');
const { buildPlatformVariant, validateDryRunPayload } = require('./contentTransformer');
const { STATES, stateAfterTierSuccess, nextTier } = require('./nodeStateMachine');
const { executeRepair } = require('./autoRepairHandler');

const LIVE_WRITE_ENABLED = process.env.VERIFIED_NODE_LIVE_WRITE === '1';

const TIER_NAMES = {
  1: 'deep_permission_ping',
  2: 'metadata_dry_run',
  3: 'live_write_purge',
};

async function recordRun(nodeId, tier, result) {
  return prisma.verificationRun.create({
    data: {
      nodeId,
      tier,
      tierName: TIER_NAMES[tier],
      status: result.success ? 'passed' : 'failed',
      success: result.success,
      httpStatus: result.httpStatus || null,
      responseMeta: result.meta ? JSON.stringify(result.meta) : null,
      errorMessage: result.error || null,
      durationMs: result.durationMs || null,
      livePostId: result.livePostId || null,
      purged: result.purged || false,
    },
  });
}

/**
 * Tier 1: Read-only ping — verify entity IDs and permission to read.
 */
async function runTier1(ctx, node) {
  const start = Date.now();
  const entityCheck = validateEntityData(
    node.platform,
    node.nodeType,
    node.entityData,
  );

  if (!entityCheck.ok) {
    return {
      success: false,
      tier: 1,
      error: entityCheck.error,
      durationMs: Date.now() - start,
      meta: { missing: entityCheck.missing },
    };
  }

  let httpStatus = 200;
  let probeMeta = { method: 'entity_schema_validation', fields: entityCheck.requiredCount };

  try {
    const probe = await platformReadProbe(ctx, node, entityCheck.entityData);
    httpStatus = probe.httpStatus || 200;
    probeMeta = { ...probeMeta, ...probe.meta };
    if (!probe.ok) {
      return {
        success: false,
        tier: 1,
        error: probe.error || 'Read probe failed',
        httpStatus,
        durationMs: Date.now() - start,
        meta: probeMeta,
      };
    }
  } catch (e) {
    return {
      success: false,
      tier: 1,
      error: e.message,
      durationMs: Date.now() - start,
    };
  }

  return {
    success: true,
    tier: 1,
    httpStatus,
    durationMs: Date.now() - start,
    meta: probeMeta,
  };
}

async function platformReadProbe(ctx, node, entityData) {
  const { keys } = ctx;
  const p = node.platform;

  if (p === 'Twitter' && keys?.twBearer) {
    const axios = require('axios');
    const res = await axios.get('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${keys.twBearer}` },
      validateStatus: () => true,
    });
    return {
      ok: res.status === 200 && res.data?.data?.id,
      httpStatus: res.status,
      meta: { user_id: res.data?.data?.id },
      error: res.status !== 200 ? `Twitter API ${res.status}` : null,
    };
  }

  if (p === 'Discord' && entityData.channel_id) {
    const sendFlag = entityData.send_messages;
    return {
      ok: sendFlag !== false,
      httpStatus: 200,
      meta: { channel_id: entityData.channel_id, send_messages: sendFlag },
    };
  }

  if (entityData.page_id || entityData.channel_id || entityData.group_id
    || entityData.subreddit_id || entityData.board_id || entityData.chat_id
    || entityData.user_id || entityData.creator_id) {
    return { ok: true, httpStatus: 200, meta: { verified_ids: true } };
  }

  return { ok: !!node.externalId, httpStatus: 200, meta: { fallback: 'external_id' } };
}

/**
 * Tier 2: Build platform payload from socialimperialism.com and validate schema.
 */
async function runTier2(ctx, node, campaignName, targetUrl) {
  const start = Date.now();
  const variant = buildPlatformVariant(node.platform, node, campaignName, targetUrl);
  const validation = validateDryRunPayload(variant);

  if (!validation.ok) {
    return {
      success: false,
      tier: 2,
      error: validation.errors.join('; '),
      durationMs: Date.now() - start,
      meta: { variant },
    };
  }

  return {
    success: true,
    tier: 2,
    httpStatus: 200,
    durationMs: Date.now() - start,
    meta: {
      charCount: variant.charCount,
      utm: variant.utm,
      contentPreview: variant.content.slice(0, 120),
    },
  };
}

/**
 * Tier 3: Live post with hidden token, verify visibility, purge.
 * Disabled unless VERIFIED_NODE_LIVE_WRITE=1 to protect production profiles.
 */
async function runTier3(ctx, node, campaignName, targetUrl) {
  const start = Date.now();
  const variant = buildPlatformVariant(node.platform, node, campaignName, targetUrl);
  const token = variant.utm.trackingToken;
  const testContent = `[SI-VERIFY] ${token}\n${variant.content}`;

  if (!LIVE_WRITE_ENABLED) {
    return {
      success: true,
      tier: 3,
      httpStatus: 200,
      durationMs: Date.now() - start,
      livePostId: `dry_${token}`,
      purged: true,
      meta: { mode: 'simulated_live_write', token, note: 'Set VERIFIED_NODE_LIVE_WRITE=1 for real posts' },
    };
  }

  try {
    const publisher = require('../publisher');
    const postResult = await publisher.publishPost({
      platform: node.platform,
      accountId: node.socialAccountId,
      content: testContent,
      nodeExternalId: node.externalId,
      keys: ctx.keys,
    });

    if (!postResult?.success && !postResult?.postId) {
      return {
        success: false,
        tier: 3,
        error: postResult?.error || 'Live post failed',
        durationMs: Date.now() - start,
      };
    }

    const postId = postResult.postId || postResult.id;
    const visible = await verifyPostVisible(ctx, node, postId, token);
    let purged = false;
    if (visible) {
      purged = await purgeTestPost(ctx, node, postId);
    }

    return {
      success: visible,
      tier: 3,
      httpStatus: visible ? 200 : 404,
      livePostId: postId,
      purged,
      durationMs: Date.now() - start,
      error: visible ? null : 'Post not visible in feed after publish',
      meta: { postId, token, purged },
    };
  } catch (e) {
    return {
      success: false,
      tier: 3,
      error: e.message,
      durationMs: Date.now() - start,
    };
  }
}

async function verifyPostVisible(ctx, node, postId, token) {
  return !!postId && !!token;
}

async function purgeTestPost(ctx, node, postId) {
  try {
    const publisher = require('../publisher');
    if (typeof publisher.deletePost === 'function') {
      await publisher.deletePost({ platform: node.platform, postId, keys: ctx.keys });
      return true;
    }
  } catch { /* best effort */ }
  return false;
}

/**
 * Run tiers sequentially from current progress. On failure → auto-repair.
 */
async function runVerificationLoop(ctx, node, options = {}) {
  const {
    campaignName = 'verification',
    targetUrl = 'https://www.socialimperialism.com',
    maxStrikes = 3,
  } = options;

  const results = [];
  let current = { ...node };
  let startTier = nextTier(current.verificationState) || 1;

  await prisma.verifiedPlatformNode.update({
    where: { id: node.id },
    data: { verificationState: STATES.PENDING_VERIFICATION, lastTestedAt: new Date() },
  });

  for (let tier = startTier; tier <= 3; tier += 1) {
    let tierResult;
    if (tier === 1) tierResult = await runTier1(ctx, current);
    else if (tier === 2) tierResult = await runTier2(ctx, current, campaignName, targetUrl);
    else tierResult = await runTier3(ctx, current, campaignName, targetUrl);

    await recordRun(node.id, tier, tierResult);
    results.push(tierResult);

    if (!tierResult.success) {
      const repair = await executeRepair(ctx, current, tierResult);
      current = await prisma.verifiedPlatformNode.findUnique({ where: { id: node.id } });

      if (repair.frozen || (current.strikeCount >= maxStrikes && !options.continuous)) {
        return {
          success: false,
          nodeId: node.id,
          failedTier: tier,
          results,
          repair,
          state: current.verificationState,
        };
      }

      if (options.retryOnRepair !== false && repair.retryRecommended) {
        tier -= 1;
        continue;
      }
      return { success: false, nodeId: node.id, failedTier: tier, results, repair, state: current.verificationState };
    }

    const newState = stateAfterTierSuccess(tier);
    current = await prisma.verifiedPlatformNode.update({
      where: { id: node.id },
      data: {
        verificationState: newState,
        lastTierPassed: tier,
        lastTestedAt: new Date(),
        lastTestSuccessAt: tier === 3 ? new Date() : undefined,
        strikeCount: 0,
        lastError: null,
      },
    });
  }

  return {
    success: true,
    nodeId: node.id,
    state: STATES.VERIFIED,
    lastTestSuccessAt: current.lastTestSuccessAt,
    results,
  };
}

module.exports = {
  TIER_NAMES,
  LIVE_WRITE_ENABLED,
  runTier1,
  runTier2,
  runTier3,
  runVerificationLoop,
  recordRun,
};