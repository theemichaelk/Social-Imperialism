const axios = require('axios');
const { fetchRealFeed } = require('./feedFetcher');
const { engagePost } = require('./engagement');
const contentAutomation = require('./contentAutomation');

const UA = 'SocialImperialism/1.0';

function loadJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function getFanpageSettings(store) {
  const auto = loadJson(store, 'autoContentSettings', {});
  const fan = loadJson(store, 'fanpageSettings', {});
  const rules = loadJson(store, 'autoRulesEngine', {});
  return {
    enabled: fan.enabled ?? auto.enabled ?? false,
    handsFree: fan.handsFree ?? rules.fbHandsFree ?? false,
    autoPost: fan.autoPost ?? rules.fbAutoPost ?? true,
    targetedFan: fan.targetedFan ?? rules.fbTargetedFan ?? true,
    rssUrls: fan.rssUrls?.length ? fan.rssUrls : (auto.rssUrls || []),
    targetAccountIds: fan.targetAccountIds?.length ? fan.targetAccountIds : (auto.targetAccountIds || []),
    includeInstagram: fan.includeInstagram !== false,
    acquisitionKeywords: fan.acquisitionKeywords || [],
    engageLike: fan.engageLike !== false,
    engageComment: fan.engageComment !== false,
    engageShare: fan.engageShare ?? false,
    maxEngagementsPerCycle: fan.maxEngagementsPerCycle ?? 5,
    frequency: fan.frequency || auto.frequency || 'daily',
  };
}

function saveFanpageSettings(store, settings) {
  const existing = loadJson(store, 'fanpageSettings', {});
  const merged = { ...existing, ...settings, updatedAt: new Date().toISOString() };
  store.setItem('fanpageSettings', JSON.stringify(merged));

  const auto = loadJson(store, 'autoContentSettings', {});
  store.setItem('autoContentSettings', JSON.stringify({
    ...auto,
    enabled: merged.handsFree || merged.enabled,
    rssUrls: merged.rssUrls || auto.rssUrls,
    targetAccountIds: merged.targetAccountIds || auto.targetAccountIds,
    frequency: merged.frequency || auto.frequency,
    targetPlatforms: merged.includeInstagram !== false ? ['Facebook', 'Instagram'] : ['Facebook'],
  }));

  const rules = loadJson(store, 'autoRulesEngine', {});
  store.setItem('autoRulesEngine', JSON.stringify({
    ...rules,
    fbAutoPost: merged.autoPost,
    fbTargetedFan: merged.targetedFan,
    fbHandsFree: merged.handsFree,
  }));

  return merged;
}

function recordPageMetrics(store, accountId, delta = {}) {
  const metrics = loadJson(store, 'fanpageMetrics', {});
  const prev = metrics[accountId] || {
    followers: 0, likes: 0, reach: 0, postsPublished: 0, engagements: 0, updatedAt: null,
  };
  metrics[accountId] = {
    followers: prev.followers + (delta.followers || 0),
    likes: prev.likes + (delta.likes || 0),
    reach: prev.reach + (delta.reach || 0),
    postsPublished: prev.postsPublished + (delta.postsPublished || 0),
    engagements: prev.engagements + (delta.engagements || 0),
    updatedAt: new Date().toISOString(),
  };
  store.setItem('fanpageMetrics', JSON.stringify(metrics));
  return metrics[accountId];
}

function getFanpageMetrics(store, accountIds = []) {
  const all = loadJson(store, 'fanpageMetrics', {});
  if (!accountIds.length) return all;
  const filtered = {};
  accountIds.forEach((id) => { if (all[id]) filtered[id] = all[id]; });
  return filtered;
}

async function autoPostToFanpages({
  store, campaign, keys, linkedAccounts, generateAI, falKey, publishFn,
}) {
  const settings = getFanpageSettings(store);
  if (!settings.autoPost || !settings.rssUrls?.length || !settings.targetAccountIds?.length) {
    return { posted: 0, skipped: true };
  }

  let posted = 0;
  for (const rssUrl of settings.rssUrls.slice(0, 2)) {
    let items = [];
    try {
      items = await contentAutomation.parseRssItems(rssUrl, 1);
    } catch (e) {
      console.error('Fanpage RSS error:', e.message);
      continue;
    }

    for (const item of items) {
      const platforms = settings.includeInstagram !== false ? ['Facebook', 'Instagram'] : ['Facebook'];
      for (const platform of platforms) {
        try {
          const curated = await contentAutomation.curateRssItem({
            item, campaign, generateAI, targetPlatform: platform, falKey,
          });
          await publishFn(curated, settings.targetAccountIds);
          settings.targetAccountIds.forEach((accId) => {
            recordPageMetrics(store, accId, {
              postsPublished: 1,
              likes: 0,
              reach: 0,
            });
          });
          posted += 1;
        } catch (e) {
          console.error('Fanpage post error:', e.message);
        }
      }
    }
  }
  return { posted };
}

async function runTargetedFanAcquisition({
  store, campaign, keys, linkedAccounts, generateAI,
}) {
  const settings = getFanpageSettings(store);
  if (!settings.targetedFan) return { engaged: 0, skipped: true };

  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let keywords = settings.acquisitionKeywords || [];
  if (!keywords.length) {
    try {
      keywords = JSON.parse(store.getItem('keywords') || '[]')
        .filter((k) => k.campaignId === activeCampaignId)
        .map((k) => k.term);
    } catch (e) {}
  }
  if (!keywords.length) keywords = [campaign.brandName || 'marketing'];

  const posts = await fetchRealFeed({
    keywords: keywords.slice(0, 3),
    filters: { platform: 'Facebook', sort: 'engagement' },
    keys,
    allowedPlatforms: new Set(['Facebook']),
  });

  let engaged = 0;
  const max = settings.maxEngagementsPerCycle || 5;
  const accounts = linkedAccounts.filter((a) =>
    settings.targetAccountIds.includes(a.id)
    || (a.platform || '').includes('Facebook')
    || (settings.includeInstagram && (a.platform || '').includes('Instagram'))
  );

  for (const post of posts.slice(0, max * 2)) {
    if (engaged >= max) break;
    const account = accounts[engaged % accounts.length];
    if (!account) break;

    try {
      if (settings.engageLike) {
        await engagePost({
          action: 'like', platform: post.platform, externalId: post.externalId,
          postId: post.externalId, accountId: account.id,
        }, keys, linkedAccounts);
      }
      if (settings.engageComment && generateAI) {
        const comment = await generateAI(
          `Write a helpful, non-spammy comment (max 200 chars) from ${campaign.brandName} engaging with: "${(post.content || '').substring(0, 200)}". Subtly invite to our page. Return ONLY the comment.`
        );
        await engagePost({
          action: 'reply', platform: post.platform, externalId: post.externalId,
          postId: post.externalId, content: comment, accountId: account.id,
        }, keys, linkedAccounts);
      }
      if (settings.engageShare) {
        await engagePost({
          action: 'share', platform: post.platform, externalId: post.externalId,
          postId: post.externalId, accountId: account.id,
        }, keys, linkedAccounts);
      }

      recordPageMetrics(store, account.id, {
        engagements: 1,
        followers: 0,
        reach: 0,
      });
      engaged += 1;
    } catch (e) {
      console.error('Fan acquisition engage error:', e.message);
    }
  }

  return { engaged, prospects: posts.slice(0, 5) };
}

async function runHandsFreeCycle(deps) {
  const settings = getFanpageSettings(deps.store);
  if (!settings.handsFree && !settings.enabled) {
    return { skipped: true, reason: 'Hands-free mode disabled' };
  }

  const results = { contentPosted: 0, fansEngaged: 0 };

  if (settings.autoPost) {
    const postResult = await autoPostToFanpages(deps);
    results.contentPosted = postResult.posted || 0;
  }

  if (settings.targetedFan) {
    const acqResult = await runTargetedFanAcquisition(deps);
    results.fansEngaged = acqResult.engaged || 0;
    results.prospects = acqResult.prospects;
  }

  let tasks = loadJson(deps.store, 'workerTasks', []);
  if (results.contentPosted + results.fansEngaged > 0) {
    tasks.unshift({
      time: new Date().toLocaleTimeString(),
      action: `Fanpage hands-free: ${results.contentPosted} post(s), ${results.fansEngaged} engagement(s)`,
      platform: 'Facebook',
    });
    deps.store.setItem('workerTasks', JSON.stringify(tasks.slice(0, 15)));
  }

  deps.store.setItem('fanpageLastRun', String(Date.now()));
  return results;
}

module.exports = {
  getFanpageSettings,
  saveFanpageSettings,
  recordPageMetrics,
  getFanpageMetrics,
  autoPostToFanpages,
  runTargetedFanAcquisition,
  runHandsFreeCycle,
};