const crypto = require('crypto');
const axios = require('axios');
const { resolveSettingsToken } = require('./keys');

const UA = 'SocialImperialism/1.0 by SocialImperialismApp';

const TOKEN_HINTS = {
  Facebook: 'Paste a Meta access token in the password field (Meta Business Suite → Graph API Explorer), or use the OAuth tab.',
  Instagram: 'Paste a Meta/Instagram access token in the password field, or use OAuth.',
  LinkedIn: 'Paste a LinkedIn access token in the password field, or save one in Settings → API, or use OAuth.',
  Twitter: 'Paste a Bearer/access token in the password field, or save keys in Settings, or use OAuth.',
  'Twitter / X': 'Paste a Bearer/access token in the password field, or save keys in Settings, or use OAuth.',
  YouTube: 'Enter your Google email + password to sign in and pull every channel on that account. Or leave password blank and set Username = @handle to look up a channel with your API key.',
  TikTok: 'Paste your TikTok access token in the password field, or use the OAuth tab.',
  Pinterest: 'Paste your Pinterest access token in the password field, or use OAuth.',
  Snapchat: 'Paste your Snapchat access token in the password field, or use OAuth.',
  Threads: 'Paste a Meta access token in the password field, or use OAuth.',
  Twitch: 'Paste your Twitch access token in the password field, or use OAuth.',
  Discord: 'Paste your Discord bot token or user access token in the password field.',
  Quora: 'Enter your Quora email and password. A browser window opens to save your session for automated answers.',
};

function encryptCredential(value) {
  if (!value) return null;
  return Buffer.from(value).toString('base64');
}

function looksLikeGoogleApiKey(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  return v.startsWith('AIza') && v.length >= 20 && !v.includes(' ');
}

function looksLikeMetaToken(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  return (v.startsWith('EAA') || v.startsWith('EAAG')) && v.length >= 20 && !v.includes(' ');
}

function looksLikeDiscordBotToken(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  return /^[MN][A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v);
}

function looksLikeAccessToken(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  if (!v || v.includes(' ')) return false;
  if (looksLikeBotToken(v) || looksLikeGoogleApiKey(v) || looksLikeMetaToken(v) || looksLikeDiscordBotToken(v)) {
    return true;
  }
  return v.length >= 20;
}

function looksLikeBotToken(value) {
  if (!value || typeof value !== 'string') return false;
  return /^\d+:[A-Za-z0-9_-]+$/.test(value.trim());
}

function looksLikeLoginPassword(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  if (!v || looksLikeAccessToken(v) || looksLikeGoogleApiKey(v)) return false;
  return v.length >= 6 && v.length <= 128;
}

function isGoogleAccountEmail(email) {
  const em = String(email || '').trim().toLowerCase();
  return /@(gmail|googlemail)\.com$/i.test(em) || /@google\.com$/i.test(em);
}

function wantsYouTubeGoogleSignIn({ email, password, username }) {
  const em = (email || username || '').trim();
  const pw = (password || '').trim();
  if (!pw || !isGoogleAccountEmail(em) || looksLikeGoogleApiKey(pw) || looksLikeAccessToken(pw)) return false;
  return looksLikeLoginPassword(pw);
}

async function redditPasswordGrant(keys, username, password) {
  const auth = Buffer.from(`${keys.rdId}:${keys.rdSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'password',
    username: username.replace(/^u\//, ''),
    password,
  });
  const res = await axios.post('https://www.reddit.com/api/v1/access_token', body, {
    headers: { Authorization: `Basic ${auth}`, 'User-Agent': UA },
  });
  return res.data;
}

function tokenAuthResult(platform, accessToken, loginEmail, user, extras = {}) {
  return {
    oauthTokens: { access_token: accessToken, ...extras },
    accessToken,
    loginEmail: loginEmail || user,
    method: 'token',
    encryptedPassword: encryptCredential(accessToken),
  };
}

async function authenticateWithCredentials(platform, keys, { email, password, username }, _openExternal) {
  const loginEmail = (email || username || '').trim().toLowerCase();
  const user = username || email;
  const pw = (password || '').trim();
  const storedToken = resolveSettingsToken(platform, keys);

  if (platform === 'Telegram') {
    const botToken = looksLikeBotToken(pw) ? pw : keys.telegramBotToken;
    if (!botToken) {
      throw new Error('Telegram: paste your @BotFather bot token in the password field, or save tgBotToken in Settings > API.');
    }
    return {
      oauthTokens: { access_token: botToken, chat_id: user || email },
      accessToken: botToken,
      loginEmail: loginEmail || user || 'telegram@bot',
      method: 'bot',
      encryptedPassword: encryptCredential(botToken),
    };
  }

  if (platform === 'WhatsApp') {
    const accessToken = looksLikeAccessToken(pw) ? pw : (keys.whatsappAccessToken || keys.metaAccess);
    const phoneNumberId = keys.whatsappPhoneNumberId || user || email;
    if (!accessToken) {
      throw new Error('WhatsApp: paste your Meta Business Access Token in the password field (or set waAccessToken in Settings).');
    }
    if (!phoneNumberId) {
      throw new Error('WhatsApp: enter your Phone Number ID in the email field (Meta Business > WhatsApp > API Setup).');
    }
    return {
      oauthTokens: { access_token: accessToken, phone_number_id: phoneNumberId },
      accessToken,
      loginEmail: loginEmail || phoneNumberId,
      method: 'business_api',
      encryptedPassword: encryptCredential(accessToken),
    };
  }

  if (platform === 'YouTube') {
    if (wantsYouTubeGoogleSignIn({ email, password: pw, username: user })) {
      return {
        oauthTokens: null,
        accessToken: null,
        loginEmail: loginEmail || user,
        method: 'google_signin',
        requiresGoogleOAuth: true,
        encryptedPassword: encryptCredential(pw),
      };
    }
    const apiKey = looksLikeGoogleApiKey(pw) ? pw : keys.youtubeApiKey;
    if (apiKey) {
      return {
        oauthTokens: { api_key: apiKey },
        accessToken: null,
        youtubeApiKey: apiKey,
        loginEmail: loginEmail || user,
        method: 'api_key',
      };
    }
  }

  if (platform === 'Discord' && (looksLikeDiscordBotToken(pw) || (!pw && keys.discordBotToken))) {
    const botToken = looksLikeDiscordBotToken(pw) ? pw : keys.discordBotToken;
    return {
      oauthTokens: { access_token: botToken, token_type: 'bot' },
      accessToken: null,
      discordBotToken: botToken,
      loginEmail: loginEmail || user,
      method: 'bot',
      encryptedPassword: encryptCredential(botToken),
    };
  }

  if (platform === 'Quora' && pw && looksLikeLoginPassword(pw)) {
    if (!loginEmail && !email) {
      throw new Error('Quora: enter your Quora account email in the email field.');
    }
    return {
      oauthTokens: null,
      accessToken: null,
      loginEmail: loginEmail || email,
      method: 'browser_session',
      requiresBrowserLogin: true,
      encryptedPassword: encryptCredential(pw),
    };
  }

  if (platform === 'Reddit' && pw && !looksLikeAccessToken(pw)) {
    if (!keys.rdId || !keys.rdSecret) {
      throw new Error('Reddit: add Client ID/Secret in Settings > API before using username + password.');
    }
    try {
      const oauthTokens = await redditPasswordGrant(keys, user, pw);
      return {
        oauthTokens,
        accessToken: oauthTokens.access_token,
        loginEmail: loginEmail || user,
        method: 'password',
        encryptedPassword: encryptCredential(pw),
      };
    } catch (e) {
      const status = e.response?.status;
      if (status === 401) {
        throw new Error('Reddit login failed: invalid username or password. Use your Reddit username (not email) in the username field.');
      }
      throw new Error(`Reddit login failed: ${e.response?.data?.error || e.message}`);
    }
  }

  if (['Twitter', 'X', 'Twitter / X'].includes(platform) && pw && looksLikeLoginPassword(pw)) {
    throw new Error(
      'X (Twitter) does not accept your website login password here. '
      + 'Use the OAuth tab in Linked Accounts to sign in with X, '
      + 'or paste a valid API access token in the password field. '
      + 'Also verify Client ID + Secret in Settings → API Integrations are current (expired keys cause 401 errors).',
    );
  }

  if (platform === 'LinkedIn' && pw && looksLikeLoginPassword(pw)) {
    throw new Error(
      'LinkedIn does not accept your website login password here. '
      + 'Use OAuth Connect (add LinkedIn Client ID + Secret in Integrations first), '
      + 'or paste a LinkedIn access token (starts with AQW…) in the password field.',
    );
  }

  if ((platform === 'Facebook' || platform === 'Instagram' || platform === 'Threads') && pw && looksLikeLoginPassword(pw)) {
    throw new Error(
      `${platform} does not accept your website login password here. `
      + 'Use OAuth Connect (Meta App ID + Secret in Integrations), '
      + 'or paste a Meta access token (starts with EAA…) in the password field.',
    );
  }

  const tokenFromPassword = looksLikeAccessToken(pw) ? pw : null;
  const effectiveToken = tokenFromPassword || storedToken || null;

  if (platform === 'YouTube' && effectiveToken && (looksLikeGoogleApiKey(effectiveToken) || looksLikeGoogleApiKey(pw) || keys.youtubeApiKey)) {
    const apiKey = looksLikeGoogleApiKey(pw) ? pw : (looksLikeGoogleApiKey(effectiveToken) ? effectiveToken : keys.youtubeApiKey);
    return {
      oauthTokens: { api_key: apiKey },
      accessToken: null,
      youtubeApiKey: apiKey,
      loginEmail: loginEmail || user,
      method: 'api_key',
    };
  }

  if (effectiveToken) {
    const extras = {};
    if (platform === 'WhatsApp') {
      extras.phone_number_id = user || email;
    }
    if (platform === 'Telegram' && user) {
      extras.chat_id = user;
    }
    return tokenAuthResult(platform, effectiveToken, loginEmail, user, extras);
  }

  if (looksLikeLoginPassword(pw)) {
    const hint = TOKEN_HINTS[platform] || `Paste your ${platform} API access token in the password field, or use the OAuth tab. Official APIs do not accept website login passwords.`;
    throw new Error(hint);
  }

  if (!loginEmail && !user && platform !== 'Telegram') {
    throw new Error('Enter your email (or username for Reddit) to identify this connection.');
  }

  const hint = TOKEN_HINTS[platform]
    || `Paste your ${platform} access token in the password field, save API keys in Settings, or use the OAuth tab.`;
  throw new Error(hint);
}

function makeConnectionId(platform, loginEmail) {
  const hash = crypto.createHash('sha256').update(`${platform}:${loginEmail}`).digest('hex').slice(0, 8);
  return `conn_${Date.now()}_${hash}`;
}

module.exports = {
  authenticateWithCredentials,
  encryptCredential,
  looksLikeAccessToken,
  looksLikeLoginPassword,
  isGoogleAccountEmail,
  wantsYouTubeGoogleSignIn,
  looksLikeBotToken,
  looksLikeGoogleApiKey,
  looksLikeDiscordBotToken,
  redditPasswordGrant,
  makeConnectionId,
  TOKEN_HINTS,
};