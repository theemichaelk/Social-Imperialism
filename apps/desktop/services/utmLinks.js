/**
 * UTM link injection for AI replies and outbound brand URLs.
 */

function buildUtmUrl(baseUrl, campaign = {}, extra = {}) {
  if (!baseUrl || typeof baseUrl !== 'string') return baseUrl;
  let url = baseUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    if (campaign.domain) url = `https://${campaign.domain.replace(/^https?:\/\//, '')}`;
    else return baseUrl;
  }
  try {
    const u = new URL(url);
    const source = campaign.utmSource || extra.utmSource || 'social_imperialism';
    const medium = campaign.utmMedium || extra.utmMedium || 'ai_reply';
    const content = extra.utmContent || campaign.brandName || 'brand';
    u.searchParams.set('utm_source', source);
    u.searchParams.set('utm_medium', medium);
    u.searchParams.set('utm_campaign', (campaign.brandName || 'campaign').replace(/\s+/g, '_').toLowerCase());
    u.searchParams.set('utm_content', String(content).slice(0, 80));
    return u.toString();
  } catch (e) {
    return baseUrl;
  }
}

function injectUtmInReply(replyText, campaign = {}) {
  if (!replyText || !campaign.domain) return { text: replyText, hasUtmLink: false };
  const domain = campaign.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const re = new RegExp(`(https?://)?${domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\s]*`, 'gi');
  let hasUtm = false;
  const text = replyText.replace(re, (match) => {
    const full = match.startsWith('http') ? match : `https://${match}`;
    if (full.includes('utm_source=')) {
      hasUtm = true;
      return match;
    }
    hasUtm = true;
    return buildUtmUrl(full, campaign);
  });
  if (!hasUtm && domain) {
    const utmUrl = buildUtmUrl(`https://${domain}`, campaign);
    return { text: `${text.trim()} ${utmUrl}`, hasUtmLink: true };
  }
  return { text, hasUtmLink: hasUtm };
}

module.exports = { buildUtmUrl, injectUtmInReply };