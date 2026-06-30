/**
 * Phase 4: Multi-format content variants from target URL.
 */
const { buildTrackedUrl, DEFAULT_TARGET } = require('./utmGenerator');

const PLATFORM_LIMITS = {
  Twitter: { maxChars: 280, hashtags: 3 },
  Reddit: { maxChars: 40000, markdown: true },
  Instagram: { maxChars: 2200, hashtags: 30 },
  Facebook: { maxChars: 63206 },
  LinkedIn: { maxChars: 3000 },
  Discord: { maxChars: 2000, embed: true },
  Pinterest: { maxChars: 500, imageRequired: true },
  TikTok: { maxChars: 2200, videoPreferred: true },
  Telegram: { maxChars: 4096 },
  default: { maxChars: 2000 },
};

function scrapeTargetMeta(targetUrl = DEFAULT_TARGET) {
  return {
    url: targetUrl,
    title: 'Social Imperialism — Autonomous Social Media Infrastructure',
    description: 'Auto-create, authenticate, and orchestrate campaigns across 15 platforms.',
    keywords: ['social media automation', 'multi-platform', 'AI campaigns'],
  };
}

function buildPlatformVariant(platform, node, campaignName, targetUrl) {
  const meta = scrapeTargetMeta(targetUrl);
  const tracked = buildTrackedUrl(targetUrl, node, campaignName, node.entityData);
  const limits = PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.default;
  const hashtags = ['#SocialImperialism', '#Automation', '#Growth'].slice(0, limits.hashtags || 3);

  let body = `${meta.title}\n\n${meta.description}\n\n${tracked.fullUrl}`;

  if (platform === 'Reddit' && limits.markdown) {
    body = `**${meta.title}**\n\n${meta.description}\n\n[Learn more](${tracked.fullUrl})`;
  }
  if (platform === 'Discord' && limits.embed) {
    body = JSON.stringify({
      content: meta.title,
      embeds: [{ title: meta.title, description: meta.description, url: tracked.fullUrl }],
    });
  }
  if (platform === 'Instagram' || platform === 'Pinterest') {
    body = `${meta.description}\n\n${hashtags.join(' ')}\n${tracked.fullUrl}`;
  }

  if (body.length > limits.maxChars) {
    body = `${body.slice(0, limits.maxChars - 20)}… ${tracked.fullUrl}`;
  }

  return {
    platform,
    nodeType: node.nodeType,
    content: body,
    trackedUrl: tracked.fullUrl,
    utm: tracked,
    charCount: body.length,
    withinLimits: body.length <= limits.maxChars,
    aspectRatioOk: !limits.imageRequired,
    linkShortenerOk: !tracked.fullUrl.includes(' '),
  };
}

function validateDryRunPayload(variant) {
  const errors = [];
  if (!variant.withinLimits) errors.push('Character limit exceeded');
  if (!variant.linkShortenerOk) errors.push('Invalid tracking URL');
  if (!variant.trackedUrl?.includes('utm_source')) errors.push('UTM missing');
  if (!variant.content?.trim()) errors.push('Empty content');
  return { ok: errors.length === 0, errors, variant };
}

module.exports = {
  scrapeTargetMeta,
  buildPlatformVariant,
  validateDryRunPayload,
  PLATFORM_LIMITS,
};