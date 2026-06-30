/**
 * Sync structured desktop store keys → Prisma relational tables.
 * ProjectSetting rows remain the source for bulk JSON; this keeps
 * SocialAccount, Keyword, and ScheduledPost queryable.
 */
const { prisma } = require('@si/db');
const { isDemoLinkedAccount } = require('./projectDefaults');

function loadJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function persistKeywords(store, projectId) {
  const all = loadJson(store, 'keywords', []);
  const mine = all.filter((k) => !k.campaignId || k.campaignId === projectId);
  const real = mine.filter((k) => k.term?.trim());

  await prisma.keyword.deleteMany({
    where: {
      projectId,
      term: { notIn: real.map((k) => k.term) },
    },
  });

  for (const kw of real) {
    const data = {
      term: kw.term,
      platformFlags: JSON.stringify(kw.platforms || kw.platformFlags || []),
      customPrompt: kw.customPrompt || kw.prompt || null,
      intentTags: JSON.stringify(kw.intentTags || kw.tags || []),
    };
    if (kw.id) {
      await prisma.keyword.upsert({
        where: { id: kw.id },
        update: data,
        create: { id: kw.id, projectId, ...data },
      });
    } else {
      const existing = await prisma.keyword.findFirst({
        where: { projectId, term: kw.term },
      });
      if (existing) {
        await prisma.keyword.update({ where: { id: existing.id }, data });
      } else {
        await prisma.keyword.create({ data: { projectId, ...data } });
      }
    }
  }
}

async function persistSocialAccounts(store, projectId) {
  const linkedKey = `linkedAccounts_${projectId}`;
  const accounts = loadJson(store, linkedKey, []).filter((a) => !isDemoLinkedAccount(a));

  const keepIds = accounts.map((a) => a.id).filter(Boolean);
  if (keepIds.length) {
    await prisma.socialAccount.deleteMany({
      where: { projectId, id: { notIn: keepIds } },
    });
  } else {
    await prisma.socialAccount.deleteMany({ where: { projectId } });
  }

  for (const acc of accounts) {
    const { tokens, accessToken, refreshToken, ...meta } = acc;
    const encrypted = tokens || accessToken || refreshToken
      ? JSON.stringify({ tokens, accessToken, refreshToken })
      : null;
    const data = {
      platform: acc.platform || 'Unknown',
      handle: acc.handle || acc.name || null,
      accountType: acc.type || acc.accountType || null,
      encryptedTokens: encrypted,
      metadata: JSON.stringify(meta),
      status: acc.status || 'connected',
    };
    if (acc.id) {
      await prisma.socialAccount.upsert({
        where: { id: acc.id },
        update: data,
        create: { id: acc.id, projectId, ...data },
      });
    } else {
      await prisma.socialAccount.create({ data: { projectId, ...data } });
    }
  }
}

async function persistScheduledPosts(store, projectId) {
  const posts = loadJson(store, 'scheduled_posts', []);
  const mine = posts.filter((p) => !p.campaignId || p.campaignId === projectId);

  const keepIds = mine.map((p) => p.id).filter(Boolean);
  if (keepIds.length) {
    await prisma.scheduledPost.deleteMany({
      where: { projectId, id: { notIn: keepIds } },
    });
  }

  for (const post of mine) {
    if (!post.content?.trim()) continue;
    const scheduledFor = post.scheduleTime || post.scheduledFor || post.scheduledAt;
    if (!scheduledFor) continue;

    const data = {
      platform: post.platform || null,
      accountId: post.accountId || null,
      socialAccountId: post.socialAccountId || post.accountId || null,
      content: post.content,
      mediaUrl: post.mediaUrl || post.imageUrl || null,
      scheduledFor: new Date(scheduledFor),
      status: post.status || 'scheduled',
      metadata: JSON.stringify({
        title: post.title,
        hashtags: post.hashtags,
        postType: post.postType,
      }),
    };

    if (post.id) {
      await prisma.scheduledPost.upsert({
        where: { id: post.id },
        update: data,
        create: { id: post.id, projectId, ...data },
      });
    } else {
      await prisma.scheduledPost.create({ data: { projectId, ...data } });
    }
  }
}

const PERSIST_CHANNELS = new Set([
  'save-settings',
  'set-active-campaign',
  'save-global-keys',
  'connect-platform',
  'disconnect-platform',
  'save-linked-accounts',
  'add-keyword',
  'update-keyword',
  'delete-keyword',
  'save-keywords',
  'generate-keywords',
  'schedule-post',
  'cancel-scheduled-post',
  'publish-post',
  'save-auto-rules',
  'save-auto-content-settings',
]);

async function persistEntitiesFromStore(store, projectId, channel) {
  if (channel && !PERSIST_CHANNELS.has(channel)) return;

  let campaigns = [];
  try { campaigns = JSON.parse(store.getItem('campaigns') || '[]'); } catch { /* ignore */ }
  const campaign = campaigns.find((c) => c.id === projectId);
  if (campaign?.brandName?.trim()) {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        name: campaign.brandName,
        brandName: campaign.brandName,
        domain: campaign.domain || '',
        description: campaign.description || '',
        tone: campaign.tone || 'Professional',
        guidelines: campaign.guidelines || campaign.brandGuidelines || null,
      },
    }).catch(() => {});
  }

  await Promise.all([
    persistKeywords(store, projectId),
    persistSocialAccounts(store, projectId),
    persistScheduledPosts(store, projectId),
  ]);
}

module.exports = {
  persistEntitiesFromStore,
  persistKeywords,
  persistSocialAccounts,
  persistScheduledPosts,
  PERSIST_CHANNELS,
};