/**
 * Unified social platform connect — discover + link all sub-accounts.
 */
const { resolveKeys, resolveSettingsToken, hasStoredConnectToken } = require('./keys');
const { makeConnectionId } = require('./credentialAuth');
const { discoverAccounts, usesOAuth } = require('./accountDiscovery');
const { linkAllDiscoveredAccounts } = require('./accountAutomation');
const { encryptCredential, looksLikeLoginPassword, wantsYouTubeGoogleSignIn } = require('./credentialAuth');

const OAUTH_PLATFORMS = new Set([
  'Twitter', 'X', 'Twitter / X', 'LinkedIn', 'Facebook', 'Instagram',
  'YouTube', 'TikTok', 'Pinterest', 'Discord', 'Reddit', 'Threads', 'Snapchat', 'Twitch',
]);

const TOKEN_ONLY_PLATFORMS = new Set(['Telegram', 'WhatsApp']);

const CONNECT_HINTS = {
  Twitter: 'X does not use email/password here. Add Client ID + Secret in Settings → API, then use the OAuth tab to sign in with your @handle.',
  X: 'X does not use email/password here. Add Client ID + Secret in Settings → API, then use the OAuth tab to sign in with your @handle.',
  'Twitter / X': 'X does not use email/password here. Add Client ID + Secret in Settings → API, then use the OAuth tab to sign in with your @handle.',
  TikTok: 'Settings > API: TikTok Client Key/Secret, then OAuth tab.',
  Pinterest: 'Settings > API: Pinterest App ID/Secret, then OAuth tab.',
  Snapchat: 'Settings > API: Snapchat Client ID/Secret, then OAuth tab.',
  Telegram: 'Password = @BotFather bot token. Username = @channel or chat ID (optional).',
  WhatsApp: 'Email = Phone Number ID. Password = Meta Business Access Token.',
  Facebook: 'Settings > API: Meta App ID/Secret, or paste access token as password.',
  Instagram: 'Uses Meta app credentials — connect via OAuth.',
  Threads: 'Uses Meta app credentials — connect via OAuth.',
  Twitch: 'Settings > API: Twitch Client ID/Secret, then OAuth tab. Redirect URI: social-imperialism://oauth-callback',
  YouTube: 'Credentials tab: enter your Google email + password to sign in and pull every channel on that account. Add redirect URI http://127.0.0.1:42813/oauth/callback in Google Cloud and add yourself as a test user.',
  Quora: 'Username = Quora profile handle. SerpAPI key in Settings enables Q&A discovery. Answers queue to Content Hub for copy/post.',
  Reddit: 'Add redirect URI http://127.0.0.1:42813/oauth/callback in your Reddit app (reddit.com/prefs/apps), then use OAuth tab here.',
};

function validateConnectInput(platform, { email, password, username, method }, keys = {}) {
  const em = (email || '').trim();
  const pw = (password || '').trim();
  const user = (username || '').trim();
  const resolved = resolveKeys(keys);
  const hasStored = hasStoredConnectToken(platform, resolved);

  if (method === 'oauth') {
    if (TOKEN_ONLY_PLATFORMS.has(platform)) {
      return { ok: false, error: `${platform} does not use OAuth. Use Email & Password tab. ${CONNECT_HINTS[platform] || ''}` };
    }
    if (!OAUTH_PLATFORMS.has(platform) && !usesOAuth(platform)) {
      if (platform === 'Telegram' || platform === 'WhatsApp') {
        return { ok: false, error: `${platform}: use Email & Password tab. ${CONNECT_HINTS[platform]}` };
      }
    }
    return { ok: true, email: em || user || `${platform.toLowerCase()}@connect.local` };
  }

  if (platform === 'Telegram') {
    if (!pw) return { ok: false, error: 'Telegram: paste your @BotFather bot token in the password field.' };
    return { ok: true, email: em || user || 'telegram@bot', username: user || em || undefined, password: pw };
  }

  if (platform === 'WhatsApp') {
    if (!em) return { ok: false, error: 'WhatsApp: enter Phone Number ID in the email field.' };
    if (!pw) return { ok: false, error: 'WhatsApp: paste Business Access Token in the password field.' };
    return { ok: true, email: em, password: pw };
  }

  if (platform === 'Reddit') {
    if (!user && !em) return { ok: false, error: 'Reddit: enter your username in the username field (e.g. u/name).' };
    if (!pw && !hasStored) return { ok: false, error: 'Reddit: enter your password, or paste an access token.' };
    return { ok: true, email: em || `${user}@reddit`, username: user || undefined, password: pw || undefined };
  }

  if (platform === 'Quora') {
    if (!em) return { ok: false, error: 'Quora: enter your Quora account email.' };
    if (!pw) return { ok: false, error: 'Quora: enter your Quora password. A browser window will open to save your session.' };
    return { ok: true, email: em, username: user || undefined, password: pw };
  }

  if (platform === 'YouTube') {
    if (!em && !user) return { ok: false, error: 'Enter your Google email to sign in and pull all channels on that account.' };
    if (wantsYouTubeGoogleSignIn({ email: em, password: pw, username: user })) {
      if (!(resolved.ytId && resolved.ytSecret)) {
        return { ok: false, error: 'Add Google Client ID and Secret in Settings > API Integrations before signing in with your Google account.' };
      }
      return { ok: true, email: em, username: user || undefined, password: pw, googleSignIn: true };
    }
    if (!pw && !hasStored) {
      return {
        ok: false,
        error: 'Enter your Google email + password to sign in, or add a YouTube API key in Settings and leave password blank.',
      };
    }
    return { ok: true, email: em || user, username: user || undefined, password: pw || undefined };
  }

  if (!em && !user) return { ok: false, error: 'Email or username is required to identify this connection.' };
  if (!pw && !hasStored) {
    return {
      ok: false,
      error: `Paste your ${platform} API access token in the password field, save one in Settings > API Integrations, or use the OAuth tab.`,
    };
  }
  return { ok: true, email: em || user, username: user || undefined, password: pw || resolveSettingsToken(platform, resolved) || undefined };
}

function sortDiscoveredForLinking(discovered) {
  const rootTypes = new Set(['Profile', 'Bot', 'Business']);
  const rank = (a) => {
    if (rootTypes.has(a.type)) return 0;
    if (a.type === 'Page' || a.type === 'Channel') return 1;
    return 2;
  };
  return [...discovered].sort((a, b) => rank(a) - rank(b));
}

async function connectPlatform({
  platform,
  email,
  password,
  username,
  method = 'credentials',
  keys: rawKeys,
  openExternal,
  store,
  integrations,
}) {
  const validation = validateConnectInput(platform, { email, password, username, method }, rawKeys);
  if (!validation.ok) {
    return { success: false, error: validation.error, platform };
  }

  const keys = resolveKeys(rawKeys || {});
  const loginEmail = (validation.email || email || username || '').trim().toLowerCase();
  const connectionId = makeConnectionId(platform, loginEmail || platform);

  const credentials = {
    platform,
    email: validation.email || email,
    username: validation.username || username || validation.email || email,
    password: validation.password || password || '',
    useCredentials: method !== 'oauth',
    connectionId,
  };

  if (method === 'oauth') {
    credentials.useCredentials = false;
    credentials.email = validation.email;
    credentials.username = validation.email;
  }

  let discovered;
  try {
    discovered = await discoverAccounts(credentials, keys, openExternal);
  } catch (err) {
    const hint = CONNECT_HINTS[platform] ? ` ${CONNECT_HINTS[platform]}` : '';
    return { success: false, error: `${err.message}${hint}`, platform };
  }

  if (!discovered?.length) {
    return { success: false, error: `No accounts returned from ${platform}. Check API credentials and try again.`, platform };
  }

  const sorted = sortDiscoveredForLinking(discovered);
  const sharedTokens = sorted[0]?.encryptedTokens || null;
  const encryptedPassword = sorted[0]?.encryptedPassword || (password ? encryptCredential(password) : null);

  try {
    const { linked, profileAccountId } = await linkAllDiscoveredAccounts({
      store,
      integrations,
      keys,
      discovered: sorted.map((a) => ({
        ...a,
        loginEmail: a.loginEmail || loginEmail,
        connectionId: a.connectionId || connectionId,
      })),
      meta: { loginEmail, connectionId, sharedTokens, encryptedPassword },
    });

    if (!linked.length) {
      return {
        success: false,
        error: 'Accounts already linked for this login, or discovery returned duplicates.',
        platform,
        discoveredCount: sorted.length,
      };
    }

    return {
      success: true,
      platform,
      linked: linked.length,
      connectionId,
      profileAccountId,
      accounts: linked,
      discovered: sorted.map((a) => ({
        platform: a.platform,
        handle: a.handle,
        type: a.type,
        id: a.id,
      })),
      hint: platform === 'YouTube' && sorted.length === 1
        ? 'Google linked 1 YouTube brand. Use Add Platform Link again (same email + password) and pick another brand on Google\'s screen to link more channels.'
        : undefined,
    };
  } catch (err) {
    return { success: false, error: `Link failed: ${err.message}`, platform };
  }
}

function testKeyResolution(globalKeys) {
  const keys = resolveKeys(globalKeys || {});
  const checks = {
    Twitter: !!(keys.twId && keys.twSecret) || !!keys.twBearer,
    LinkedIn: !!(keys.liId && keys.liSecret) || !!keys.linkedinAccessToken,
    Facebook: !!(keys.fbId && keys.fbSecret) || !!keys.metaAccess,
    Instagram: !!(keys.fbId && keys.fbSecret) || !!keys.metaAccess,
    YouTube: !!(keys.ytId && keys.ytSecret) || !!keys.youtubeApiKey,
    Reddit: !!(keys.rdId && keys.rdSecret),
    TikTok: !!(keys.tkId && keys.tkSecret),
    Pinterest: !!(keys.pinterestAppId && keys.pinterestSecret),
    Snapchat: !!(keys.snapchatClientId && keys.snapchatSecret),
    Discord: !!(keys.discordClientId && keys.discordClientSecret) || !!keys.discordBotToken,
    Telegram: !!keys.telegramBotToken,
    WhatsApp: !!(keys.whatsappAccessToken && keys.whatsappPhoneNumberId) || !!keys.metaAccess,
    Threads: !!(keys.fbId && keys.fbSecret) || !!keys.metaAccess,
    Twitch: !!(keys.twitchClientId && keys.twitchClientSecret),
    Quora: true,
  };
  return { keys, checks };
}

module.exports = {
  connectPlatform,
  validateConnectInput,
  sortDiscoveredForLinking,
  testKeyResolution,
  CONNECT_HINTS,
  OAUTH_PLATFORMS,
  TOKEN_ONLY_PLATFORMS,
};