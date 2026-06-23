const twitter = require('./platforms/twitter');
const reddit = require('./platforms/reddit');
const linkedin = require('./platforms/linkedin');
const meta = require('./platforms/meta');
const youtube = require('./platforms/youtube');
const discord = require('./platforms/discord');
const tiktok = require('./platforms/tiktok');
const pinterest = require('./platforms/pinterest');
const snapchat = require('./platforms/snapchat');
const telegram = require('./platforms/telegram');
const whatsapp = require('./platforms/whatsapp');
const twitch = require('./platforms/twitch');
const quora = require('./platforms/quora');
const quoraBrowser = require('./quoraBrowserAutomation');
const { makeConnectionId } = require('./credentialAuth');
const oauth = require('./oauth');
const { authenticateWithCredentials, looksLikeLoginPassword } = require('./credentialAuth');
const {
  hasTwitterKeys, hasLinkedInKeys, hasMetaKeys, hasYouTubeKeys, hasRedditKeys,
  hasTikTokKeys, hasPinterestKeys, hasSnapchatKeys, hasTelegramKeys, hasWhatsAppKeys,
} = require('./keys');

const OAUTH_PLATFORMS = new Set([
  'Twitter', 'X', 'Twitter / X', 'LinkedIn', 'Facebook', 'Instagram',
  'YouTube', 'TikTok', 'Pinterest', 'Discord', 'Reddit', 'Threads', 'Snapchat', 'Twitch',
]);

function mapDiscovered(accounts, extras = {}) {
  const tokenBlob = extras.oauthTokens
    ? Buffer.from(JSON.stringify(extras.oauthTokens)).toString('base64')
    : extras.encryptedTokens || null;
  return accounts.map((a) => ({
    ...a,
    loginEmail: extras.loginEmail || a.loginEmail || null,
    oauthTokens: extras.oauthTokens || a.oauthTokens || null,
    encryptedTokens: a.encryptedTokens || tokenBlob,
    encryptedPassword: extras.encryptedPassword || a.encryptedPassword || null,
  }));
}

function usesOAuth(platform) {
  return OAUTH_PLATFORMS.has(platform);
}

async function discoverAccounts(credentials, keys, openExternal, options = {}) {
  const { platform, username, password, email, useCredentials, connectionId: presetConnectionId } = credentials;
  let accessToken = null;
  let oauthTokens = credentials.oauthTokens || null;
  let loginEmail = email || username || null;
  let encryptedPassword = null;

  let youtubeApiKey = keys.youtubeApiKey || null;
  let discordBotToken = keys.discordBotToken || null;

  if (oauthTokens?.access_token) {
    accessToken = oauthTokens.access_token;
  } else if (useCredentials) {
    const auth = await authenticateWithCredentials(platform, keys, {
      email: email || username,
      password,
      username,
    }, openExternal);
    oauthTokens = auth.oauthTokens;
    accessToken = auth.accessToken;
    loginEmail = auth.loginEmail;
    encryptedPassword = auth.encryptedPassword || null;
    youtubeApiKey = auth.youtubeApiKey || oauthTokens?.api_key || youtubeApiKey;
    discordBotToken = auth.discordBotToken || (oauthTokens?.token_type === 'bot' ? oauthTokens.access_token : null) || discordBotToken;

    if (platform === 'YouTube' && auth.requiresGoogleOAuth) {
      if (!(keys.ytId && keys.ytSecret)) {
        throw new Error('Add Google Client ID and Secret in Settings > API Integrations to sign in with your Google account.');
      }
      if (!openExternal) {
        throw new Error('Google sign-in requires the desktop app window.');
      }
      const result = await oauth.startOAuthFlow('YouTube', keys, openExternal, { loginHint: loginEmail || email });
      oauthTokens = result.tokens;
      accessToken = oauthTokens.access_token;
    }
  } else if (usesOAuth(platform) && openExternal) {
    const hasOAuthCreds = {
      Twitter: keys.twId && keys.twSecret,
      X: keys.twId && keys.twSecret,
      'Twitter / X': keys.twId && keys.twSecret,
      LinkedIn: keys.liId && keys.liSecret,
      Facebook: keys.fbId && keys.fbSecret,
      Instagram: keys.fbId && keys.fbSecret,
      YouTube: keys.ytId && keys.ytSecret,
      TikTok: keys.tkId && keys.tkSecret,
      Pinterest: keys.pinterestAppId && keys.pinterestSecret,
      Discord: keys.discordClientId && keys.discordClientSecret,
      Reddit: keys.rdId && keys.rdSecret,
      Threads: keys.fbId && keys.fbSecret,
      Snapchat: keys.snapchatClientId && keys.snapchatSecret,
      Twitch: keys.twitchClientId && keys.twitchClientSecret,
    }[platform];

    if (hasOAuthCreds) {
      const result = await oauth.startOAuthFlow(platform, keys, openExternal, {
        loginHint: loginEmail || email || username,
      });
      oauthTokens = result.tokens;
      accessToken = oauthTokens.access_token;
    } else if (usesOAuth(platform)) {
      throw new Error(`Add ${platform} API credentials in Settings > API Integrations before connecting.`);
    }
  }

  switch (platform) {
    case 'Twitter':
    case 'X':
    case 'Twitter / X': {
      if (oauthTokens?.access_token) {
        const twKeys = { ...keys, twBearer: oauthTokens.access_token };
        return (await twitter.discoverAccounts(twKeys, username)).map((a) => ({
          ...a,
          loginEmail,
          oauthTokens,
          encryptedTokens: Buffer.from(JSON.stringify(oauthTokens)).toString('base64'),
          encryptedPassword,
        }));
      }
      if (hasTwitterKeys(keys)) {
        return (await twitter.discoverAccounts(keys, username)).map((a) => ({
          ...a,
          encryptedTokens: password ? Buffer.from(password).toString('base64') : null,
        }));
      }
      throw new Error('Twitter API keys not configured. Add Client ID/Secret or Bearer token in Settings.');
    }

    case 'LinkedIn': {
      const token = accessToken || keys.linkedinAccessToken;
      if (!token && !(keys.liId && keys.liSecret)) {
        throw new Error('LinkedIn not configured. Add OAuth credentials or an access token in Settings.');
      }
      const accounts = await linkedin.discoverAccounts(keys, username, token);
      return accounts.map((a) => ({
        ...a,
        loginEmail,
        oauthTokens: oauthTokens || (token ? { access_token: token } : null),
        encryptedTokens: Buffer.from(JSON.stringify(oauthTokens || { access_token: a.accessToken || token })).toString('base64'),
        encryptedPassword,
      }));
    }

    case 'Facebook':
    case 'Facebook Page': {
      let token = accessToken || keys.metaAccess;
      if (!token && !(keys.fbId && keys.fbSecret)) {
        throw new Error('Meta/Facebook not configured. Add App ID/Secret in Settings → API, paste a Meta access token (EAA…), or use OAuth.');
      }
      if (oauthTokens?.access_token && keys.fbId && keys.fbSecret) {
        token = await meta.exchangeLongLivedUserToken(oauthTokens.access_token, keys.fbId, keys.fbSecret);
        oauthTokens.access_token = token;
      }
      const accounts = await meta.discoverAccounts(token, username || email, {
        appId: keys.fbId,
        appSecret: keys.fbSecret,
      });
      if (!accounts.length) {
        throw new Error('No Facebook accounts returned. Re-authorize with pages_show_list and business_management permissions.');
      }
      const tokenBase = oauthTokens || (token ? { access_token: token } : null);
      return accounts.map((a) => ({
        ...a,
        loginEmail,
        oauthTokens: tokenBase,
        encryptedTokens: Buffer.from(JSON.stringify({ access_token: a.accessToken || token })).toString('base64'),
        encryptedPassword,
      }));
    }

    case 'Instagram': {
      const token = accessToken || keys.metaAccess;
      if (!token && !(keys.fbId && keys.fbSecret)) {
        throw new Error('Instagram not configured. Add Meta App ID/Secret, paste access token, or save metaAccess in Settings.');
      }
      const accounts = await meta.discoverInstagramAccounts(token, username || email);
      if (!accounts.length) throw new Error('No Instagram accounts returned. Token needs instagram_basic scope.');
      const tokenBase = oauthTokens || (token ? { access_token: token } : null);
      return accounts.map((a) => ({
        ...a,
        loginEmail,
        oauthTokens: tokenBase,
        encryptedTokens: Buffer.from(JSON.stringify({ access_token: a.accessToken || token })).toString('base64'),
        encryptedPassword,
      }));
    }

    case 'YouTube': {
      const apiKey = youtubeApiKey || oauthTokens?.api_key || keys.youtubeApiKey || null;
      const bearer = accessToken && !youtube.isGoogleApiKey(accessToken) ? accessToken : null;
      if (!bearer && !apiKey && !hasYouTubeKeys(keys)) {
        throw new Error('YouTube not configured. Add OAuth credentials, paste a Google API key (AIza…), or save one in Settings.');
      }
      const accounts = await youtube.discoverChannels(
        bearer,
        apiKey,
        username,
        loginEmail || email || username
      );
      if (!accounts?.length) {
        throw new Error('YouTube discovery failed. Paste your @channel handle in the username field, a Google API key in password, or use OAuth for your own channel.');
      }
      const tokenPayload = oauthTokens || (apiKey ? { api_key: apiKey } : bearer ? { access_token: bearer } : null);
      const sharedTokenBlob = tokenPayload
        ? Buffer.from(JSON.stringify(tokenPayload)).toString('base64')
        : null;
      return accounts.map((a) => ({
        ...a,
        loginEmail,
        oauthTokens: tokenPayload,
        encryptedTokens: sharedTokenBlob,
        encryptedPassword,
      }));
    }

    case 'Reddit': {
      if (!accessToken && !hasRedditKeys(keys)) {
        throw new Error('Reddit not configured. Add OAuth credentials in Settings.');
      }
      const accounts = await reddit.discoverAccounts(keys, username, accessToken);
      const tokenBlob = oauthTokens ? Buffer.from(JSON.stringify(oauthTokens)).toString('base64') : null;
      return accounts.map((a) => ({
        ...a,
        loginEmail,
        oauthTokens,
        encryptedTokens: tokenBlob,
        encryptedPassword,
      }));
    }

    case 'Discord': {
      const botTok = discordBotToken || keys.discordBotToken;
      const userTok = oauthTokens?.token_type === 'bot' ? null : accessToken;
      if (!userTok && !botTok && !(keys.discordClientId && keys.discordClientSecret)) {
        throw new Error('Discord not configured. Paste a bot token as password, or add OAuth credentials in Settings.');
      }
      const accounts = await discord.discoverAccounts(userTok, botTok, username || email);
      return accounts.map((a) => ({
        ...a,
        loginEmail,
        oauthTokens,
        encryptedTokens: Buffer.from(JSON.stringify(oauthTokens || { access_token: a.accessToken || botTok, token_type: botTok && !userTok ? 'bot' : undefined })).toString('base64'),
        encryptedPassword,
      }));
    }

    case 'TikTok': {
      const token = accessToken || oauthTokens?.access_token;
      if (!token) {
        throw new Error('TikTok login failed. Add Client Key/Secret in Settings > API (TikTok), then connect via OAuth tab.');
      }
      return mapDiscovered(await tiktok.discoverAccounts(token, username), { oauthTokens, loginEmail, encryptedPassword });
    }

    case 'Pinterest': {
      const token = accessToken || oauthTokens?.access_token;
      if (!token) {
        throw new Error('Pinterest login failed. Add App ID/Secret in Settings > API (Pinterest), then connect via OAuth.');
      }
      return mapDiscovered(await pinterest.discoverAccounts(token, username), { oauthTokens, loginEmail, encryptedPassword });
    }

    case 'Snapchat': {
      const token = accessToken || oauthTokens?.access_token;
      if (!token && !hasSnapchatKeys(keys)) {
        throw new Error('Snapchat not configured. Add Client ID/Secret in Settings > API (Snapchat).');
      }
      if (!token) {
        throw new Error('Snapchat login failed. Complete OAuth authorization in your browser.');
      }
      return mapDiscovered(await snapchat.discoverAccounts(token, username), { oauthTokens, loginEmail, encryptedPassword });
    }

    case 'Threads':
      if (!oauthTokens && !keys.metaAccess && !(keys.fbId && keys.fbSecret)) {
        throw new Error('Threads requires Meta app credentials in Settings.');
      }
      return [{ platform: 'Threads', handle: username || '@threads', type: 'Profile', id: `th_${Date.now()}`, oauthTokens, encryptedTokens: oauthTokens ? Buffer.from(JSON.stringify(oauthTokens)).toString('base64') : null }];

    case 'Telegram': {
      const botToken = oauthTokens?.access_token || accessToken || keys.telegramBotToken;
      const chatId = oauthTokens?.chat_id || username || email;
      if (!botToken) {
        throw new Error('Telegram: add Bot Token in Settings > API, or paste @BotFather token in password field.');
      }
      return mapDiscovered(
        await telegram.discoverAccounts(botToken, chatId, loginEmail),
        { oauthTokens: oauthTokens || { access_token: botToken, chat_id: chatId }, loginEmail, encryptedPassword }
      );
    }

    case 'WhatsApp': {
      const waToken = oauthTokens?.access_token || accessToken || keys.whatsappAccessToken || keys.metaAccess;
      const phoneId = oauthTokens?.phone_number_id || keys.whatsappPhoneNumberId || username || email;
      if (!waToken || !phoneId) {
        throw new Error('WhatsApp: enter Phone Number ID in email field and Business Access Token in password (from Meta Business > WhatsApp > API Setup).');
      }
      return mapDiscovered(
        await whatsapp.discoverAccounts(waToken, phoneId, loginEmail),
        { oauthTokens: { access_token: waToken, phone_number_id: phoneId }, loginEmail, encryptedPassword }
      );
    }

    case 'Quora': {
      const connectionId = presetConnectionId || makeConnectionId('Quora', loginEmail || email || username);
      let loginResult = { sessionValid: false, handle: null };
      if (useCredentials && password && looksLikeLoginPassword(password)) {
        loginResult = await quoraBrowser.login({
          connectionId,
          email: email || loginEmail,
          password,
          headless: false,
        });
        if (!loginResult.success) {
          throw new Error(loginResult.error || 'Quora browser login failed.');
        }
      } else if (!quoraBrowser.sessionExists(connectionId)) {
        throw new Error('Quora: enter your email and password to sign in via browser session.');
      }
      const oauthPayload = {
        connection_id: connectionId,
        method: 'browser_session',
        session_valid: loginResult.sessionValid !== false,
      };
      return mapDiscovered(
        quora.discoverAccounts(username || email, loginEmail, {
          connectionId,
          handle: loginResult.handle,
          sessionValid: oauthPayload.session_valid,
        }),
        {
          loginEmail,
          encryptedPassword,
          oauthTokens: oauthPayload,
        },
      ).map((a) => ({
        ...a,
        connectionId,
        encryptedTokens: Buffer.from(JSON.stringify(oauthPayload)).toString('base64'),
      }));
    }

    case 'Twitch': {
      const token = accessToken || oauthTokens?.access_token;
      const clientId = keys.twitchClientId;
      if (!token) {
        throw new Error('Twitch login failed. Add Client ID/Secret in Settings > API (Twitch), then connect via OAuth.');
      }
      if (!clientId) {
        throw new Error('Twitch Client ID required in Settings > API Integrations (needed for Helix API calls).');
      }
      return mapDiscovered(
        await twitch.discoverAccounts(token, clientId, username || email, keys.twitchStreamKey),
        { oauthTokens: { ...oauthTokens, client_id: clientId }, loginEmail, encryptedPassword }
      );
    }

    default:
      throw new Error(`Platform "${platform}" is not supported for direct account linking yet.`);
  }
}

module.exports = { discoverAccounts, usesOAuth };