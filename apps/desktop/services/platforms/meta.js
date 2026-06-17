const axios = require('axios');

const GRAPH = 'https://graph.facebook.com/v21.0';

function parseGraphError(err) {
  const data = err?.response?.data?.error;
  if (data) return `${data.message} (code ${data.code}${data.error_subcode ? `/${data.error_subcode}` : ''})`;
  return err?.message || 'Unknown Meta API error';
}

async function graphGet(path, accessToken, params = {}) {
  const res = await axios.get(`${GRAPH}${path}`, {
    params: { ...params, access_token: accessToken },
    timeout: 30000,
  });
  return res.data;
}

async function graphGetAll(path, accessToken, params = {}) {
  const items = [];
  let next = null;
  let guard = 0;
  do {
    const data = next
      ? await axios.get(next, { timeout: 30000 }).then((r) => r.data)
      : await graphGet(path, accessToken, { ...params, limit: 100 });
    items.push(...(data.data || []));
    next = data.paging?.next || null;
    guard += 1;
  } while (next && guard < 20);
  return items;
}

async function exchangeLongLivedUserToken(shortToken, appId, appSecret) {
  if (!shortToken || !appId || !appSecret) return shortToken;
  try {
    const res = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortToken,
      },
      timeout: 20000,
    });
    return res.data?.access_token || shortToken;
  } catch (e) {
    console.warn('Meta long-lived token exchange failed:', parseGraphError(e));
    return shortToken;
  }
}

function isFacebookPlatform(platform) {
  const p = String(platform || '').toLowerCase();
  return p.includes('facebook') || p === 'meta';
}

async function discoverInstagramAccounts(accessToken, username) {
  if (!accessToken) {
    return [{ platform: 'Instagram', handle: username || '@instagram', type: 'Profile', id: `ig_${Date.now()}` }];
  }

  const accounts = [];
  const errors = [];
  try {
    const pages = await graphGetAll('/me/accounts', accessToken, {
      fields: 'name,id,instagram_business_account{id,username,name}',
    });

    for (const page of pages) {
      const ig = page.instagram_business_account;
      if (ig) {
        accounts.push({
          platform: 'Instagram',
          handle: `@${ig.username || ig.name || 'instagram'}`,
          type: 'Profile',
          id: ig.id,
          pageId: page.id,
          accessToken,
        });
      }
    }

    if (!accounts.length) {
      const me = await graphGet('/me', accessToken, { fields: 'id,name' }).catch((e) => {
        errors.push(parseGraphError(e));
        return null;
      });
      if (me?.id) {
        accounts.push({
          platform: 'Instagram',
          handle: me.name || username || 'Instagram',
          type: 'Profile',
          id: me.id,
          accessToken,
        });
      }
    }
  } catch (e) {
    errors.push(parseGraphError(e));
    console.error('Instagram discover error:', errors[errors.length - 1]);
  }

  if (accounts.length) return accounts;
  return [{
    platform: 'Instagram',
    handle: username || 'Instagram Account',
    type: 'Profile',
    id: `ig_${Date.now()}`,
    accessToken,
    _errors: errors,
  }];
}

async function discoverBusinessPages(accessToken, errors) {
  const pages = [];
  try {
    const businesses = await graphGetAll('/me/businesses', accessToken, { fields: 'id,name' });
    for (const biz of businesses) {
      try {
        const owned = await graphGetAll(`/${biz.id}/owned_pages`, accessToken, {
          fields: 'name,id,category,access_token',
        });
        owned.forEach((page) => pages.push({ ...page, businessId: biz.id }));
      } catch (e) {
        errors.push(`Business ${biz.name}: ${parseGraphError(e)}`);
      }
      try {
        const client = await graphGetAll(`/${biz.id}/client_pages`, accessToken, {
          fields: 'name,id,category,access_token',
        });
        client.forEach((page) => pages.push({ ...page, businessId: biz.id }));
      } catch (e) {
        /* client_pages may be unavailable */
      }
    }
  } catch (e) {
    errors.push(`Businesses: ${parseGraphError(e)}`);
  }
  return pages;
}

async function discoverGroups(accessToken, userId, errors) {
  const groups = [];
  const endpoints = [
    ['/me/groups', { fields: 'name,id,privacy,member_count' }],
    userId ? [`/${userId}/groups`, { fields: 'name,id,privacy,member_count' }] : null,
  ].filter(Boolean);

  for (const [path, params] of endpoints) {
    try {
      const found = await graphGetAll(path, accessToken, params);
      found.forEach((g) => {
        if (!groups.some((x) => x.id === g.id)) groups.push(g);
      });
      if (groups.length) break;
    } catch (e) {
      errors.push(`Groups ${path}: ${parseGraphError(e)}`);
    }
  }
  return groups;
}

async function discoverAccounts(accessToken, username, options = {}) {
  const { appId, appSecret } = options;

  if (!accessToken) {
    return [
      { platform: 'Facebook', handle: `${username} (Profile)`, type: 'Profile', id: `fb_${Date.now()}` },
    ];
  }

  let token = accessToken;
  if (appId && appSecret) {
    token = await exchangeLongLivedUserToken(accessToken, appId, appSecret);
  }

  const errors = [];
  const accounts = [];
  const seenIds = new Set();

  const pushAccount = (acc) => {
    const id = String(acc.id);
    if (seenIds.has(id)) return;
    seenIds.add(id);
    accounts.push(acc);
  };

  try {
    const profile = await graphGet('/me', token, {
      fields: 'id,name,email',
    }).catch((e) => {
      errors.push(`Profile: ${parseGraphError(e)}`);
      return null;
    });

    if (profile?.id) {
      pushAccount({
        platform: 'Facebook',
        handle: `${profile.name || username || 'User'} (Profile)`,
        type: 'Profile',
        id: profile.id,
        accessToken: token,
      });
    }

    const pages = await graphGetAll('/me/accounts', token, {
      fields: 'name,id,category,access_token,fan_count,tasks',
    }).catch((e) => {
      errors.push(`Pages: ${parseGraphError(e)}`);
      return [];
    });

    pages.forEach((page) => {
      pushAccount({
        platform: 'Facebook Page',
        handle: `${page.name} (Page)`,
        type: 'Page',
        id: page.id,
        accessToken: page.access_token || token,
        category: page.category || null,
        fanCount: page.fan_count || null,
      });
    });

    const bizPages = await discoverBusinessPages(token, errors);
    bizPages.forEach((page) => {
      pushAccount({
        platform: 'Facebook Page',
        handle: `${page.name} (Page)`,
        type: 'Page',
        id: page.id,
        accessToken: page.access_token || token,
        category: page.category || null,
        businessId: page.businessId || null,
      });
    });

    const groups = await discoverGroups(token, profile?.id, errors);
    groups.forEach((group) => {
      pushAccount({
        platform: 'Facebook Group',
        handle: `${group.name} (Group)`,
        type: 'Group',
        id: group.id,
        accessToken: token,
        privacy: group.privacy || null,
        memberCount: group.member_count || null,
      });
    });

    if (accounts.length > 0) {
      if (errors.length) accounts[0]._warnings = errors;
      return accounts;
    }

    const hint = errors.length
      ? errors.join(' · ')
      : 'Token valid but no pages/groups returned. Grant pages_show_list and business_management, then re-authorize via OAuth.';
    throw new Error(hint);
  } catch (e) {
    if (accounts.length > 0) return accounts;
    console.error('Meta discover error:', e.message);
    throw new Error(e.message || 'Facebook discovery failed');
  }
}

async function getPageInsights(accessToken, pageId) {
  try {
    const res = await axios.get(`${GRAPH}/${pageId}`, {
      params: { fields: 'followers_count,fan_count,name', access_token: accessToken },
      timeout: 20000,
    });
    return res.data;
  } catch (e) {
    return null;
  }
}

async function getProfile(accessToken, account) {
  if (!accessToken) return null;
  try {
    let followers = '0';
    if (account?.type === 'Page' && account.id) {
      const insights = await getPageInsights(accessToken, account.id);
      followers = String(insights?.followers_count || insights?.fan_count || 0);
    } else {
      const res = await axios.get(`${GRAPH}/me`, {
        params: { fields: 'id,name', access_token: accessToken },
        timeout: 20000,
      });
      followers = 'Profile';
    }

    return {
      followers,
      likes: 'See Page Insights',
      bestTime: 'Check page_fans_online in Meta Insights',
      topTrendingNiche: 'Page category trends',
      growthVelocity: 'Track in Meta Business Suite',
      suggestedGroups: ['Relevant Facebook Groups'],
    };
  } catch (e) {
    console.error('Meta profile error:', e.message);
    return null;
  }
}

function resolvePublishTarget(postData, pageId, accountType) {
  if (postData.groupId) return postData.groupId;
  if (accountType === 'Group') return pageId;
  if (accountType === 'Page' && pageId) return pageId;
  return pageId || 'me';
}

async function publish(postData, accessToken, pageId, accountType) {
  if (!accessToken) throw new Error('Meta access token required');

  const target = resolvePublishTarget(postData, pageId, accountType);
  const params = { message: postData.content, access_token: accessToken };

  if (postData.hasMedia && postData.mediaUrl) {
    params.link = postData.mediaUrl;
  }

  const res = await axios.post(`${GRAPH}/${target}/feed`, null, { params, timeout: 30000 });
  return res.data;
}

async function publishToGroup(postData, accessToken, groupId) {
  return publish({ ...postData, groupId }, accessToken, groupId, 'Group');
}

async function listGroups(accessToken, userId = null) {
  if (!accessToken) return [];
  const errors = [];
  const groups = await discoverGroups(accessToken, userId, errors);
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    type: 'Group',
    platform: 'Facebook Group',
    privacy: group.privacy,
    memberCount: group.member_count || null,
  }));
}

async function engage(payload, accessToken) {
  if (!accessToken) throw new Error('Meta access token required');
  const postId = payload.postId || payload.externalId;
  if (!postId) throw new Error('Missing post ID');

  if (payload.action === 'like') {
    return axios.post(`${GRAPH}/${postId}/likes`, null, { params: { access_token: accessToken } });
  }
  if (payload.action === 'share') {
    return axios.post(`${GRAPH}/me/feed`, null, {
      params: { message: payload.content || '', link: payload.url, access_token: accessToken },
    });
  }
  throw new Error(`Unsupported Meta action: ${payload.action}`);
}

module.exports = {
  discoverAccounts,
  discoverInstagramAccounts,
  getProfile,
  publish,
  publishToGroup,
  listGroups,
  engage,
  exchangeLongLivedUserToken,
  isFacebookPlatform,
  parseGraphError,
};