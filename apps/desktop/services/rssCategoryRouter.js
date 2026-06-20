/**
 * Route category RSS feeds to matched communities/groups with AI curation.
 */
const {
  getSiteRssSources,
  parseFeedItems,
  upsertSiteSource,
  updateFeedMappings,
} = require('./siteRssDiscovery');
const { autoMapFeedsToTargets } = require('./categoryCommunityMatcher');
const { curateRssItem, queueContent, formatPostForPlatform } = require('./contentAutomation');
const { getLinkedAccounts, getAccountGroups, findAccountById } = require('./accountAutomation');
const { publishPost } = require('./publisher');
const { waitBeforeAction, humanizeContent } = require('./humanBehavior');

function loadJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function getSeenKey(feedId, guid) {
  return `catrss:${feedId}:${guid}`;
}

function getSeenGuids(store) {
  return new Set(loadJson(store, 'categoryRssSeenGuids', []));
}

function markSeen(store, feedId, guid) {
  const seen = getSeenGuids(store);
  seen.add(getSeenKey(feedId, guid));
  store.setItem('categoryRssSeenGuids', JSON.stringify(Array.from(seen).slice(-800)));
}

async function publishToMappedTarget({ store, keys, curated, mapping, humanLike = true }) {
  const campaignId = store.getItem('activeCampaignId') || 'default';
  const accounts = getLinkedAccounts(store, campaignId);
  const account = findAccountById(accounts, mapping.accountId);
  if (!account) throw new Error(`Account ${mapping.accountId} not found`);

  const settings = account.settings || {};
  if (humanLike) await waitBeforeAction(settings);

  let content = curated.content || curated.rawContent || '';
  if (humanLike) content = humanizeContent(content, settings);

  const isGroup = ['Group', 'Subreddit', 'Community', 'Server'].includes(mapping.targetType);
  const postData = {
    accountId: mapping.accountId,
    platform: mapping.platform || account.platform,
    content,
    hasMedia: !!curated.mediaUrl,
    mediaUrl: curated.mediaUrl,
    humanLike,
    groupId: isGroup ? mapping.targetId : undefined,
    subreddit: mapping.subreddit || (mapping.targetType === 'Subreddit' ? mapping.targetName?.replace(/^r\//i, '') : undefined),
    targetType: mapping.targetType,
  };

  if (isGroup) {
    const group = getAccountGroups(account, accounts).find((g) => String(g.id) === String(mapping.targetId));
    if (group) {
      postData.groupId = String(group.id);
      postData.subreddit = group.subreddit || postData.subreddit;
      postData.targetType = group.type;
      postData.platform = group.platform || postData.platform;
    }
  }

  const result = await publishPost(postData, keys, accounts, { humanLike: false });
  return { success: true, mapping: mapping.targetName, platform: postData.platform, result };
}

async function runCategoryRssRouter({
  store,
  generateAI,
  falKey,
  resolveKeys,
  publishMode = 'queue',
  limitPerFeed = 2,
}) {
  const sources = getSiteRssSources(store).filter((s) => s.enabled !== false);
  if (!sources.length) {
    return { processed: 0, skipped: true, reason: 'No site RSS sources configured' };
  }

  const campaignId = store.getItem('activeCampaignId') || 'default';
  let campaign = {};
  try {
    campaign = JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === campaignId) || {};
  } catch (e) {}

  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const seen = getSeenGuids(store);
  let processed = 0;
  const results = [];

  for (const source of sources) {
    for (const feed of (source.feeds || []).filter((f) => f.enabled !== false)) {
      const mappings = (feed.targetMappings || []).filter((m) => m.autoPost !== false);
      if (!mappings.length) continue;

      let items = [];
      try {
        items = await parseFeedItems(feed, limitPerFeed + 2);
      } catch (e) {
        console.error(`Category RSS parse failed ${feed.rssUrl}:`, e.message);
        continue;
      }

      for (const item of items) {
        const guid = item.guid || item.link;
        if (!guid || seen.has(getSeenKey(feed.id, guid))) continue;

        for (const mapping of mappings) {
          try {
            const platform = mapping.platform || 'Facebook';
            const curated = await curateRssItem({
              item,
              campaign,
              generateAI,
              targetPlatform: platform,
              falKey,
            });
            curated.category = feed.category;
            curated.feedId = feed.id;
            curated.sourceSite = source.siteName;
            curated.targetName = mapping.targetName;
            curated.content = formatPostForPlatform(curated.content, platform);

            if (publishMode === 'auto') {
              const pub = await publishToMappedTarget({ store, keys, curated, mapping });
              results.push({ action: 'published', category: feed.category, target: mapping.targetName, title: item.title, ...pub });
            } else {
              queueContent(store, {
                ...curated,
                platform,
                accountId: mapping.accountId,
                groupId: mapping.targetId,
                targetMapping: mapping,
                status: 'pending_review',
              });
              results.push({ action: 'queued', category: feed.category, target: mapping.targetName, title: item.title });
            }
            processed += 1;
          } catch (e) {
            console.error('Category RSS route error:', e.message);
            results.push({ action: 'error', category: feed.category, target: mapping.targetName, error: e.message });
          }
        }
        markSeen(store, feed.id, guid);
      }
    }
  }

  store.setItem('categoryRssLastRun', String(Date.now()));
  return { processed, results };
}

function syncAutoContentFromSiteSources(store) {
  const sources = getSiteRssSources(store);
  const urls = [];
  sources.forEach((s) => {
    (s.feeds || []).forEach((f) => {
      if (f.enabled !== false && f.rssUrl) urls.push(f.rssUrl);
    });
  });
  const settings = loadJson(store, 'autoContentSettings', {
    enabled: false,
    rssUrls: [],
    categoryRouting: false,
  });
  settings.rssUrls = [...new Set([...(settings.rssUrls || []), ...urls])];
  settings.categoryRouting = sources.some((s) => (s.feeds || []).some((f) => (f.targetMappings || []).length));
  store.setItem('autoContentSettings', JSON.stringify(settings));
  return settings;
}

module.exports = {
  runCategoryRssRouter,
  publishToMappedTarget,
  syncAutoContentFromSiteSources,
  upsertSiteSource,
  updateFeedMappings,
  autoMapFeedsToTargets,
};