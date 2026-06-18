/** Detect web-search discovery IDs vs real platform API post IDs. */
function isSyntheticExternalId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^(reddit|quora|twitter)_/i.test(id.trim());
}

function isEngageablePost(postOrPayload) {
  const p = postOrPayload || {};
  if (p.isWebDiscovery) return false;
  const id = p.externalId || p.postId;
  if (!id) return false;
  return !isSyntheticExternalId(id);
}

module.exports = { isSyntheticExternalId, isEngageablePost };