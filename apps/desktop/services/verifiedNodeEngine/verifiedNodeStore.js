/**
 * Persist discovered accounts → VerifiedPlatformNode tree in Prisma.
 */
const { prisma } = require('@si/db');
const { mapAccountToNodes, validateEntityData } = require('./platformDiscoverySchema');
const { STATES } = require('./nodeStateMachine');

async function upsertNodesFromAccounts(projectId, accounts) {
  const upserted = [];
  for (const account of accounts) {
    const mapped = mapAccountToNodes(account, projectId);
    let rootId = null;

    for (const row of mapped) {
      const entityData = typeof row.entityData === 'object'
        ? JSON.stringify(row.entityData)
        : row.entityData;
      const parentNodeId = row.depth > 0 && rootId ? rootId : row.parentNodeId;

      const data = {
        projectId,
        socialAccountId: row.socialAccountId,
        connectionId: row.connectionId,
        parentNodeId,
        platform: row.platform,
        nodeType: row.nodeType,
        externalId: row.externalId,
        displayName: row.displayName,
        depth: row.depth,
        entityData,
        privacyState: row.privacyState,
        memberCount: row.memberCount,
        verificationState: STATES.DISCOVERED,
      };

      const node = await prisma.verifiedPlatformNode.upsert({
        where: {
          projectId_platform_externalId: {
            projectId,
            platform: row.platform,
            externalId: row.externalId,
          },
        },
        update: { ...data, updatedAt: new Date() },
        create: data,
      });

      if (!rootId && row.depth === 0) rootId = node.id;
      upserted.push(node);
    }
  }
  return upserted;
}

async function discoverAndPopulate(projectId, accounts) {
  const nodes = await upsertNodesFromAccounts(projectId, accounts);
  const proof = [];

  for (const node of nodes) {
    const check = validateEntityData(node.platform, node.nodeType, node.entityData);
    proof.push({
      nodeId: node.id,
      platform: node.platform,
      nodeType: node.nodeType,
      externalId: node.externalId,
      valid: check.ok,
      missing: check.missing || [],
      memberCount: node.memberCount,
      privacyState: node.privacyState,
    });

    if (check.ok) {
      await prisma.verifiedPlatformNode.update({
        where: { id: node.id },
        data: { verificationState: STATES.PENDING_VERIFICATION },
      });
    }
  }

  return { nodes, proof, total: nodes.length, validCount: proof.filter((p) => p.valid).length };
}

async function getVerifiedTree(projectId) {
  const nodes = await prisma.verifiedPlatformNode.findMany({
    where: { projectId },
    orderBy: [{ depth: 'asc' }, { displayName: 'asc' }],
    include: {
      verificationRuns: { orderBy: { createdAt: 'desc' }, take: 3 },
      repairAttempts: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
  });

  return nodes.map((n) => ({
    ...n,
    verified: n.verificationState === STATES.VERIFIED,
    badge: n.lastTestSuccessAt
      ? { color: 'green', label: `Verified ${n.lastTestSuccessAt.toISOString()}` }
      : { color: 'amber', label: n.verificationState },
  }));
}

async function bindCampaignNodes(campaignId, nodeIds) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('Campaign not found');

  const bound = [];
  for (const nodeId of nodeIds) {
    const node = await prisma.verifiedPlatformNode.findUnique({ where: { id: nodeId } });
    if (!node) throw new Error(`Node ${nodeId} not found`);
    if (node.verificationState !== STATES.VERIFIED || !node.lastTestSuccessAt) {
      throw new Error(`Node ${node.displayName || nodeId} is not verified — last_test_successful required`);
    }

    const binding = await prisma.campaignNodeBinding.upsert({
      where: { campaignId_nodeId: { campaignId, nodeId } },
      update: { enabled: true },
      create: { campaignId, nodeId, enabled: true },
    });
    bound.push(binding);
  }
  return bound;
}

async function setCampaignControl(campaignId, action, payload = {}) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('Campaign not found');

  switch (action) {
    case 'pause':
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'paused' } });
      await prisma.scheduledPost.updateMany({
        where: { campaignId, status: 'scheduled' },
        data: { status: 'paused' },
      });
      return { status: 'paused', campaignId };

    case 'resume':
    case 'running':
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'running' } });
      await prisma.scheduledPost.updateMany({
        where: { campaignId, status: 'paused' },
        data: { status: 'scheduled' },
      });
      return { status: 'running', campaignId };

    case 'delete':
      await prisma.scheduledPost.deleteMany({ where: { campaignId } });
      await prisma.campaignNodeBinding.deleteMany({ where: { campaignId } });
      await prisma.campaign.delete({ where: { id: campaignId } });
      return { deleted: true, campaignId };

    case 'edit':
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          name: payload.name || campaign.name,
          targetUrl: payload.targetUrl || campaign.targetUrl,
          timezone: payload.timezone || campaign.timezone,
          frequencyCron: payload.frequencyCron ?? campaign.frequencyCron,
          burstIntervalM: payload.burstIntervalM ?? campaign.burstIntervalM,
          metadata: payload.metadata ? JSON.stringify(payload.metadata) : campaign.metadata,
        },
      });
      if (payload.scheduledPosts?.length) {
        for (const post of payload.scheduledPosts) {
          if (post.id) {
            await prisma.scheduledPost.update({
              where: { id: post.id },
              data: {
                content: post.content,
                scheduledFor: post.scheduledFor ? new Date(post.scheduledFor) : undefined,
                mediaUrl: post.mediaUrl,
              },
            });
          }
        }
      }
      return { updated: true, campaignId };

    default:
      throw new Error(`Unknown campaign action: ${action}`);
  }
}

async function listCampaigns(projectId) {
  const campaigns = await prisma.campaign.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    include: {
      nodeBindings: {
        include: {
          node: {
            select: {
              id: true,
              platform: true,
              displayName: true,
              externalId: true,
              verificationState: true,
              lastTestSuccessAt: true,
            },
          },
        },
      },
    },
  });
  return campaigns;
}

async function createCampaign(projectId, { name, targetUrl, timezone, frequencyCron, burstIntervalM }) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error(`Project ${projectId} not found`);

  const campaign = await prisma.campaign.create({
    data: {
      projectId,
      name: name || 'Untitled Campaign',
      targetUrl: targetUrl || 'https://www.socialimperialism.com',
      timezone: timezone || 'UTC',
      frequencyCron: frequencyCron || null,
      burstIntervalM: burstIntervalM || null,
      status: 'running',
    },
  });
  return campaign;
}

module.exports = {
  upsertNodesFromAccounts,
  discoverAndPopulate,
  getVerifiedTree,
  bindCampaignNodes,
  setCampaignControl,
  listCampaigns,
  createCampaign,
};