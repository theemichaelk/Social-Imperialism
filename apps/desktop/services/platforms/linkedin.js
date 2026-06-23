const axios = require('axios');

async function getProfile(accessToken) {
  if (!accessToken) return null;
  try {
    const res = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const d = res.data;
    return {
      followers: 'Check LinkedIn Analytics',
      likes: 'N/A',
      bestTime: 'Tuesday–Thursday 9–11 AM',
      topTrendingNiche: 'Professional networking',
      growthVelocity: 'Track via LinkedIn Creator tools',
      suggestedGroups: ['LinkedIn Groups in your industry'],
      raw: d,
    };
  } catch (e) {
    console.error('LinkedIn profile error:', e.message);
    return null;
  }
}

async function discoverOrganizations(accessToken) {
  if (!accessToken) return [];
  try {
    const res = await axios.get('https://api.linkedin.com/v2/organizationAcls', {
      params: {
        q: 'roleAssignee',
        role: 'ADMINISTRATOR',
        projection: '(elements*(organization~(localizedName,vanityName)))',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    return (res.data?.elements || []).map((el) => {
      const org = el['organization~'] || {};
      const orgUrn = el.organization || '';
      const orgId = orgUrn.replace('urn:li:organization:', '');
      return {
        platform: 'LinkedIn Page',
        handle: `${org.localizedName || org.vanityName || 'Company Page'} (Page)`,
        type: 'Page',
        id: orgId || `li_org_${Date.now()}`,
        orgUrn,
      };
    });
  } catch (e) {
    console.error('LinkedIn org discovery error:', e.message);
    return [];
  }
}

async function discoverAccounts(keys, username, accessToken) {
  const token = accessToken || keys.linkedinAccessToken;
  const accounts = [];

  if (token) {
    const profile = await getProfile(token);
    if (profile?.raw) {
      const name = profile.raw.name || profile.raw.given_name || username;
      accounts.push({
        platform: 'LinkedIn',
        handle: name,
        type: 'Profile',
        id: profile.raw.sub || `li_${Date.now()}`,
      });
    }
    const orgs = await discoverOrganizations(token);
    accounts.push(...orgs);
  }

  if (accounts.length) return accounts;
  return [{ platform: 'LinkedIn', handle: username || 'LinkedIn Profile', type: 'Profile', id: `li_${Date.now()}` }];
}

async function publish(postData, accessToken) {
  const token = accessToken || postData.accessToken;
  if (!token) throw new Error('LinkedIn access token required');

  let author = null;
  if (postData.orgUrn) {
    author = postData.orgUrn.startsWith('urn:') ? postData.orgUrn : `urn:li:organization:${postData.orgUrn}`;
  } else if (postData.accountType === 'Page' && postData.pageId) {
    author = `urn:li:organization:${postData.pageId}`;
  } else {
    author = await getActorUrn(token);
  }

  const payload = {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: postData.content },
        shareMediaCategory: postData.hasMedia ? 'IMAGE' : 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  try {
    const res = await axios.post('https://api.linkedin.com/v2/ugcPosts', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    return { success: true, data: res.data, platform: 'LinkedIn' };
  } catch (e) {
    const status = e.response?.status;
    const detail = e.response?.data?.message || e.response?.data?.error || e.message;
    return {
      success: false,
      error: status === 422 ? `LinkedIn rejected post (${detail}). Try unique content or wait before republishing.` : detail,
      statusCode: status,
      platform: 'LinkedIn',
    };
  }
}

async function getActorUrn(token) {
  const res = await axios.get('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const sub = res.data?.sub;
  if (!sub) throw new Error('Could not resolve LinkedIn member ID');
  return sub.startsWith('urn:') ? sub : `urn:li:person:${sub}`;
}

async function engage(payload, accessToken) {
  const token = accessToken || payload.accessToken;
  if (!token) throw new Error('LinkedIn access token required. Link your LinkedIn account in Account Hub.');

  const urn = payload.urn || payload.externalId;
  if (!urn) throw new Error('LinkedIn post URN required for engagement');

  const encodedUrn = encodeURIComponent(urn);
  const actor = await getActorUrn(token);

  if (payload.action === 'like') {
    return axios.post(
      `https://api.linkedin.com/v2/socialActions/${encodedUrn}/likes`,
      { actor },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );
  }

  if (payload.action === 'reply' || payload.action === 'comment') {
    const text = payload.content || payload.postContent;
    if (!text) throw new Error('Comment text is required');
    return axios.post(
      `https://api.linkedin.com/v2/socialActions/${encodedUrn}/comments`,
      { actor, message: { text } },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );
  }

  throw new Error(`LinkedIn action "${payload.action}" is not supported`);
}

async function fetchRecentPostsForMember(profileUrl, accessToken) {
  const username = (profileUrl || '').match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1];
  if (!username || !accessToken) return [];

  try {
    const res = await axios.get('https://api.linkedin.com/v2/ugcPosts', {
      params: { q: 'authors', authors: `List(urn:li:person:${username})`, count: 5 },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      timeout: 15000,
    });

    return (res.data?.elements || []).map((post) => {
      const text = post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '';
      return {
        id: post.id,
        externalId: post.id,
        urn: post.id,
        author: username.replace(/-/g, ' '),
        authorTitle: 'LinkedIn',
        authorUrl: profileUrl,
        time: post.created?.time ? new Date(post.created.time).toLocaleString() : 'Recent',
        content: text,
        url: profileUrl,
        platform: 'LinkedIn',
        stats: { likes: 0, comments: 0, views: 0 },
      };
    });
  } catch (e) {
    console.error('LinkedIn ugcPosts fetch error:', e.message);
    return [];
  }
}

module.exports = { getProfile, discoverAccounts, discoverOrganizations, publish, engage, fetchRecentPostsForMember, getActorUrn };