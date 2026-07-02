/**
 * Shared engageability rules for Browse Posts (server + client parity).
 */
function isEngageablePost(post) {
  if (!post || typeof post !== 'object') return false;
  if (post.isWebDiscovery || post.isHubPost) return false;
  const id = post.externalId || '';
  if (!id) return false;
  if (/^(reddit|quora|twitter)_/i.test(id)) return false;
  if (/^t3_[a-z0-9]+$/i.test(id)) return true;
  if (/^[a-z0-9]{5,10}$/i.test(id)) return true;
  return !id.includes('_');
}

function summarizeEngageability(posts) {
  const platformCounts = {};
  let engageable = 0;
  let viewOnly = 0;
  for (const p of posts || []) {
    const plat = p.platform || 'Other';
    platformCounts[plat] = (platformCounts[plat] || 0) + 1;
    if (isEngageablePost(p)) engageable += 1;
    else viewOnly += 1;
  }
  return { engageable, viewOnly, platformCounts, total: (posts || []).length };
}

module.exports = { isEngageablePost, summarizeEngageability };