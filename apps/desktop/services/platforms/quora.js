/**
 * Quora — SerpAPI discovery, browser-session login, automated answers & engagement.
 */
const axios = require('axios');
const quoraBrowser = require('../quoraBrowserAutomation');

const UA = 'SocialImperialism/1.0';

async function searchPosts(keyword, keys, limit = 5) {
  if (!keys?.serpApiKey || !keyword?.trim()) return [];
  try {
    const res = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google',
        q: `site:quora.com ${keyword}`,
        api_key: keys.serpApiKey,
        num: Math.min(limit, 10),
      },
      timeout: 20000,
    });
    return (res.data?.organic_results || []).slice(0, limit).map((r, i) => ({
      platform: 'Quora',
      externalId: `quora_${Buffer.from(r.link || '').toString('base64').slice(0, 24)}_${i}`,
      content: r.title || r.snippet || '',
      url: r.link,
      author: r.source || 'Quora',
      createdAt: Date.now(),
      stats: { likes: 0, comments: 0, views: 0 },
      matchedKeyword: keyword,
    }));
  } catch (e) {
    console.error('Quora Serp search error:', e.message);
    return [];
  }
}

function discoverAccounts(username, email, extras = {}) {
  const handle = (extras.handle || username || email || 'quora_user').replace(/^@/, '').trim();
  const connectionId = extras.connectionId || `quora_${Date.now()}`;
  return [{
    platform: 'Quora',
    handle: handle.startsWith('@') ? handle : `@${handle.split('@')[0]}`,
    type: 'Profile',
    id: `quora_${connectionId}`,
    connectionId,
    sessionValid: !!extras.sessionValid,
  }];
}

async function getProfile(account, tokens) {
  const connectionId = quoraBrowser.resolveConnectionId(account, tokens);
  let session = { sessionValid: false, handle: account?.handle };
  if (connectionId && quoraBrowser.sessionExists(connectionId)) {
    session = await quoraBrowser.getSessionProfile(connectionId);
  }
  return {
    followers: '—',
    likes: '—',
    bestTime: session.sessionValid ? 'Automation active — answers post via linked browser session' : 'Re-link account to refresh session',
    topTrendingNiche: 'Q&A / Spaces',
    growthVelocity: session.sessionValid ? 'Session active' : 'Session expired',
    suggestedGroups: ['Quora Spaces'],
    handle: session.handle || account?.handle,
    sessionValid: session.sessionValid,
  };
}

function parseConnection(tokens, account) {
  return quoraBrowser.resolveConnectionId(account, tokens);
}

async function publish(payload, accessToken, account) {
  const content = payload?.content?.trim();
  if (!content) throw new Error('Quora answer content is required');

  const tokens = typeof accessToken === 'object' ? accessToken : null;
  const connectionId = parseConnection(tokens, account);
  const questionUrl = payload.questionUrl || payload.url;

  if (connectionId && quoraBrowser.sessionExists(connectionId) && questionUrl) {
    return quoraBrowser.postAnswer({ connectionId, questionUrl, content });
  }

  return {
    success: true,
    platform: 'Quora',
    accountId: account?.id,
    draft: true,
    livePosted: false,
    content,
    questionUrl: questionUrl || null,
    message: questionUrl
      ? 'Answer queued — link Quora with email/password in Linked Accounts to post automatically.'
      : 'Answer saved. Provide question URL to post live.',
  };
}

async function engage(payload, keys, accessToken, account) {
  if (payload.action === 'reply' && payload.content) {
    return publish({
      content: payload.content,
      url: payload.url,
      questionUrl: payload.url,
    }, accessToken, account || { id: payload.accountId, connectionId: payload.connectionId });
  }

  const tokens = typeof accessToken === 'object' ? accessToken : null;
  const connectionId = parseConnection(tokens, account || { connectionId: payload.connectionId, id: payload.accountId });
  if (connectionId && payload.url && ['like', 'upvote', 'follow'].includes(payload.action)) {
    return quoraBrowser.performEngage({
      connectionId,
      action: payload.action,
      url: payload.url,
    });
  }

  return {
    success: false,
    platform: 'Quora',
    action: payload.action,
    note: 'Link Quora in Linked Accounts (email + password) to enable automated likes and follows.',
  };
}

module.exports = {
  searchPosts,
  discoverAccounts,
  getProfile,
  publish,
  engage,
};