/**
 * Phase 4: Dynamic UTM injection per verified node.
 */
const DEFAULT_TARGET = 'https://www.socialimperialism.com';

function slugify(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}

function buildUtmParams(node, campaignName, entityData = {}) {
  const platform = slugify(node.platform);
  const campaign = slugify(campaignName || 'organic');
  const data = typeof entityData === 'string' ? JSON.parse(entityData) : entityData;

  let utmSource = platform;
  let utmMedium = 'profile';

  switch (node.platform) {
    case 'Discord':
      utmSource = 'discord';
      utmMedium = `server_${data.guild_id || node.externalId}_channel_${data.channel_id || node.externalId}`;
      break;
    case 'Facebook':
      utmSource = 'facebook';
      utmMedium = node.nodeType === 'Group'
        ? `group_${data.group_id || node.externalId}`
        : `page_${data.page_id || node.externalId}`;
      break;
    case 'Instagram':
      utmSource = 'instagram';
      utmMedium = `page_${data.page_id || node.externalId}`;
      break;
    case 'Twitter':
      utmSource = 'twitter';
      utmMedium = `profile_${data.user_id || node.externalId}`;
      break;
    case 'LinkedIn':
      utmSource = 'linkedin';
      utmMedium = node.nodeType === 'Organization'
        ? `org_${data.organization_urn || node.externalId}`
        : `person_${data.person_urn || node.externalId}`;
      break;
    case 'Reddit':
      utmSource = 'reddit';
      utmMedium = `subreddit_${data.subreddit_id || node.externalId}`;
      break;
    case 'YouTube':
      utmSource = 'youtube';
      utmMedium = `channel_${data.channel_id || node.externalId}`;
      break;
    case 'TikTok':
      utmSource = 'tiktok';
      utmMedium = `creator_${data.creator_id || node.externalId}`;
      break;
    case 'Pinterest':
      utmSource = 'pinterest';
      utmMedium = `board_${data.board_id || node.externalId}`;
      break;
    case 'Telegram':
      utmSource = 'telegram';
      utmMedium = `chat_${String(data.chat_id || node.externalId).replace('-', 'neg')}`;
      break;
    case 'Twitch':
      utmSource = 'twitch';
      utmMedium = `broadcaster_${data.broadcaster_id || node.externalId}`;
      break;
    default:
      utmMedium = `${slugify(node.nodeType)}_${node.externalId}`;
  }

  return { utmSource, utmMedium, utmCampaign: campaign };
}

function buildTrackedUrl(targetUrl, node, campaignName, entityData) {
  const base = (targetUrl || DEFAULT_TARGET).split('?')[0];
  const { utmSource, utmMedium, utmCampaign } = buildUtmParams(node, campaignName, entityData);
  const token = `si_${node.id.slice(-8)}_${Date.now().toString(36)}`;
  const params = new URLSearchParams({
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    si_node: node.id,
    si_token: token,
  });
  return {
    fullUrl: `${base}?${params.toString()}`,
    utmSource,
    utmMedium,
    utmCampaign,
    trackingToken: token,
  };
}

module.exports = {
  DEFAULT_TARGET,
  buildUtmParams,
  buildTrackedUrl,
};