/**
 * Upload profile kit assets to linked accounts via platform APIs.
 */
const axios = require('axios');
const { TwitterApi } = require('twitter-api-v2');
const { parseTokens } = require('./intelligenceProfile');
const { fetchImageBuffer } = require('./mediaHelpers');
const youtube = require('./platforms/youtube');

const GRAPH = 'https://graph.facebook.com/v19.0';

function normalizePlatform(p) {
  const map = {
    X: 'Twitter',
    'Twitter / X': 'Twitter',
    'Facebook Page': 'Facebook',
    'Facebook Fanpage': 'Facebook',
    'LinkedIn Page': 'LinkedIn',
  };
  return map[p] || p;
}

function resolveMappedAccount(accountMap, platform, linkedAccounts) {
  const raw = accountMap?.[platform] ?? accountMap?.[normalizePlatform(platform)];
  if (!raw) return null;
  if (typeof raw === 'string') {
    return linkedAccounts.find((a) => a.id === raw) || null;
  }
  if (raw?.id) {
    return linkedAccounts.find((a) => a.id === raw.id) || raw;
  }
  return raw;
}

function getTwitterClient(keys, accessToken) {
  if (accessToken) return new TwitterApi(accessToken);
  if (keys.twAccess && keys.twAccessSecret && keys.twId && keys.twSecret) {
    return new TwitterApi({
      appKey: keys.twId,
      appSecret: keys.twSecret,
      accessToken: keys.twAccess,
      accessSecret: keys.twAccessSecret,
    });
  }
  return null;
}

async function uploadTwitter(kit, keys, account) {
  const tokens = parseTokens(account);
  const client = getTwitterClient(keys, tokens?.access_token);
  if (!client) throw new Error('Twitter credentials not available for this account.');

  const results = [];
  const identity = kit.identity || {};
  const bio = identity.bios?.Twitter || identity.tagline || '';

  try {
    await client.v1.updateAccountProfile({
      name: identity.displayName || kit.name,
      description: bio.slice(0, 160),
      url: identity.website || undefined,
    });
    results.push({ field: 'profile', success: true });
  } catch (e) {
    results.push({ field: 'profile', success: false, error: e.message });
  }

  const profileUrl = kit.assets?.profilePic?.url;
  if (profileUrl) {
    try {
      const { buffer, mimeType } = await fetchImageBuffer(profileUrl);
      await client.v1.updateAccountProfileImage(buffer, { mimeType });
      results.push({ field: 'avatar', success: true });
    } catch (e) {
      results.push({ field: 'avatar', success: false, error: e.message });
    }
  }

  const bannerUrl = kit.assets?.covers?.Twitter?.imageUrl || kit.assets?.banners?.Twitter?.imageUrl;
  if (bannerUrl) {
    try {
      const { buffer, mimeType } = await fetchImageBuffer(bannerUrl);
      await client.v1.updateAccountProfileBanner(buffer, { mimeType });
      results.push({ field: 'banner', success: true });
    } catch (e) {
      results.push({ field: 'banner', success: false, error: e.message });
    }
  }

  return results;
}

async function uploadMeta(kit, keys, account) {
  const tokens = parseTokens(account);
  const accessToken = tokens?.access_token || keys.metaAccess;
  if (!accessToken) throw new Error('Meta access token required.');

  const results = [];
  const identity = kit.identity || {};
  const targetId = account.type === 'Page' ? account.id : 'me';
  const token = account.type === 'Page' && account.accessToken ? account.accessToken : accessToken;

  const profileUrl = kit.assets?.profilePic?.url;
  if (profileUrl) {
    try {
      await axios.post(`${GRAPH}/${targetId}/picture`, null, {
        params: { url: profileUrl, access_token: token },
      });
      results.push({ field: 'avatar', success: true });
    } catch (e) {
      results.push({ field: 'avatar', success: false, error: e.message });
    }
  }

  const coverUrl = kit.assets?.covers?.Facebook?.imageUrl;
  if (coverUrl && account.type === 'Page') {
    try {
      let uploaded = false;
      try {
        const FormData = require('form-data');
        const { buffer } = await fetchImageBuffer(coverUrl);
        const form = new FormData();
        form.append('source', buffer, { filename: 'cover.jpg', contentType: 'image/jpeg' });
        form.append('access_token', token);
        await axios.post(`${GRAPH}/${account.id}/cover`, form, { headers: form.getHeaders() });
        uploaded = true;
      } catch (formErr) {
        await axios.post(`${GRAPH}/${account.id}`, null, {
          params: { cover: coverUrl, access_token: token },
        });
        uploaded = true;
      }
      if (uploaded) results.push({ field: 'cover', success: true });
    } catch (e) {
      results.push({ field: 'cover', success: false, error: e.message });
    }
  }

  const bio = identity.bios?.Facebook || identity.longDescription;
  if (bio && targetId === 'me') {
    try {
      await axios.post(`${GRAPH}/me`, null, {
        params: { bio: bio.slice(0, 500), access_token: token },
      });
      results.push({ field: 'bio', success: true });
    } catch (e) {
      results.push({ field: 'bio', success: false, error: e.message });
    }
  }

  return results;
}

async function uploadLinkedIn(kit, keys, account) {
  const tokens = parseTokens(account);
  const accessToken = tokens?.access_token || keys.linkedinAccessToken;
  if (!accessToken) throw new Error('LinkedIn access token required.');

  const results = [];
  const profileUrl = kit.assets?.profilePic?.url;
  if (!profileUrl) return [{ field: 'avatar', success: false, error: 'No profile image in kit.' }];

  try {
    const { buffer, mimeType } = await fetchImageBuffer(profileUrl);
    const initRes = await axios.post(
      'https://api.linkedin.com/v2/images?action=initializeUpload',
      { initializeUploadRequest: { owner: `urn:li:person:${account.id}` } },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      },
    ).catch(async () => {
      const me = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const personUrn = `urn:li:person:${me.data.sub}`;
      return axios.post(
        'https://api.linkedin.com/v2/images?action=initializeUpload',
        { initializeUploadRequest: { owner: personUrn } },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        },
      );
    });

    const uploadUrl = initRes.data?.value?.uploadUrl;
    const imageUrn = initRes.data?.value?.image;
    if (!uploadUrl) throw new Error('LinkedIn image upload init failed.');

    await axios.put(uploadUrl, buffer, {
      headers: { 'Content-Type': mimeType },
      maxBodyLength: Infinity,
    });

    await axios.post(
      'https://api.linkedin.com/v2/me?projection=(id,profilePicture(displayImage~:playableStreams))',
      {
        patch: {
          $set: { profilePicture: { displayImage: imageUrn } },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      },
    ).catch(() => null);

    results.push({ field: 'avatar', success: true, imageUrn });
  } catch (e) {
    results.push({ field: 'avatar', success: false, error: e.message });
  }

  return results;
}

async function uploadYouTube(kit, keys, account) {
  const tokens = parseTokens(account);
  const accessToken = tokens?.access_token;
  if (!accessToken) throw new Error('YouTube OAuth token required on linked account.');

  const results = [];
  const channelId = account.id && !String(account.id).startsWith('yt_') ? account.id : null;
  const identity = kit.identity || {};

  if (identity.bios?.YouTube || identity.longDescription) {
    try {
      await youtube.updateChannelMetadata(accessToken, channelId, {
        title: identity.youtube?.channelName || identity.displayName,
        description: identity.bios?.YouTube || identity.longDescription,
      });
      results.push({ field: 'description', success: true });
    } catch (e) {
      results.push({ field: 'description', success: false, error: e.message });
    }
  }

  const bannerUrl = kit.assets?.covers?.YouTube?.imageUrl || kit.assets?.banners?.YouTube?.imageUrl;
  if (bannerUrl) {
    try {
      await youtube.updateChannelBanner(accessToken, channelId, bannerUrl);
      results.push({ field: 'banner', success: true });
    } catch (e) {
      results.push({ field: 'banner', success: false, error: e.message });
    }
  }

  return results;
}

async function uploadKitToLinkedAccounts(store, kit, keys, options = {}) {
  const campaignId = kit.campaignId || store.getItem('activeCampaignId') || 'default';
  const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${campaignId}`) || '[]');
  const accountMap = options.accountMap || kit.accountMap || {};
  const platforms = options.platforms || kit.platforms || [];

  const summary = [];

  for (const platform of platforms) {
    const norm = normalizePlatform(platform);
    const account = resolveMappedAccount(accountMap, platform, linkedAccounts)
      || linkedAccounts.find((a) => normalizePlatform(a.platform) === norm && a.status === 'connected')
      || linkedAccounts.find((a) => normalizePlatform(a.platform) === norm);

    if (!account) {
      summary.push({ platform, success: false, error: 'No linked account found — connect in Linked Accounts first.' });
      continue;
    }

    try {
      let results = [];
      if (norm === 'Twitter') results = await uploadTwitter(kit, keys, account);
      else if (norm === 'Facebook' || norm === 'Instagram') results = await uploadMeta(kit, keys, account);
      else if (norm === 'LinkedIn') results = await uploadLinkedIn(kit, keys, account);
      else if (norm === 'YouTube') results = await uploadYouTube(kit, keys, account);
      else {
        summary.push({ platform, success: false, error: `API upload not yet supported for ${platform}. Use browser automation.` });
        continue;
      }
      summary.push({ platform, accountId: account.id, handle: account.handle, success: true, results });
    } catch (e) {
      summary.push({ platform, accountId: account.id, success: false, error: e.message });
    }
  }

  return summary;
}

module.exports = { uploadKitToLinkedAccounts, normalizePlatform, resolveMappedAccount };