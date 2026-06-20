/** Detect web-search discovery IDs vs real platform API post IDs. */
function isSyntheticExternalId(id) {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (/^(reddit|quora|twitter)_/i.test(trimmed)) return true;
  if (/^t3_[a-z0-9]+$/i.test(trimmed)) return false;
  if (/^[a-z0-9]{5,10}$/i.test(trimmed)) return false;
  return false;
}

function redditPostIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/comments\/([a-z0-9]+)/i);
  return m ? m[1] : null;
}

function normalizeRedditExternalId(id, url) {
  if (id && !isSyntheticExternalId(id)) {
    return id.startsWith('t3_') ? id : `t3_${id}`;
  }
  const fromUrl = redditPostIdFromUrl(url);
  return fromUrl ? `t3_${fromUrl}` : id;
}

function isEngageablePost(postOrPayload) {
  const p = postOrPayload || {};
  if (p.isWebDiscovery) return false;
  const id = p.externalId || p.postId;
  if (!id) return false;
  return !isSyntheticExternalId(id);
}

module.exports = {
  isSyntheticExternalId,
  isEngageablePost,
  redditPostIdFromUrl,
  normalizeRedditExternalId,
};