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
  redditUsername: ['REDDIT_USERNAME'],
  redditPassword: ['REDDIT_PASSWORD'],
  redditAccessToken: ['REDDIT_ACCESS_TOKEN'],
  rdAccess: ['REDDIT_ACCESS_TOKEN'],
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
  unsplashAppId: ['UNSPLASH_APPLICATION_ID'],
  unsplashSecretKey: ['UNSPLASH_SECRET_KEY'],
  pexelsKey: ['PEXELS_API_KEY'],
  pixabayKey: ['PIXABAY_API_KEY'],
  flickrKey: ['FLICKR_API_KEY', 'FLICKR_KEY'],
  flickrSecret: ['FLICKR_SECRET'],
  flickrKey2: ['FLICKR_API_KEY_2'],
  flickrSecret2: ['FLICKR_SECRET_2'],
  falKey: ['FAL_KEY', 'FAL_API_KEY'],
  domDetailer: ['DOMDETAILER_API_KEY'],
  serpApiKey: ['SERP_API_KEY'],
  deeplKey: ['DEEPL_API_KEY'],
  tinyurlApiKey: ['TINYURL_API_KEY'],
  playhtUserId: ['PLAYHT_USER_ID'],
  playhtSecretKey: ['PLAYHT_SECRET_KEY'],
  contentfulSpaceId: ['CONTENTFUL_SPACE_ID'],
  contentfulAccessToken: ['CONTENTFUL_ACCESS_TOKEN'],
  contentfulEnvironment: ['CONTENTFUL_ENVIRONMENT'],
  contentStudioApiKey: ['CONTENT_STUDIO_API_KEY'],
  mozAccessId: ['MOZ_ACCESS_ID'],
  mozSecret: ['MOZ_SECRET_KEY'],
  advancedWorkflowKey: ['ADVANCED_WORKFLOW_KEY', 'GOOEY_API_KEY'],
  twitchRtmpServer: ['TWITCH_RTMP_SERVER'],
  twitchUsername: ['TWITCH_USERNAME'],
  fbStreamingKey: ['FB_STREAMING_KEY', 'META_STREAMING_KEY'],
  fbTechLauncherKey: ['FB_TECH_LAUNCHER_STREAM_KEY'],
  fbStoneBuildersKey: ['FB_STONE_BUILDERS_STREAM_KEY'],
  fbFunicsKey: ['FB_FUNICS_STREAM_KEY'],
  fbRtmpServer: ['FB_RTMP_SERVER'],
  ytStreamKeyTsbr: ['YOUTUBE_STREAM_KEY_TSBR'],
  ytStreamKeyFunics: ['YOUTUBE_STREAM_KEY_FUNICS'],
  streamrClientId: ['STREAMR_CLIENT_ID'],
  streamrClientSecret: ['STREAMR_CLIENT_SECRET'],
  streamingKeys: ['STREAMING_KEYS'],
  instagramSessions: ['INSTAGRAM_SESSIONS'],
  twitterKeys: ['TWITTER_KEYS_BUNDLE'],
  googleClients: ['GOOGLE_CLIENTS_BUNDLE'],
  openrouter2: ['OPENROUTER_API_KEY_2'],
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
  redditUsername: ['redditUsername'],
  redditPassword: ['redditPassword'],
  redditAccessToken: ['redditAccessToken', 'rdAccess'],
  rdAccess: ['redditAccessToken', 'rdAccess'],
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
  unsplashAppId: ['unsplashApplicationId'],
  unsplashSecretKey: ['unsplashSecretKey'],
  pexelsKey: ['pexelsKey'],
  pixabayKey: ['pixabayKey'],
  flickrKey: ['flickrKey'],
  flickrSecret: ['flickrSecret'],
  flickrKey2: ['flickrKey2'],
  flickrSecret2: ['flickrSecret2'],
  serpApiKey: ['serpApiKey'],
  deeplKey: ['deeplKey'],
  tinyurlApiKey: ['tinyurlApiKey'],
  playhtUserId: ['playhtUserId'],
  playhtSecretKey: ['playhtSecretKey'],
  contentfulSpaceId: ['contentfulSpaceId'],
  contentfulAccessToken: ['contentfulAccessToken'],
  contentfulEnvironment: ['contentfulEnvironment'],
  contentStudioApiKey: ['contentStudioApiKey'],
  mozAccessId: ['mozAccessId'],
  mozSecret: ['mozSecret'],
  advancedWorkflowKey: ['advancedWorkflowKey', 'advancedWorkflow'],
  fbStreamingKey: ['fbStreamingKey', 'metaAccess'],
  fbTechLauncherKey: ['fbTechLauncherKey'],
  fbStoneBuildersKey: ['fbStoneBuildersKey'],
  fbFunicsKey: ['fbFunicsKey'],
  fbRtmpServer: ['fbRtmpServer'],
  ytStreamKeyTsbr: ['ytStreamKeyTsbr'],
  ytStreamKeyFunics: ['ytStreamKeyFunics'],
  streamrClientId: ['streamrClientId'],
  streamrClientSecret: ['streamrClientSecret'],
  streamingKeys: ['streamingKeys'],
  instagramSessions: ['instagramSessions'],
  twitterKeys: ['twitterKeys'],
  googleClients: ['googleClients'],
  openrouter2: ['openrouter2'],
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
  if (keys.youtubeClientId && !keys.ytId) keys.ytId = keys.youtubeClientId;
  if (keys.youtubeClientSecret && !keys.ytSecret) keys.ytSecret = keys.youtubeClientSecret;
  if (keys.redditClientId && !keys.rdId) keys.rdId = keys.redditClientId;
  if (keys.redditClientSecret && !keys.rdSecret) keys.rdSecret = keys.redditClientSecret;
  if (keys.domDetailerKey && !keys.domDetailer) keys.domDetailer = keys.domDetailerKey;

  return keys;
}

function hasMediaKeys(keys) {
  return !!(keys.unsplashAccessKey || keys.pexelsKey || keys.pixabayKey || keys.flickrKey || keys.flickrKey2);
}

function hasAdvancedWorkflowKey(keys) {
  return !!(keys.advancedWorkflowKey || keys.advancedWorkflow);
}

function hasContentStudioKey(keys) {
  return !!keys.contentStudioApiKey;
}

function hasMozKeys(keys) {
  return !!(keys.mozAccessId && keys.mozSecret);
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
  hasMediaKeys,
  hasAdvancedWorkflowKey,
  hasContentStudioKey,
  hasMozKeys,
  ENV_ALIASES,
};