const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

const API = 'https://www.googleapis.com/youtube/v3';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function isGoogleApiKey(value) {
  return value && String(value).trim().startsWith('AIza');
}

function isPlaceholderChannelId(id) {
  return !id || String(id).startsWith('yt_');
}

function mapOAuthChannel(ch, accessToken) {
  const customUrl = ch.snippet?.customUrl ? `@${String(ch.snippet.customUrl).replace(/^@/, '')}` : null;
  const title = ch.snippet?.title || 'YouTube Channel';
  return {
    platform: 'YouTube',
    handle: customUrl ? `${title} (${customUrl})` : `${title} (Channel)`,
    type: 'Channel',
    id: ch.id,
    accessToken,
    customUrl,
    subscriberCount: ch.statistics?.subscriberCount || null,
    videoCount: ch.statistics?.videoCount || null,
  };
}

function normalizeSearchTerms(username, email) {
  const terms = [];
  const user = (username || '').trim();
  const em = (email || '').trim();

  if (user) {
    terms.push(user.replace(/^@/, ''));
    if (user.startsWith('@')) terms.push(user);
  }
  if (em && em.includes('@')) {
    const local = em.split('@')[0];
    if (local && local.length > 2) terms.push(local);
  }
  if (em && !em.includes('@') && em.length > 2) terms.push(em);

  return [...new Set(terms.filter(Boolean))];
}

function mapChannelItem(item, accessToken, apiKey) {
  const id = item.id?.channelId || item.id;
  const title = item.snippet?.title || 'YouTube Channel';
  return {
    platform: 'YouTube',
    handle: `${title} (Channel)`,
    type: 'Channel',
    id: id || `yt_${Date.now()}`,
    accessToken: accessToken || null,
    apiKey: apiKey || null,
  };
}

async function fetchChannelPages(accessToken, baseParams) {
  const items = [];
  let pageToken = null;

  do {
    const res = await axios.get(`${API}/channels`, {
      params: {
        part: 'snippet,statistics,contentDetails,brandingSettings',
        maxResults: 50,
        pageToken: pageToken || undefined,
        ...baseParams,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    items.push(...(res.data?.items || []));
    pageToken = res.data?.nextPageToken || null;
  } while (pageToken);

  return items;
}

async function resolveChannelIdFromHandle(handle) {
  const h = (handle || '').replace(/^@/, '').trim();
  if (!h) return null;

  const urls = [
    `https://www.youtube.com/@${h}`,
    `https://www.youtube.com/c/${h}`,
    `https://www.youtube.com/user/${h}`,
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': UA },
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
        timeout: 12000,
      });
      if (res.status >= 400) continue;
      const html = String(res.data || '');
      const patterns = [
        /"channelId":"(UC[\w-]{22})"/,
        /"externalId":"(UC[\w-]{22})"/,
        /youtube\.com\/channel\/(UC[\w-]{22})/,
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return match[1];
      }
    } catch (e) {
      console.error(`YouTube handle resolve error (${url}):`, e.message);
    }
  }
  return null;
}

async function discoverByChannelId(apiKey, channelId, accessToken = null) {
  if (!channelId || isPlaceholderChannelId(channelId)) return [];
  try {
    const params = { part: 'snippet,statistics', id: channelId };
    const headers = {};
    if (apiKey) {
      params.key = apiKey;
    } else if (accessToken && !isGoogleApiKey(accessToken)) {
      headers.Authorization = `Bearer ${accessToken}`;
    } else {
      return [];
    }
    const res = await axios.get(`${API}/channels`, { params, headers });
    return (res.data?.items || []).map((ch) => ({
      platform: 'YouTube',
      handle: `${ch.snippet?.title || 'Channel'} (Channel)`,
      type: 'Channel',
      id: ch.id,
      accessToken: accessToken || null,
      apiKey: apiKey || null,
    }));
  } catch (e) {
    console.error('YouTube channels (by id) error:', e.message);
    return [];
  }
}

function extractChannelIdsFromPayload(payload, found = new Map()) {
  if (!payload || typeof payload !== 'object') return found;
  if (Array.isArray(payload)) {
    payload.forEach((item) => extractChannelIdsFromPayload(item, found));
    return found;
  }
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' && /^UC[\w-]{22}$/.test(value)) {
      const name = payload.title || payload.name || payload.channelName || payload.simpleText || key;
      if (!found.has(value)) found.set(value, String(name || 'YouTube Channel'));
    }
    if (value && typeof value === 'object') extractChannelIdsFromPayload(value, found);
  }
  return found;
}

async function discoverViaYouTubeInnerTube(accessToken) {
  const channels = [];
  const endpoints = [
    'https://www.youtube.com/youtubei/v1/account/get_account_switcher_endpoint',
    'https://www.youtube.com/youtubei/v1/account/account_menu',
  ];
  const body = {
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20250312.01.00',
        hl: 'en',
        gl: 'US',
      },
    },
  };

  for (const url of endpoints) {
    try {
      const res = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Origin: 'https://www.youtube.com',
          'X-Goog-AuthUser': '0',
        },
        validateStatus: () => true,
      });
      if (res.status >= 400) continue;
      const ids = extractChannelIdsFromPayload(res.data);
      for (const [id, name] of ids.entries()) {
        channels.push({
          platform: 'YouTube',
          handle: `${name} (Channel)`,
          type: 'Channel',
          id,
          accessToken,
        });
      }
    } catch (e) {
      console.error(`YouTube innerTube (${url}) error:`, e.message);
    }
  }
  return channels;
}

async function discoverByOAuth(accessToken) {
  const seen = new Set();
  const channels = [];
  let authenticated = false;

  const queries = [
    { mine: true },
    { managedByMe: true },
  ];

  for (const query of queries) {
    try {
      const items = await fetchChannelPages(accessToken, query);
      authenticated = true;
      for (const ch of items) {
        if (!ch?.id || seen.has(ch.id)) continue;
        seen.add(ch.id);
        channels.push(mapOAuthChannel(ch, accessToken));
      }
    } catch (e) {
      const status = e.response?.status;
      if (status === 401 || status === 403) {
        console.error(`YouTube channels (${JSON.stringify(query)}) error:`, e.message);
        if (query.mine) return { authenticated: false, channels: [] };
        continue;
      }
      console.error(`YouTube channels (${JSON.stringify(query)}) error:`, e.message);
    }
  }

  const innerTubeChannels = await discoverViaYouTubeInnerTube(accessToken);
  for (const ch of innerTubeChannels) {
    if (!ch?.id || seen.has(ch.id)) continue;
    seen.add(ch.id);
    channels.push(ch);
  }

  return { authenticated, channels };
}

async function discoverByApiSearch(apiKey, searchTerms) {
  const found = [];
  const seen = new Set();

  for (const term of searchTerms) {
    if (!term) continue;
    try {
      const res = await axios.get(`${API}/search`, {
        params: { part: 'snippet', q: term, type: 'channel', maxResults: 5, key: apiKey },
      });
      for (const item of res.data?.items || []) {
        const mapped = mapChannelItem(item, null, apiKey);
        if (mapped.id && !seen.has(mapped.id) && !isPlaceholderChannelId(mapped.id)) {
          seen.add(mapped.id);
          found.push(mapped);
        }
      }
      if (found.length) break;
    } catch (e) {
      console.error(`YouTube search error (${term}):`, e.message);
    }
  }

  return found;
}

async function discoverByHandle(apiKey, handle, accessToken = null) {
  const h = (handle || '').replace(/^@/, '').trim();
  if (!h) return [];

  if (apiKey) {
    try {
      const res = await axios.get(`${API}/channels`, {
        params: { part: 'snippet,statistics', forHandle: h, key: apiKey },
      });
      const items = res.data?.items || [];
      if (items.length) {
        return items.map((ch) => ({
          platform: 'YouTube',
          handle: `${ch.snippet?.title || h} (Channel)`,
          type: 'Channel',
          id: ch.id,
          accessToken: accessToken || null,
          apiKey,
        }));
      }
    } catch (e) {
      console.error('YouTube forHandle error:', e.message);
    }
  }

  const channelId = await resolveChannelIdFromHandle(h);
  if (channelId) {
    const byId = await discoverByChannelId(apiKey, channelId, accessToken);
    if (byId.length) return byId;
  }

  return [];
}

async function discoverChannels(accessToken, apiKey, username, loginEmail) {
  const bearer = accessToken && !isGoogleApiKey(accessToken) ? accessToken : null;
  const key = apiKey || (isGoogleApiKey(accessToken) ? accessToken : null);
  const searchTerms = normalizeSearchTerms(username, loginEmail || username);
  let oauthWasAuthenticated = false;

  if (bearer) {
    const oauthResult = await discoverByOAuth(bearer);
    oauthWasAuthenticated = oauthResult.authenticated;
    if (oauthResult.channels.length) return oauthResult.channels;
  }

  const handleTerm = searchTerms.find((t) => t.length >= 3);
  if (handleTerm) {
    const byHandle = await discoverByHandle(key, handleTerm, null);
    if (byHandle.length) return byHandle;
  }

  if (key) {
    const bySearch = await discoverByApiSearch(key, searchTerms);
    if (bySearch.length) return bySearch;
  }

  if (oauthWasAuthenticated) {
    throw new Error(
      'Google sign-in succeeded but no YouTube channels were found on this account. Create a channel at youtube.com, then connect again.',
    );
  }

  const handleHint = handleTerm ? `@${handleTerm.replace(/^@/, '')}` : 'your @YouTube handle';
  throw new Error(
    `No YouTube channel found for ${handleHint}. Enter your Google email + password to sign in and pull all channels on your account.`,
  );
}

async function getProfile(accessToken, apiKey, channelId) {
  try {
    const params = { part: 'statistics,snippet' };
    const headers = {};

    if (apiKey && channelId && !isPlaceholderChannelId(channelId)) {
      params.id = channelId;
      params.key = apiKey;
    } else if (accessToken && !isGoogleApiKey(accessToken)) {
      if (!isPlaceholderChannelId(channelId)) {
        params.id = channelId;
      } else {
        params.mine = true;
      }
      headers.Authorization = `Bearer ${accessToken}`;
    } else if (isGoogleApiKey(accessToken) && channelId && !isPlaceholderChannelId(channelId)) {
      params.id = channelId;
      params.key = accessToken;
    } else {
      return null;
    }

    const res = await axios.get(`${API}/channels`, { params, headers });
    const ch = res.data?.items?.[0];
    if (!ch) return null;

    const stats = ch.statistics || {};
    return {
      followers: stats.subscriberCount || '0',
      likes: stats.viewCount || '0',
      bestTime: 'Analyze via YouTube Studio',
      topTrendingNiche: ch.snippet?.categoryId || 'General',
      growthVelocity: `${stats.videoCount || 0} videos published`,
      suggestedGroups: ['YouTube Community posts'],
      raw: ch,
    };
  } catch (e) {
    console.error('YouTube profile error:', e.message);
    return null;
  }
}

function writeVideoToTemp(mediaUrl) {
  if (!mediaUrl) throw new Error('No video data provided.');
  if (fs.existsSync(mediaUrl)) return mediaUrl;

  let buffer;
  if (mediaUrl.startsWith('data:')) {
    const b64 = mediaUrl.split(',')[1];
    buffer = Buffer.from(b64, 'base64');
  } else if (mediaUrl.length > 500 && !mediaUrl.startsWith('http')) {
    buffer = Buffer.from(mediaUrl, 'base64');
  } else if (mediaUrl.startsWith('http')) {
    return null;
  } else {
    throw new Error('Unsupported video format — upload MP4/MOV from Content Hub.');
  }

  const filePath = path.join(os.tmpdir(), `si_yt_upload_${Date.now()}.mp4`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

async function uploadVideo(postData, accessToken, channelId = null) {
  if (!accessToken) throw new Error('YouTube OAuth access token required for video upload.');

  const localPath = writeVideoToTemp(postData.videoPath || postData.mediaUrl);
  if (!localPath) {
    throw new Error('YouTube upload requires a local video file. Paste watch URLs are for link posts only.');
  }

  const fileSize = fs.statSync(localPath).size;
  const title = postData.title || (postData.content || 'Upload').slice(0, 100);
  const description = postData.content || '';

  const initRes = await axios.post(
    'https://www.googleapis.com/upload/youtube/v3/videos',
    {
      snippet: { title, description, categoryId: '22' },
      status: { privacyStatus: postData.privacy || 'public', selfDeclaredMadeForKids: false },
    },
    {
      params: { uploadType: 'resumable', part: 'snippet,status' },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': fileSize,
      },
      maxBodyLength: Infinity,
    },
  );

  const uploadUrl = initRes.headers.location;
  if (!uploadUrl) throw new Error('YouTube resumable upload URL not returned.');

  const videoBuffer = fs.readFileSync(localPath);
  const uploadRes = await axios.put(uploadUrl, videoBuffer, {
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': fileSize },
    maxBodyLength: Infinity,
    timeout: 600000,
  });

  try { if (localPath.includes('si_yt_upload_')) fs.unlinkSync(localPath); } catch (e) { /* ignore */ }

  return {
    success: true,
    videoId: uploadRes.data?.id,
    url: uploadRes.data?.id ? `https://www.youtube.com/watch?v=${uploadRes.data.id}` : null,
    raw: uploadRes.data,
  };
}

async function updateChannelMetadata(accessToken, channelId, { title, description }) {
  const params = { part: 'snippet' };
  const headers = { Authorization: `Bearer ${accessToken}` };
  const body = { id: channelId, snippet: {} };

  if (channelId) {
    body.id = channelId;
  } else {
    params.mine = true;
    delete body.id;
  }

  if (title) body.snippet.title = title;
  if (description) body.snippet.description = description;

  const res = await axios.put(`${API}/channels`, body, { params, headers });
  return res.data;
}

async function updateChannelBanner(accessToken, channelId, bannerUrl) {
  const imageRes = await axios.get(bannerUrl, { responseType: 'arraybuffer', timeout: 60000 });
  const params = { part: 'brandingSettings' };
  const headers = { Authorization: `Bearer ${accessToken}` };

  const body = {
    brandingSettings: {
      image: {
        bannerExternalUrl: bannerUrl,
      },
    },
  };

  if (channelId && !isPlaceholderChannelId(channelId)) {
    body.id = channelId;
  } else {
    params.mine = true;
  }

  try {
    const res = await axios.put(`${API}/channels`, body, { params, headers });
    return res.data;
  } catch (e) {
    const b64 = Buffer.from(imageRes.data).toString('base64');
    const fallbackBody = {
      ...body,
      brandingSettings: {
        image: {
          bannerExternalUrl: `data:image/jpeg;base64,${b64}`,
        },
      },
    };
    const res = await axios.put(`${API}/channels`, fallbackBody, { params, headers });
    return res.data;
  }
}

async function publish(postData, accessToken, channelId = null) {
  if (postData.isVideo) {
    return uploadVideo(postData, accessToken, channelId);
  }

  if (postData.mediaUrl?.includes('youtube.com') || postData.mediaUrl?.includes('youtu.be')) {
    return {
      success: true,
      simulated: false,
      type: 'youtube_link',
      url: postData.mediaUrl,
      message: 'YouTube link noted — upload local MP4 for native video posts, or share link via Community tab.',
    };
  }

  throw new Error('YouTube publishing requires a video file (isVideo: true) or a YouTube URL.');
}

module.exports = {
  discoverChannels,
  getProfile,
  isGoogleApiKey,
  resolveChannelIdFromHandle,
  discoverByOAuth,
  publish,
  uploadVideo,
  updateChannelMetadata,
  updateChannelBanner,
};