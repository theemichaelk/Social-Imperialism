/**
 * Post-fetch filters for browse/advanced settings (language, location, media, followers).
 */

const LANG_HINTS = {
  es: /\b(el|la|los|las|que|para|con|por|como|más|este|esta)\b/i,
  fr: /\b(le|la|les|des|une|pour|avec|dans|est|que|plus)\b/i,
  de: /\b(der|die|das|und|ist|nicht|mit|für|auf|ein|eine)\b/i,
  pt: /\b(o|a|os|as|que|para|com|por|como|mais|este|esta)\b/i,
  ja: /[\u3040-\u30ff\u4e00-\u9faf]/,
};

const LOCATION_HINTS = {
  us: /\b(usa|united states|america|nyc|california|texas)\b/i,
  uk: /\b(uk|united kingdom|london|britain|england)\b/i,
  ca: /\b(canada|toronto|vancouver|ontario)\b/i,
  au: /\b(australia|sydney|melbourne)\b/i,
  eu: /\b(europe|germany|france|spain|italy|berlin|paris)\b/i,
  asia: /\b(asia|india|japan|china|singapore|korea|tokyo)\b/i,
};

function latinRatio(text) {
  const t = (text || '').replace(/\s/g, '');
  if (!t.length) return 0;
  const latin = (t.match(/[a-zA-Z]/g) || []).length;
  return latin / t.length;
}

function matchesLanguage(post, lang) {
  if (!lang || lang === 'all') return true;
  const content = `${post.content || ''} ${post.author || ''}`;
  if (lang === 'en') return latinRatio(content) >= 0.55 && !LANG_HINTS.ja.test(content);
  if (LANG_HINTS[lang]) return LANG_HINTS[lang].test(content);
  return true;
}

function matchesLocation(post, location) {
  if (!location || location === 'global') return true;
  const content = `${post.content || ''} ${post.author || ''} ${post.url || ''}`;
  if (post.location && post.location.toLowerCase() === location) return true;
  const hint = LOCATION_HINTS[location];
  return hint ? hint.test(content) : true;
}

function enrichPostMeta(post) {
  const url = post.url || '';
  const content = post.content || '';
  const hasMedia = post.hasMedia
    || !!post.mediaUrl
    || /\.(jpg|jpeg|png|gif|webp|mp4|mov)(\?|$)/i.test(url)
    || /\[media\]/i.test(content)
    || !!(post.stats?.views && post.postType === 'video');
  const authorFollowers = post.authorFollowers
    ?? post.followerCount
    ?? (post.author?.match(/(\d+(?:\.\d+)?)[kKmM]?\s*followers?/i)?.[1]
      ? parseFollowerCount(post.author.match(/(\d+(?:\.\d+)?)[kKmM]?/i)[1], post.author)
      : undefined);
  return { ...post, hasMedia, authorFollowers };
}

function parseFollowerCount(num, raw) {
  let n = parseFloat(num);
  if (Number.isNaN(n)) return undefined;
  if (/m/i.test(raw)) n *= 1_000_000;
  else if (/k/i.test(raw)) n *= 1000;
  return Math.round(n);
}

function applyFeedFilters(posts, filters = {}) {
  const minFollowers = parseInt(filters.minFollowers, 10) || 0;
  const mediaOnly = filters.media === 'only' || filters.mediaOnly === true;
  const lang = filters.language;
  const location = filters.location;

  return posts.map(enrichPostMeta).filter((post) => {
    if (!matchesLanguage(post, lang)) return false;
    if (!matchesLocation(post, location)) return false;
    if (mediaOnly && !post.hasMedia) return false;
    if (minFollowers > 0 && post.authorFollowers != null && post.authorFollowers < minFollowers) return false;
    return true;
  });
}

module.exports = {
  applyFeedFilters,
  enrichPostMeta,
  matchesLanguage,
  matchesLocation,
};