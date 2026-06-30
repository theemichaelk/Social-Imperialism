/**
 * Phase 1 deep probes — live read validation per platform (Tier 1).
 */
const axios = require('axios');

function parseEntityData(entityData) {
  if (!entityData) return {};
  return typeof entityData === 'string' ? JSON.parse(entityData) : entityData;
}

function getAccessToken(account, keys) {
  if (account?.oauthTokens?.access_token) return account.oauthTokens.access_token;
  if (account?.accessToken) return account.accessToken;
  if (account?.encryptedTokens) {
    try {
      const raw = Buffer.from(account.encryptedTokens, 'base64').toString('utf8');
      const parsed = JSON.parse(raw);
      return parsed.access_token || parsed.tokens?.access_token || parsed.accessToken;
    } catch { /* ignore */ }
  }
  return keys?.linkedinAccessToken || keys?.metaAccess || keys?.twBearer
    || keys?.redditAccessToken || keys?.twAccess || null;
}

function ok(httpStatus, meta = {}) {
  return { ok: true, httpStatus: httpStatus || 200, meta };
}

function fail(httpStatus, error, meta = {}) {
  return { ok: false, httpStatus: httpStatus || 0, error, meta };
}

async function httpGet(url, config = {}) {
  const res = await axios.get(url, { validateStatus: () => true, timeout: 20000, ...config });
  return res;
}

const PROBES = {
  async Facebook(node, entity, keys, account) {
    const token = getAccessToken(account, keys) || keys.metaAccess;
    const pageId = entity.page_id || entity.id || node.externalId;
    if (!token) return fail(401, 'Meta access token required');
    const res = await httpGet(`https://graph.facebook.com/v21.0/${pageId}`, {
      params: { fields: 'id,name,category,fan_count', access_token: token },
    });
    if (res.status !== 200) return fail(res.status, res.data?.error?.message || 'Facebook page probe failed');
    return ok(res.status, { page_id: res.data.id, name: res.data.name, fan_count: res.data.fan_count });
  },

  async Instagram(node, entity, keys, account) {
    const token = getAccessToken(account, keys) || keys.metaAccess;
    const igId = entity.page_id || entity.id || node.externalId;
    if (!token) return fail(401, 'Instagram token required');
    const res = await httpGet(`https://graph.facebook.com/v21.0/${igId}`, {
      params: { fields: 'id,username,followers_count,media_count', access_token: token },
    });
    if (res.status !== 200) return fail(res.status, res.data?.error?.message || 'Instagram probe failed');
    return ok(res.status, { page_id: res.data.id, username: res.data.username, followers: res.data.followers_count });
  },

  async WhatsApp(node, entity, keys, account) {
    const token = getAccessToken(account, keys) || keys.metaAccess;
    const phoneId = entity.phone_number_id;
    if (!token || !phoneId) return fail(400, 'WhatsApp phone_number_id and token required');
    const res = await httpGet(`https://graph.facebook.com/v21.0/${phoneId}`, {
      params: { fields: 'id,display_phone_number,verified_name', access_token: token },
    });
    if (res.status !== 200) return fail(res.status, res.data?.error?.message || 'WhatsApp probe failed');
    return ok(res.status, { phone_number_id: res.data.id, verified_name: res.data.verified_name });
  },

  async Threads(node, entity, keys, account) {
    const token = getAccessToken(account, keys) || keys.metaAccess;
    const userId = entity.pk_id || entity.id || node.externalId;
    if (!token) return fail(401, 'Threads token required');
    const res = await httpGet(`https://graph.threads.net/v1.0/${userId}`, {
      params: { fields: 'id,username,threads_profile_picture_url', access_token: token },
    });
    if (res.status !== 200) return fail(res.status, res.data?.error?.message || 'Threads probe failed');
    return ok(res.status, { pk_id: res.data.id, username: res.data.username });
  },

  async YouTube(node, entity, keys, account) {
    const token = getAccessToken(account, keys);
    const channelId = entity.channel_id || entity.id || node.externalId;
    const params = { part: 'snippet,contentDetails,statistics', id: channelId };
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    if (!token) params.key = keys.youtubeApiKey;
    if (!token && !params.key) return fail(401, 'YouTube OAuth or API key required');
    const res = await httpGet('https://www.googleapis.com/youtube/v3/channels', { params, headers });
    if (res.status !== 200 || !res.data?.items?.length) {
      return fail(res.status, 'YouTube channels.list returned no items');
    }
    const ch = res.data.items[0];
    return ok(res.status, {
      channel_id: ch.id,
      title: ch.snippet?.title,
      uploads_playlist_id: ch.contentDetails?.relatedPlaylists?.uploads,
    });
  },

  async TikTok(node, entity, keys, account) {
    const token = getAccessToken(account, keys);
    if (!token) return fail(401, 'TikTok access token required');
    const res = await httpGet('https://open.tiktokapis.com/v2/user/info/', {
      headers: { Authorization: `Bearer ${token}` },
      params: { fields: 'open_id,union_id,avatar_url,display_name' },
    });
    if (res.status !== 200) return fail(res.status, res.data?.error?.message || 'TikTok probe failed');
    return ok(res.status, { creator_id: res.data?.data?.user?.open_id, display_name: res.data?.data?.user?.display_name });
  },

  async Snapchat(node, entity, keys, account) {
    const pubId = entity.publisher_id || node.externalId;
    if (!pubId) return fail(400, 'Snapchat publisher_id required');
    const token = getAccessToken(account, keys);
    if (!token && !keys.snapchatClientId) return fail(401, 'Snapchat credentials required');
    return ok(200, { publisher_id: pubId, probe: 'publisher_id_validated', token_present: !!token });
  },

  async Twitter(node, entity, keys, account) {
    const token = getAccessToken(account, keys) || keys.twBearer || keys.twAccess;
    if (!token) return fail(401, 'Twitter/X bearer token required');
    const res = await httpGet('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${token}` },
      params: { 'user.fields': 'public_metrics' },
    });
    if (res.status !== 200) return fail(res.status, res.data?.detail || 'Twitter users/me failed');
    return ok(res.status, { user_id: res.data?.data?.id, username: res.data?.data?.username });
  },

  async LinkedIn(node, entity, keys, account) {
    const token = getAccessToken(account, keys) || keys.linkedinAccessToken;
    if (!token) return fail(401, 'LinkedIn access token required');
    if (node.nodeType === 'Organization' || entity.organization_urn) {
      const res = await httpGet('https://api.linkedin.com/v2/organizationAcls', {
        params: { q: 'roleAssignee', role: 'ADMINISTRATOR' },
        headers: { Authorization: `Bearer ${token}`, 'X-Restli-Protocol-Version': '2.0.0' },
      });
      if (res.status !== 200) return fail(res.status, 'LinkedIn organizationAcls failed');
      return ok(res.status, { org_count: (res.data?.elements || []).length });
    }
    const res = await httpGet('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200) return fail(res.status, 'LinkedIn me failed');
    return ok(res.status, { person_urn: res.data?.sub });
  },

  async Reddit(node, entity, keys, account) {
    const token = getAccessToken(account, keys) || keys.redditAccessToken;
    if (!token) return fail(401, 'Reddit access token required');
    if (node.nodeType === 'Subreddit') {
      const sub = entity.subreddit_id || entity.name || node.externalId;
      const res = await httpGet(`https://oauth.reddit.com/r/${sub}/about`, {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'SocialImperialism/1.0' },
      });
      if (res.status !== 200) return fail(res.status, 'Reddit subreddit probe failed');
      return ok(res.status, { subreddit_id: res.data?.data?.id, subscribers: res.data?.data?.subscribers });
    }
    const res = await httpGet('https://oauth.reddit.com/api/v1/me', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'SocialImperialism/1.0' },
    });
    if (res.status !== 200) return fail(res.status, 'Reddit me failed');
    return ok(res.status, { reddit_id: res.data?.id, username: res.data?.name });
  },

  async Quora(node, entity, keys, account) {
    const slug = entity.space_slug || entity.profile_slug;
    if (!slug) return fail(400, 'Quora slug required');
    return ok(200, { slug, probe: 'session_slug_validated', session: !!account?.encryptedTokens });
  },

  async Discord(node, entity, keys, account) {
    const token = getAccessToken(account, keys) || keys.discordBotToken;
    if (!token) return fail(401, 'Discord token required');
    if (node.nodeType === 'Channel' && entity.channel_id) {
      const res = await httpGet(`https://discord.com/api/channels/${entity.channel_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status !== 200) return fail(res.status, 'Discord channel probe failed');
      return ok(res.status, { channel_id: res.data.id, send_messages: entity.send_messages !== false });
    }
    const res = await httpGet('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200) return fail(res.status, 'Discord guilds probe failed');
    return ok(res.status, { guild_count: (res.data || []).length });
  },

  async Pinterest(node, entity, keys, account) {
    const token = getAccessToken(account, keys);
    if (!token) return fail(401, 'Pinterest access token required');
    if (entity.board_id) {
      const res = await httpGet(`https://api.pinterest.com/v5/boards/${entity.board_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status !== 200) return fail(res.status, 'Pinterest board probe failed');
      return ok(res.status, { board_id: res.data.id, name: res.data.name });
    }
    const res = await httpGet('https://api.pinterest.com/v5/boards', {
      headers: { Authorization: `Bearer ${token}` },
      params: { page_size: 5 },
    });
    if (res.status !== 200) return fail(res.status, 'Pinterest boards probe failed');
    return ok(res.status, { board_count: (res.data?.items || []).length });
  },

  async Twitch(node, entity, keys, account) {
    const token = getAccessToken(account, keys);
    if (!token) return fail(401, 'Twitch access token required');
    const res = await httpGet('https://api.twitch.tv/helix/users', {
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': keys.twitchClientId || '' },
    });
    if (res.status !== 200) return fail(res.status, 'Twitch helix/users failed');
    const user = res.data?.data?.[0];
    return ok(res.status, { broadcaster_id: user?.id, login: user?.login });
  },

  async Telegram(node, entity, keys, account) {
    const token = getAccessToken(account, keys) || keys.telegramBotToken;
    if (!token) return fail(401, 'Telegram bot token required');
    const res = await httpGet(`https://api.telegram.org/bot${token}/getMe`);
    if (res.status !== 200 || !res.data?.ok) return fail(res.status, 'Telegram getMe failed');
    if (entity.chat_id) {
      const chatRes = await httpGet(`https://api.telegram.org/bot${token}/getChat`, {
        params: { chat_id: entity.chat_id },
      });
      if (!chatRes.data?.ok) return fail(chatRes.status, 'Telegram getChat failed');
      return ok(200, { chat_id: entity.chat_id, bot: res.data.result.username });
    }
    return ok(200, { bot_id: res.data.result.id, username: res.data.result.username });
  },
};

async function runPlatformLiveProbe(platform, node, entityData, keys, account) {
  const entity = parseEntityData(entityData);
  const normalized = platform === 'X' || platform?.includes?.('Twitter') ? 'Twitter' : platform;
  const probe = PROBES[normalized];
  if (!probe) {
    return fail(501, `No live probe for ${platform}`, { fallback: 'schema_only' });
  }
  try {
    return await probe(node, entity, keys || {}, account);
  } catch (e) {
    return fail(0, e.message);
  }
}

module.exports = {
  runPlatformLiveProbe,
  getAccessToken,
  PROBES,
};