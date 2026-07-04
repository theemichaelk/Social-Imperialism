const crypto = require('crypto');
const http = require('http');
const axios = require('axios');

const REDIRECT_URI = 'social-imperialism://oauth-callback';
const OAUTH_LOOPBACK_PORT = parseInt(process.env.OAUTH_LOOPBACK_PORT || '42813', 10);
const GOOGLE_LOOPBACK_REDIRECT_URI = `http://127.0.0.1:${OAUTH_LOOPBACK_PORT}/oauth/callback`;
const GOOGLE_LOCALHOST_REDIRECT_URI = `http://localhost:${OAUTH_LOOPBACK_PORT}/oauth/callback`;

const LOOPBACK_PLATFORMS = new Set(['YouTube', 'Reddit']);

const pendingFlows = new Map();
let loopbackServer = null;

function isSaasWebMode() {
  return !!(process.env.WEB_URL || process.env.SAAS_MODE === '1' || process.env.NODE_ENV === 'production');
}

function getWebOAuthRedirect() {
  const web = (process.env.WEB_URL || 'https://www.socialimperialism.com').replace(/\/$/, '');
  return `${web}/oauth/callback`;
}

function getOAuthRedirectUris() {
  const web = getWebOAuthRedirect();
  const apex = web.replace('://www.', '://');
  return [...new Set([web, apex, REDIRECT_URI])];
}

function usesLoopbackRedirect(platform) {
  if (isSaasWebMode()) return false;
  return LOOPBACK_PLATFORMS.has(platform);
}

function getRedirectUri(platform) {
  if (isSaasWebMode()) return getWebOAuthRedirect();
  return usesLoopbackRedirect(platform) ? GOOGLE_LOOPBACK_REDIRECT_URI : REDIRECT_URI;
}

function generateState(platform) {
  return `${platform}_${crypto.randomBytes(16).toString('hex')}`;
}

function generatePkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
}

function oauthSuccessHtml() {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Connected</title>
<style>body{font-family:system-ui,sans-serif;background:#0f1117;color:#e8eaed;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{text-align:center;padding:2rem;border:1px solid #2d3148;border-radius:12px;background:#1a1d2e;max-width:420px}
h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#9aa0b8;margin:0}</style></head>
<body><div class="card"><h1>Authorization complete</h1><p>You can close this tab and return to Social Imperialism.</p></div>
<script>setTimeout(()=>window.close(),2500)</script></body></html>`;
}

function oauthErrorHtml(message) {
  const safe = String(message || 'Authorization failed').replace(/[<>&"]/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]
  ));
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Authorization failed</title>
<style>body{font-family:system-ui,sans-serif;background:#0f1117;color:#e8eaed;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{text-align:center;padding:2rem;border:1px solid #5c2b2b;border-radius:12px;background:#1a1d2e;max-width:420px}
h1{font-size:1.25rem;margin:0 0 .5rem;color:#f87171}p{color:#9aa0b8;margin:0}</style></head>
<body><div class="card"><h1>Authorization failed</h1><p>${safe}</p><p style="margin-top:1rem">Close this tab and try again in the app.</p></div></body></html>`;
}

function ensureOAuthLoopbackServer() {
  if (loopbackServer) return Promise.resolve(loopbackServer);

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== 'GET' || !req.url || !req.url.startsWith('/oauth/callback')) {
        res.writeHead(404);
        res.end();
        return;
      }

      const host = req.headers.host || `127.0.0.1:${OAUTH_LOOPBACK_PORT}`;
      const callbackUrl = `http://${host}${req.url}`;
      const result = handleOAuthCallback(callbackUrl);

      if (result?.error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(oauthErrorHtml(result.error));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(oauthSuccessHtml());
    });

    server.listen(OAUTH_LOOPBACK_PORT, '127.0.0.1', () => {
      loopbackServer = server;
      console.log(`OAuth loopback server: ${GOOGLE_LOOPBACK_REDIRECT_URI} (also ${GOOGLE_LOCALHOST_REDIRECT_URI})`);
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(
          `OAuth callback port ${OAUTH_LOOPBACK_PORT} is already in use. Close other Social Imperialism windows and try again.`,
        ));
        return;
      }
      reject(err);
    });
  });
}

function buildAuthUrl(platform, keys, state, pkce, redirectUri = REDIRECT_URI, options = {}) {
  const encodedRedirect = encodeURIComponent(redirectUri);
  const loginHint = options.loginHint ? `&login_hint=${encodeURIComponent(options.loginHint)}` : '';

  switch (platform) {
    case 'Twitter':
    case 'X':
    case 'Twitter / X':
      if (!keys.twId) return null;
      return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${keys.twId}&redirect_uri=${encodedRedirect}&scope=${encodeURIComponent('tweet.read tweet.write users.read offline.access')}&state=${state}&code_challenge=${pkce.challenge}&code_challenge_method=S256`;

    case 'LinkedIn':
      if (!keys.liId) return null;
      return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${keys.liId}&redirect_uri=${encodedRedirect}&state=${state}&scope=${encodeURIComponent('openid profile email w_member_social r_organization_social w_organization_social r_organization_admin rw_organization_admin')}`;

    case 'Facebook':
      if (!keys.fbId) return null;
      return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${keys.fbId}&redirect_uri=${encodedRedirect}&state=${state}&scope=${encodeURIComponent('public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts,publish_to_groups,business_management,groups_access_member_info')}`;

    case 'Instagram':
      if (!keys.fbId) return null;
      return `https://api.instagram.com/oauth/authorize?client_id=${keys.fbId}&redirect_uri=${encodedRedirect}&scope=${encodeURIComponent('instagram_basic,instagram_content_publish')}&response_type=code&state=${state}`;

    case 'YouTube':
      if (!keys.ytId) return null;
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${keys.ytId}&redirect_uri=${encodedRedirect}&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly')}&access_type=offline&state=${state}&prompt=${encodeURIComponent('consent select_account')}${loginHint}&code_challenge=${pkce.challenge}&code_challenge_method=S256`;

    case 'TikTok':
      if (!keys.tkId) return null;
      return `https://www.tiktok.com/v2/auth/authorize/?client_key=${keys.tkId}&scope=${encodeURIComponent('user.info.basic,video.publish')}&response_type=code&redirect_uri=${encodedRedirect}&state=${state}&code_challenge=${pkce.challenge}&code_challenge_method=S256`;

    case 'Snapchat':
      if (!keys.snapchatClientId) return null;
      return `https://accounts.snapchat.com/accounts/oauth2/auth?client_id=${keys.snapchatClientId}&redirect_uri=${encodedRedirect}&response_type=code&scope=${encodeURIComponent('https://auth.snapchat.com/oauth2/api/user.display_name')}&state=${state}`;

    case 'Pinterest':
      if (!keys.pinterestAppId) return null;
      return `https://www.pinterest.com/oauth/?client_id=${keys.pinterestAppId}&redirect_uri=${encodedRedirect}&response_type=code&scope=${encodeURIComponent('boards:read,boards:write,pins:read,pins:write')}&state=${state}`;

    case 'Discord':
      if (!keys.discordClientId) return null;
      return `https://discord.com/oauth2/authorize?client_id=${keys.discordClientId}&response_type=code&redirect_uri=${encodedRedirect}&scope=${encodeURIComponent('identify guilds')}&state=${state}`;

    case 'Reddit':
      if (!keys.rdId) return null;
      return `https://www.reddit.com/api/v1/authorize?client_id=${keys.rdId}&response_type=code&state=${state}&redirect_uri=${encodedRedirect}&duration=permanent&scope=${encodeURIComponent('identity submit read')}`;

    case 'Threads':
      if (!keys.fbId) return null;
      return `https://threads.net/oauth/authorize?client_id=${keys.fbId}&redirect_uri=${encodedRedirect}&scope=${encodeURIComponent('threads_basic,threads_content_publish')}&response_type=code&state=${state}`;

    case 'Twitch':
      if (!keys.twitchClientId) return null;
      return `https://id.twitch.tv/oauth2/authorize?client_id=${keys.twitchClientId}&redirect_uri=${encodedRedirect}&response_type=code&scope=${encodeURIComponent('user:read:email channel:read:stream_key')}&state=${state}`;

    default:
      return null;
  }
}

async function exchangeToken(platform, code, keys, pkceVerifier, redirectUri = REDIRECT_URI) {
  const body = new URLSearchParams();
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

  switch (platform) {
    case 'Twitter':
    case 'X':
    case 'Twitter / X': {
      body.append('grant_type', 'authorization_code');
      body.append('code', code);
      body.append('redirect_uri', redirectUri);
      body.append('code_verifier', pkceVerifier);
      const auth = Buffer.from(`${keys.twId}:${keys.twSecret}`).toString('base64');
      const res = await axios.post('https://api.twitter.com/2/oauth2/token', body, {
        headers: { ...headers, Authorization: `Basic ${auth}` },
      });
      return res.data;
    }

    case 'LinkedIn': {
      body.append('grant_type', 'authorization_code');
      body.append('code', code);
      body.append('redirect_uri', redirectUri);
      body.append('client_id', keys.liId);
      body.append('client_secret', keys.liSecret);
      const res = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', body, { headers });
      return res.data;
    }

    case 'Facebook':
    case 'Instagram':
    case 'Threads': {
      const res = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
        params: {
          client_id: keys.fbId,
          client_secret: keys.fbSecret,
          redirect_uri: redirectUri,
          code,
        },
      });
      return res.data;
    }

    case 'YouTube': {
      body.append('grant_type', 'authorization_code');
      body.append('code', code);
      body.append('redirect_uri', redirectUri);
      body.append('client_id', keys.ytId);
      body.append('client_secret', keys.ytSecret);
      if (pkceVerifier) body.append('code_verifier', pkceVerifier);
      const res = await axios.post('https://oauth2.googleapis.com/token', body, { headers });
      return res.data;
    }

    case 'Reddit': {
      const auth = Buffer.from(`${keys.rdId}:${keys.rdSecret}`).toString('base64');
      body.append('grant_type', 'authorization_code');
      body.append('code', code);
      body.append('redirect_uri', redirectUri);
      const res = await axios.post('https://www.reddit.com/api/v1/access_token', body, {
        headers: { ...headers, Authorization: `Basic ${auth}`, 'User-Agent': 'SocialImperialism/1.0' },
      });
      return res.data;
    }

    case 'Discord': {
      body.append('grant_type', 'authorization_code');
      body.append('code', code);
      body.append('redirect_uri', redirectUri);
      const res = await axios.post('https://discord.com/api/oauth2/token', body, {
        headers: { ...headers, Authorization: `Basic ${Buffer.from(`${keys.discordClientId}:${keys.discordClientSecret}`).toString('base64')}` },
      });
      return res.data;
    }

    case 'TikTok': {
      body.append('client_key', keys.tkId);
      body.append('client_secret', keys.tkSecret);
      body.append('code', code);
      body.append('grant_type', 'authorization_code');
      body.append('redirect_uri', redirectUri);
      if (pkceVerifier) body.append('code_verifier', pkceVerifier);
      const res = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', body, { headers });
      return res.data.data || res.data;
    }

    case 'Snapchat': {
      body.append('grant_type', 'authorization_code');
      body.append('code', code);
      body.append('redirect_uri', redirectUri);
      body.append('client_id', keys.snapchatClientId);
      body.append('client_secret', keys.snapchatSecret);
      const res = await axios.post('https://accounts.snapchat.com/login/oauth2/access_token', body, { headers });
      return res.data;
    }

    case 'Pinterest': {
      body.append('grant_type', 'authorization_code');
      body.append('code', code);
      body.append('redirect_uri', redirectUri);
      const auth = Buffer.from(`${keys.pinterestAppId}:${keys.pinterestSecret}`).toString('base64');
      const res = await axios.post('https://api.pinterest.com/v5/oauth/token', body, {
        headers: { ...headers, Authorization: `Basic ${auth}` },
      });
      return res.data;
    }

    case 'Twitch': {
      body.append('client_id', keys.twitchClientId);
      body.append('client_secret', keys.twitchClientSecret);
      body.append('code', code);
      body.append('grant_type', 'authorization_code');
      body.append('redirect_uri', redirectUri);
      const res = await axios.post('https://id.twitch.tv/oauth2/token', body, { headers });
      return res.data;
    }

    default:
      throw new Error(`Token exchange not implemented for ${platform}`);
  }
}

function waitForOAuthCallback(state, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingFlows.delete(state);
      reject(new Error('OAuth timed out. Please try again.'));
    }, timeoutMs);

    pendingFlows.set(state, {
      resolve: (data) => { clearTimeout(timer); resolve(data); },
      reject: (err) => { clearTimeout(timer); reject(err); },
    });
  });
}

function parseCallbackUrl(url) {
  const parsed = new URL(url);
  return {
    code: parsed.searchParams.get('code'),
    state: parsed.searchParams.get('state'),
    error: parsed.searchParams.get('error'),
    errorDescription: parsed.searchParams.get('error_description'),
  };
}

function handleOAuthCallback(url) {
  try {
    const { code, state, error, errorDescription } = parseCallbackUrl(url);
    if (!state) return null;

    if (error) {
      const msg = errorDescription ? `${error}: ${errorDescription}` : error;
      if (pendingFlows.has(state)) {
        pendingFlows.get(state).reject(new Error(msg));
        pendingFlows.delete(state);
      }
      return { error: msg, state };
    }
    if (!code) {
      const msg = 'No authorization code received';
      if (pendingFlows.has(state)) {
        pendingFlows.get(state).reject(new Error(msg));
        pendingFlows.delete(state);
      }
      return { error: msg, state };
    }

    if (pendingFlows.has(state)) {
      const flow = pendingFlows.get(state);
      pendingFlows.delete(state);
      flow.resolve({ code, state, platform: state.split('_')[0] });
    }

    return { code, state, platform: state.split('_')[0] };
  } catch (e) {
    console.error('OAuth callback parse error:', e.message);
    return null;
  }
}

async function prepareOAuthFlow(platform, keys, options = {}) {
  const normalized = platform === 'X' ? 'Twitter' : platform;
  const flowPlatform = normalized.replace(/\s+/g, '');
  const state = generateState(flowPlatform);
  const pkce = generatePkce();
  const redirectUri = getRedirectUri(platform);

  if (usesLoopbackRedirect(platform)) {
    await ensureOAuthLoopbackServer();
  }

  const authUrl = buildAuthUrl(platform, keys, state, pkce, redirectUri, options);
  if (!authUrl) {
    throw new Error(`OAuth not configured for ${platform}. Add client credentials in Settings > API Integrations.`);
  }

  return { authUrl, state, pkce, redirectUri, platform };
}

async function startOAuthFlow(platform, keys, openExternal, options = {}) {
  const { authUrl, state, pkce, redirectUri, platform: p } = await prepareOAuthFlow(platform, keys, options);
  const callbackPromise = waitForOAuthCallback(state);
  await openExternal(authUrl);
  const { code } = await callbackPromise;
  const tokens = await exchangeToken(platform, code, keys, pkce.verifier, redirectUri);
  return { tokens, platform: p, state };
}

module.exports = {
  REDIRECT_URI,
  GOOGLE_LOOPBACK_REDIRECT_URI,
  GOOGLE_LOCALHOST_REDIRECT_URI,
  OAUTH_LOOPBACK_PORT,
  oauthErrorHtml,
  oauthSuccessHtml,
  buildAuthUrl,
  exchangeToken,
  parseCallbackUrl,
  handleOAuthCallback,
  prepareOAuthFlow,
  startOAuthFlow,
  waitForOAuthCallback,
  generateState,
  generatePkce,
  ensureOAuthLoopbackServer,
  getRedirectUri,
  getOAuthRedirectUris,
  getWebOAuthRedirect,
  usesLoopbackRedirect,
};