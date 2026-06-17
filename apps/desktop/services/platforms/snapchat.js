const axios = require('axios');

async function getProfile(accessToken) {
  if (!accessToken) return null;
  try {
    const res = await axios.get('https://kit.snapchat.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const d = res.data?.data?.me || res.data || {};
    return {
      followers: 'See Snapchat Insights',
      likes: 'N/A',
      bestTime: 'Peak hours vary by audience',
      topTrendingNiche: 'Snapchat Spotlight trends',
      growthVelocity: 'Track in Snapchat Insights',
      suggestedGroups: ['Spotlight', 'Public Stories'],
      raw: d,
    };
  } catch (e) {
    console.error('Snapchat profile error:', e.message);
    return {
      followers: 'Connected',
      likes: 'N/A',
      bestTime: 'Varies',
      topTrendingNiche: 'Snapchat',
      growthVelocity: '—',
      suggestedGroups: [],
      raw: { display_name: 'Snapchat User' },
    };
  }
}

async function discoverAccounts(accessToken, username) {
  if (accessToken) {
    const profile = await getProfile(accessToken);
    const name = profile?.raw?.display_name || profile?.raw?.displayName || username || 'Snapchat User';
    return [{
      platform: 'Snapchat',
      handle: name,
      type: 'Profile',
      id: profile?.raw?.external_id || profile?.raw?.id || `sc_${Date.now()}`,
      accessToken,
    }];
  }
  return [{ platform: 'Snapchat', handle: username || 'Snapchat User', type: 'Profile', id: `sc_${Date.now()}` }];
}

module.exports = { getProfile, discoverAccounts };