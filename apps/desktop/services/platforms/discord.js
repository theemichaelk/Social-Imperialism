const axios = require('axios');

async function discoverGuilds(accessToken) {
  if (!accessToken) return [];
  try {
    const res = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return (res.data || []).map((g) => ({
      platform: 'Discord',
      handle: `${g.name} (Server)`,
      type: 'Server',
      id: g.id,
      accessToken,
    }));
  } catch (e) {
    console.error('Discord guild discovery error:', e.message);
    return [];
  }
}

async function discoverAccounts(accessToken, botToken, username) {
  const accounts = [];

  if (accessToken) {
    try {
      const res = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const d = res.data;
      accounts.push({
        platform: 'Discord',
        handle: d.global_name || d.username || username,
        type: 'Profile',
        id: d.id,
        accessToken,
      });
      accounts.push(...await discoverGuilds(accessToken));
    } catch (e) {
      console.error('Discord user error:', e.message);
    }
  }

  if (botToken) {
    try {
      const res = await axios.get('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${botToken}` },
      });
      const d = res.data;
      accounts.push({
        platform: 'Discord',
        handle: d.global_name || d.username || 'Discord Bot',
        type: 'Bot',
        id: d.id || `dc_bot_${Date.now()}`,
        accessToken: botToken,
      });
    } catch (e) {
      console.error('Discord bot error:', e.message);
      accounts.push({ platform: 'Discord', handle: 'Bot Application', type: 'Bot', id: `dc_bot_${Date.now()}`, accessToken: botToken });
    }
  }

  if (accounts.length) return accounts;
  return [{ platform: 'Discord', handle: username || 'Discord User', type: 'Profile', id: `dc_${Date.now()}` }];
}

async function getProfile(accessToken) {
  if (!accessToken) return null;
  try {
    const res = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return {
      followers: 'N/A',
      likes: 'N/A',
      bestTime: 'Server peak hours vary',
      topTrendingNiche: 'Server-specific',
      growthVelocity: 'Track server analytics',
      suggestedGroups: ['Discord servers in your niche'],
      raw: res.data,
    };
  } catch (e) {
    return null;
  }
}

async function publishToGuild(postData, botToken, channelId) {
  if (!botToken) throw new Error('Discord bot token required to post to server channels');
  if (!channelId) throw new Error('Discord channel ID required');

  const res = await axios.post(
    `https://discord.com/api/channels/${channelId}/messages`,
    { content: postData.content },
    { headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' } }
  );
  return res.data;
}

module.exports = { discoverAccounts, discoverGuilds, getProfile, publishToGuild };