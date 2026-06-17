const axios = require('axios');

const API_BASE = 'https://open.tiktokapis.com';

async function getProfile(accessToken) {
  if (!accessToken) return null;
  try {
    const res = await axios.get(`${API_BASE}/v2/user/info/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { fields: 'open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count' },
    });
    const u = res.data?.data?.user || {};
    return {
      followers: String(u.follower_count || 0),
      likes: String(u.likes_count || 0),
      bestTime: 'Check TikTok Analytics for peak hours',
      topTrendingNiche: 'Creator niche trends',
      growthVelocity: `${u.video_count || 0} videos published`,
      suggestedGroups: ['TikTok Creator Community'],
      raw: u,
    };
  } catch (e) {
    console.error('TikTok profile error:', e.message);
    return null;
  }
}

async function discoverAccounts(accessToken, username) {
  if (accessToken) {
    const profile = await getProfile(accessToken);
    if (profile?.raw) {
      return [{
        platform: 'TikTok',
        handle: profile.raw.display_name || username || '@tiktok',
        type: 'Profile',
        id: profile.raw.open_id || `tt_${Date.now()}`,
        accessToken,
      }];
    }
  }
  return [{ platform: 'TikTok', handle: username || '@tiktok', type: 'Profile', id: `tt_${Date.now()}` }];
}

async function publish(postData, accessToken) {
  if (!accessToken) throw new Error('TikTok access token required. Link account via OAuth first.');

  const title = postData.content || postData.title || 'Posted via Social Imperialism';
  const privacyLevel = postData.privacyLevel || 'PUBLIC_TO_EVERYONE';

  if (postData.mediaUrl && (postData.hasMedia || postData.mediaUrl.match(/\.(mp4|mov|webm)/i))) {
    const videoRes = await axios.get(postData.mediaUrl, { responseType: 'arraybuffer', timeout: 120000 });
    const videoSize = videoRes.data.byteLength;

    const initRes = await axios.post(
      `${API_BASE}/v2/post/publish/video/init/`,
      {
        post_info: {
          title: title.substring(0, 150),
          privacy_level: privacyLevel,
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: videoSize,
          total_chunk_count: 1,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      }
    );

    const publishId = initRes.data?.data?.publish_id;
    const uploadUrl = initRes.data?.data?.upload_url;
    if (!publishId || !uploadUrl) {
      throw new Error('TikTok video init failed: ' + JSON.stringify(initRes.data));
    }

    await axios.put(uploadUrl, videoRes.data, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const statusRes = await axios.post(
      `${API_BASE}/v2/post/publish/status/fetch/`,
      { publish_id: publishId },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      }
    );

    return { publishId, status: statusRes.data?.data?.status || 'PROCESSING' };
  }

  const initRes = await axios.post(
    `${API_BASE}/v2/post/publish/content/init/`,
    {
      post_info: {
        title: title.substring(0, 150),
        description: title,
        privacy_level: privacyLevel,
        disable_comment: false,
      },
      source_info: { source: 'PULL_FROM_URL', photo_images: [], photo_cover_index: 0 },
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO',
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
    }
  );

  return initRes.data?.data || initRes.data;
}

module.exports = { getProfile, discoverAccounts, publish };