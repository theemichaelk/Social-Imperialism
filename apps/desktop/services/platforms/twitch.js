const axios = require('axios');

const HELIX = 'https://api.twitch.tv/helix';

function helixHeaders(accessToken, clientId) {
  const headers = { 'Client-Id': clientId };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

async function getProfile(accessToken, clientId) {
  if (!accessToken || !clientId) return null;
  try {
    const res = await axios.get(`${HELIX}/users`, {
      headers: helixHeaders(accessToken, clientId),
    });
    const u = res.data?.data?.[0];
    if (!u) return null;
    return {
      followers: 'See Twitch Analytics',
      likes: 'N/A',
      bestTime: 'Peak streaming hours vary by category',
      topTrendingNiche: u.broadcaster_type || 'Streamer',
      growthVelocity: u.type || 'channel',
      suggestedGroups: ['Twitch categories in your niche'],
      raw: u,
    };
  } catch (e) {
    console.error('Twitch profile error:', e.message);
    return null;
  }
}

async function discoverChannel(accessToken, clientId, broadcasterId) {
  if (!accessToken || !clientId || !broadcasterId) return null;
  try {
    const res = await axios.get(`${HELIX}/channels`, {
      headers: helixHeaders(accessToken, clientId),
      params: { broadcaster_id: broadcasterId },
    });
    const ch = res.data?.data?.[0];
    if (!ch) return null;
    return {
      platform: 'Twitch',
      handle: `${ch.game_name || 'Live'} (Category)`,
      type: 'Category',
      id: ch.game_id || `tw_cat_${broadcasterId}`,
      gameId: ch.game_id,
      gameName: ch.game_name,
    };
  } catch (e) {
    console.error('Twitch channel error:', e.message);
    return null;
  }
}

async function discoverAccounts(accessToken, clientId, username, streamKey) {
  const accounts = [];
  if (!accessToken || !clientId) {
    throw new Error('Twitch requires Client ID and access token. Add credentials in Settings > API Integrations.');
  }

  const profile = await getProfile(accessToken, clientId);
  if (profile?.raw) {
    const u = profile.raw;
    accounts.push({
      platform: 'Twitch',
      handle: u.display_name || u.login || username || 'Twitch Channel',
      type: 'Channel',
      id: u.id,
      login: u.login,
      accessToken,
    });

    const category = await discoverChannel(accessToken, clientId, u.id);
    if (category) accounts.push({ ...category, loginEmail: username });
  }

  if (streamKey) {
    accounts.push({
      platform: 'Twitch',
      handle: 'RTMP Stream Key',
      type: 'StreamKey',
      id: `tw_stream_${Date.now()}`,
      streamKey,
    });
  }

  if (accounts.length) return accounts;
  return [{
    platform: 'Twitch',
    handle: username || 'Twitch Channel',
    type: 'Channel',
    id: `tw_${Date.now()}`,
    accessToken,
  }];
}

module.exports = { getProfile, discoverAccounts, discoverChannel, helixHeaders };