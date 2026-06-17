/**
 * Centralized API key resolution from .env + globalApiKeys localStorage.
 * Normalizes many legacy key names into a consistent schema.
 */

const ENV_ALIASES = {
  twId: ['TWITTER_CLIENT_ID', 'TWITTER_CONSUMER_KEY'],
  twSecret: ['TWITTER_CLIENT_SECRET', 'TWITTER_CONSUMER_SECRET'],
  twAccess: ['TWITTER_ACCESS_TOKEN'],
  twAccessSecret: ['TWITTER_ACCESS_SECRET', 'TWITTER_ACCESS_TOKEN_SECRET'],
  twBearer: ['TWITTER_BEARER_TOKEN', 'TWITTER_BEARER'],
  rdId: ['REDDIT_CLIENT_ID'],
  rdSecret: ['REDDIT_CLIENT_SECRET'],
  liId: ['LINKEDIN_CLIENT_ID'],
  liSecret: ['LINKEDIN_CLIENT_SECRET'],
  linkedinAccessToken: ['LINKEDIN_ACCESS_TOKEN'],
  fbId: ['META_APP_ID', 'FACEBOOK_APP_ID'],
  fbSecret: ['META_APP_SECRET', 'FACEBOOK_APP_SECRET'],
  metaAccess: ['META_ACCESS_TOKEN', 'META_API_KEY', 'FACEBOOK_ACCESS_TOKEN'],
  ytId: ['GOOGLE_CLIENT_ID', 'YOUTUBE_CLIENT_ID'],
  ytSecret: ['GOOGLE_CLIENT_SECRET', 'YOUTUBE_CLIENT_SECRET'],
  youtubeApiKey: ['YOUTUBE_API_KEY'],
  tkId: ['TIKTOK_CLIENT_KEY'],
  tkSecret: ['TIKTOK_CLIENT_SECRET'],
  pinterestAppId: ['PINTEREST_APP_ID'],
  pinterestSecret: ['PINTEREST_APP_SECRET'],
  snapchatClientId: ['SNAPCHAT_CLIENT_ID'],
  snapchatSecret: ['SNAPCHAT_CLIENT_SECRET'],
  discordClientId: ['DISCORD_CLIENT_ID'],
  discordClientSecret: ['DISCORD_CLIENT_SECRET'],
  discordBotToken: ['DISCORD_BOT_TOKEN'],
  telegramBotToken: ['TELEGRAM_BOT_TOKEN'],
  twitchClientId: ['TWITCH_CLIENT_ID'],
  twitchClientSecret: ['TWITCH_CLIENT_SECRET'],
  twitchStreamKey: ['TWITCH_STREAM_KEY'],
  gemini: ['GEMINI_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
  openai: ['OPENAI_API_KEY', 'OPENAI_API_KEY_1'],
  newsApiKey: ['NEWS_API_KEY'],
  unsplashAccessKey: ['UNSPLASH_ACCESS_KEY'],
  pexelsKey: ['PEXELS_API_KEY'],
  pixabayKey: ['PIXABAY_API_KEY'],
  falKey: ['FAL_KEY', 'FAL_API_KEY'],
  domDetailer: ['DOMDETAILER_API_KEY'],
  serpApiKey: ['SERP_API_KEY'],
  deeplKey: ['DEEPL_API_KEY'],
  tinyurlApiKey: ['TINYURL_API_KEY'],
  playhtUserId: ['PLAYHT_USER_ID'],
  playhtSecretKey: ['PLAYHT_SECRET_KEY'],
  contentfulSpaceId: ['CONTENTFUL_SPACE_ID'],
  contentfulAccessToken: ['CONTENTFUL_ACCESS_TOKEN'],
  advancedWorkflowKey: ['ADVANCED_WORKFLOW_KEY', 'GOOEY_API_KEY'],
};

const STORAGE_ALIASES = {
  twId: ['twitterClientId', 'twId'],
  twSecret: ['twitterClientSecret', 'twSecret'],
  twConsumerKey: ['twitterConsumerKey', 'twitterConsumerKey2', 'twConsumerKey'],
  twConsumerSecret: ['twitterConsumerSecret', 'twitterConsumerSecret2', 'twConsumerSecret'],
  twAccess: ['twitterAccessToken', 'twAccess'],
  twAccessSecret: ['twitterAccessSecret', 'twAccessSecret'],
  twBearer: ['twitterBearer', 'twitterBearer2', 'twBearer'],
  rdId: ['redditClientId', 'rdId'],
  rdSecret: ['redditClientSecret', 'rdSecret'],
  liId: ['linkedinClientId', 'liId'],
  liSecret: ['linkedinClientSecret', 'liSecret'],
  linkedinAccessToken: ['linkedinAccessToken'],
  fbId: ['fbId', 'metaAppId', 'facebookAppId'],
  fbSecret: ['fbSecret', 'metaAppSecret'],
  metaAccess: ['metaAccess', 'fbKey', 'meta', 'fbStreamingKey'],
  ytId: ['youtubeClientId', 'googleClientId1', 'ytId'],
  ytSecret: ['youtubeClientSecret', 'googleClientSecret1', 'ytSecret'],
  youtubeApiKey: ['youtubeApiKey'],
  tkId: ['tiktokClientKey', 'tkId'],
  tkSecret: ['tiktokClientSecret', 'tkSecret'],
  gemini: ['geminiKey', 'gemini'],
  openrouter: ['openrouterKey', 'openrouter'],
  falKey: ['falKey', 'fal'],
  domDetailer: ['domDetailerKey', 'domDetailer'],
  newsApiKey: ['newsApiKey'],
  unsplashAccessKey: ['unsplashAccessKey'],
  pexelsKey: ['pexelsKey'],
  pixabayKey: ['pixabayKey'],
  serpApiKey: ['serpApiKey'],
  deeplKey: ['deeplKey'],
  discordClientId: ['discordClientId', 'dcId'],
  discordClientSecret: ['discordClientSecret', 'dcSecret'],
  discordBotToken: ['discordBotToken'],
  pinterestAppId: ['pinterestAppId', 'pnId'],
  pinterestSecret: ['pinterestSecret', 'pnSecret'],
  snapchatClientId: ['snapchatClientId', 'scId'],
  snapchatSecret: ['snapchatSecret', 'scSecret'],
  telegramBotToken: ['telegramBotToken', 'tgBotToken'],
  whatsappPhoneNumberId: ['whatsappPhoneNumberId', 'waPhoneId'],
  whatsappAccessToken: ['whatsappAccessToken', 'waAccessToken'],
  twitchClientId: ['twitchClientId', 'twitchId'],
  twitchClientSecret: ['twitchClientSecret', 'twitchSecret'],
  twitchStreamKey: ['twitchStreamKey'],
};

function firstDefined(sources, keys) {
  for (const k of keys) {
    const v = sources[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

function resolveKeys(globalKeys = {}) {
  const keys = { ...globalKeys };

  for (const [canonical, envNames] of Object.entries(ENV_ALIASES)) {
    if (!keys[canonical]) {
      const fromEnv = firstDefined(process.env, envNames);
      if (fromEnv) keys[canonical] = fromEnv;
    }
  }

  for (const [canonical, storageNames] of Object.entries(STORAGE_ALIASES)) {
    if (!keys[canonical]) {
      const fromStorage = firstDefined(globalKeys, storageNames);
      if (fromStorage) keys[canonical] = fromStorage;
    }
  }

  if (keys.geminiKey && !keys.gemini) keys.gemini = keys.geminiKey;
  if (keys.openrouterKey && !keys.openrouter) keys.openrouter = keys.openrouterKey;
  if (keys.falKey && !keys.fal) keys.fal = keys.falKey;
  if (keys.domDetailerKey && !keys.domDetailer) keys.domDetailer = keys.domDetailerKey;
  if (keys.advancedWorkflowKey && !keys.advancedWorkflow) keys.advancedWorkflow = keys.advancedWorkflowKey;

  return keys;
}

function twitterConsumerKey(keys) {
  return keys.twConsumerKey || keys.twitterConsumerKey || null;
}

function twitterConsumerSecret(keys) {
  return keys.twConsumerSecret || keys.twitterConsumerSecret || null;
}

function hasTwitterKeys(keys) {
  const ck = twitterConsumerKey(keys);
  const cs = twitterConsumerSecret(keys);
  return !!(
    keys.twBearer
    || (keys.twId && keys.twSecret)
    || (keys.twAccess && keys.twAccessSecret && ck && cs)
  );
}

function hasRedditKeys(keys) {
  return !!(keys.rdId && keys.rdSecret);
}

function hasLinkedInKeys(keys) {
  return !!keys.linkedinAccessToken || !!(keys.liId && keys.liSecret);
}

function hasMetaKeys(keys) {
  return !!keys.metaAccess || !!(keys.fbId && keys.fbSecret);
}

function hasYouTubeKeys(keys) {
  return !!keys.youtubeApiKey || !!(keys.ytId && keys.ytSecret);
}

function hasTikTokKeys(keys) {
  return !!(keys.tkId && keys.tkSecret);
}

function hasPinterestKeys(keys) {
  return !!(keys.pinterestAppId && keys.pinterestSecret);
}

function hasSnapchatKeys(keys) {
  return !!(keys.snapchatClientId && keys.snapchatSecret);
}

function hasTelegramKeys(keys) {
  return !!keys.telegramBotToken;
}

function hasWhatsAppKeys(keys) {
  return !!(keys.whatsappAccessToken && keys.whatsappPhoneNumberId)
    || !!(keys.metaAccess && keys.whatsappPhoneNumberId);
}

function hasTwitchKeys(keys) {
  return !!(keys.twitchClientId && keys.twitchClientSecret);
}

/** Tokens saved in Settings / .env usable when connecting via Email & Password tab */
function resolveSettingsToken(platform, keys) {
  switch (platform) {
    case 'LinkedIn':
      return keys.linkedinAccessToken || null;
    case 'Facebook':
    case 'Instagram':
    case 'Threads':
      return keys.metaAccess || null;
    case 'Twitter':
    case 'X':
    case 'Twitter / X':
      return keys.twBearer || keys.twAccess || null;
    case 'YouTube':
      return keys.youtubeApiKey || null;
    case 'Discord':
      return keys.discordBotToken || null;
    case 'Telegram':
      return keys.telegramBotToken || null;
    case 'WhatsApp':
      return keys.whatsappAccessToken || keys.metaAccess || null;
    case 'Reddit':
    case 'TikTok':
    case 'Pinterest':
    case 'Snapchat':
    case 'Twitch':
    default:
      return null;
  }
}

function hasStoredConnectToken(platform, keys) {
  return !!resolveSettingsToken(platform, keys);
}

module.exports = {
  resolveKeys,
  twitterConsumerKey,
  twitterConsumerSecret,
  hasTwitterKeys,
  hasRedditKeys,
  hasLinkedInKeys,
  hasMetaKeys,
  hasYouTubeKeys,
  hasTikTokKeys,
  hasPinterestKeys,
  hasSnapchatKeys,
  hasTelegramKeys,
  hasWhatsAppKeys,
  hasTwitchKeys,
  resolveSettingsToken,
  hasStoredConnectToken,
  ENV_ALIASES,
};