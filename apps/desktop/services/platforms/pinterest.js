const axios = require('axios');

const API = 'https://api.pinterest.com/v5';

async function getProfile(accessToken) {
  if (!accessToken) return null;
  try {
    const res = await axios.get(`${API}/user_account`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const d = res.data || {};
    return {
      followers: String(d.follower_count || 0),
      likes: String(d.pin_count || 0),
      bestTime: 'Evenings and weekends perform well on Pinterest',
      topTrendingNiche: d.account_type || 'Creator',
      growthVelocity: `${d.board_count || 0} boards`,
      suggestedGroups: ['Relevant Pinterest boards in your niche'],
      raw: d,
    };
  } catch (e) {
    console.error('Pinterest profile error:', e.message);
    return null;
  }
}

async function discoverBoards(accessToken) {
  if (!accessToken) return [];
  try {
    const res = await axios.get(`${API}/boards`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { page_size: 50 },
    });
    return (res.data?.items || []).map((board) => ({
      platform: 'Pinterest',
      handle: `${board.name} (Board)`,
      type: 'Board',
      id: board.id,
      boardId: board.id,
    }));
  } catch (e) {
    console.error('Pinterest boards error:', e.message);
    return [];
  }
}

async function discoverAccounts(accessToken, username) {
  const accounts = [];
  if (accessToken) {
    const profile = await getProfile(accessToken);
    if (profile?.raw) {
      accounts.push({
        platform: 'Pinterest',
        handle: profile.raw.username || username || 'Pinterest User',
        type: 'Profile',
        id: profile.raw.username || `pin_${Date.now()}`,
      });
    }
    accounts.push(...await discoverBoards(accessToken));
  }
  if (accounts.length) return accounts;
  return [{ platform: 'Pinterest', handle: username || 'Pinterest User', type: 'Profile', id: `pin_${Date.now()}` }];
}

module.exports = { getProfile, discoverAccounts, discoverBoards };