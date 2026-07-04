const axios = require('axios');

const LINKEDIN_REST_VERSION = '202306';

function parseLinkedInError(err) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const msg = data?.message || data?.error_description || data?.error || err?.message || 'LinkedIn API error';
  if (status === 401) return 'LinkedIn token expired — re-authorize via OAuth in Account Hub.';
  if (status === 403) return `LinkedIn permission denied: ${msg}. Enable Community Management / Sign In with LinkedIn products and re-authorize with organization scopes.`;
  if (status === 429) return 'LinkedIn API rate limit reached — wait and click Refresh Profile, or re-link tomorrow.';
  if (status === 426) return `LinkedIn API version mismatch: ${msg}`;
  return msg;
}

async function getProfile(accessToken) {
  const detailed = await getProfileDetailed(accessToken);
  return detailed.profile;
}

async function getProfileDetailed(accessToken) {
  if (!accessToken) {
    return { profile: null, error: 'No LinkedIn access token on this account.' };
  }

  try {
    const res = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 20000,
    });
    const d = res.data;
    return {
      profile: {
        followers: d.followers_count != null ? String(d.followers_count) : 'Check LinkedIn Analytics',
        likes: 'N/A',
        bestTime: 'Tuesday–Thursday 9–11 AM',
        topTrendingNiche: 'Professional networking',
        growthVelocity: 'Track via LinkedIn Creator tools',
        suggestedGroups: ['LinkedIn Groups in your industry'],
        email: d.email || null,
        name: d.name || [d.given_name, d.family_name].filter(Boolean).join(' ') || null,
        raw: d,
      },
      error: null,
    };
  } catch (e) {
    const error = parseLinkedInError(e);
    console.error('LinkedIn profile error:', error);
    return { profile: null, error };
  }
}

async function discoverOrganizations(accessToken) {
  const detailed = await discoverOrganizationsDetailed(accessToken);
  return detailed.orgs;
}

async function discoverOrganizationsDetailed(accessToken) {
  if (!accessToken) return { orgs: [], error: 'No LinkedIn access token.' };

  const attempts = [
    {
      url: 'https://api.linkedin.com/rest/organizationAcls',
      params: { q: 'roleAssignee', role: 'ADMINISTRATOR' },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': LINKEDIN_REST_VERSION,
      },
      map: (elements) => elements.map((el) => {
        const org = el.organization || el['organization~'] || {};
        const orgUrn = typeof org === 'string' ? org : (org.id ? `urn:li:organization:${org.id}` : '');
        const orgObj = typeof org === 'object' ? org : {};
        const orgId = String(orgObj.id || orgUrn.replace('urn:li:organization:', '') || '');
        const name = orgObj.localizedName || orgObj.vanityName || orgObj.name || 'Company Page';
        return {
          platform: 'LinkedIn Page',
          handle: `${name} (Page)`,
          type: 'Page',
          id: orgId || `li_org_${Date.now()}`,
          orgUrn: orgUrn || (orgId ? `urn:li:organization:${orgId}` : null),
        };
      }),
    },
    {
      url: 'https://api.linkedin.com/v2/organizationAcls',
      params: {
        q: 'roleAssignee',
        role: 'ADMINISTRATOR',
        projection: '(elements*(organization~(localizedName,vanityName)))',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      map: (elements) => elements.map((el) => {
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
      }),
    },
    {
      url: 'https://api.linkedin.com/rest/organizationAcls',
      params: { q: 'roleAssignee' },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': LINKEDIN_REST_VERSION,
      },
      map: (elements) => elements.map((el) => {
        const orgRef = el.organization || el['organization~'];
        const orgUrn = typeof orgRef === 'string' ? orgRef : '';
        const orgId = orgUrn.replace('urn:li:organization:', '');
        return {
          platform: 'LinkedIn Page',
          handle: `Organization ${orgId || 'Page'} (Page)`,
          type: 'Page',
          id: orgId || `li_org_${Date.now()}`,
          orgUrn: orgUrn || null,
          role: el.role || null,
        };
      }),
    },
  ];

  const errors = [];
  for (const attempt of attempts) {
    try {
      const res = await axios.get(attempt.url, {
        params: attempt.params,
        headers: attempt.headers,
        timeout: 20000,
      });
      const elements = res.data?.elements || [];
      const orgs = attempt.map(elements).filter((o) => o.id);
      if (orgs.length) return { orgs, error: null };
    } catch (e) {
      errors.push(parseLinkedInError(e));
    }
  }

  return {
    orgs: [],
    error: errors[0] || 'No LinkedIn company pages returned. Grant organization scopes and enable Community Management in your LinkedIn Developer app.',
  };
}

async function discoverAccounts(keys, username, accessToken, options = {}) {
  const { allowPlaceholder = true } = options || {};
  const token = accessToken || keys.linkedinAccessToken;
  const accounts = [];
  const warnings = [];

  if (token) {
    const { profile, error: profileError } = await getProfileDetailed(token);
    if (profile?.raw) {
      const name = profile.raw.name || profile.raw.given_name || username;
      accounts.push({
        platform: 'LinkedIn',
        handle: name,
        type: 'Profile',
        id: profile.raw.sub || `li_${Date.now()}`,
        email: profile.raw.email || null,
      });
    } else if (profileError) warnings.push(`Profile: ${profileError}`);

    const { orgs, error: orgError } = await discoverOrganizationsDetailed(token);
    accounts.push(...orgs);
    if (orgError && !orgs.length) warnings.push(`Pages: ${orgError}`);
  }

  if (accounts.length) {
    if (warnings.length) accounts[0]._warnings = warnings;
    return accounts;
  }

  if (!allowPlaceholder) {
    throw new Error(warnings.join(' · ') || 'LinkedIn discovery returned no accounts. Re-link with OAuth or paste a fresh token.');
  }

  return [{
    platform: 'LinkedIn',
    handle: username || 'LinkedIn Profile',
    type: 'Profile',
    id: `li_${Date.now()}`,
    _warnings: warnings,
  }];
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

module.exports = {
  getProfile,
  getProfileDetailed,
  discoverAccounts,
  discoverOrganizations,
  discoverOrganizationsDetailed,
  publish,
  engage,
  fetchRecentPostsForMember,
  getActorUrn,
  parseLinkedInError,
};