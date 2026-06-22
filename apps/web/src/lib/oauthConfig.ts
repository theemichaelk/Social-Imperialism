export const OAUTH_REDIRECT_URIS = [
  'https://www.socialimperialism.com/oauth/callback',
  'https://socialimperialism.com/oauth/callback',
] as const;

export const OAUTH_PRIMARY_REDIRECT = OAUTH_REDIRECT_URIS[0];

export const OAUTH_DESKTOP_REDIRECT = 'social-imperialism://oauth-callback';

export const OAUTH_PLATFORM_SETUP = [
  { platform: 'X / Twitter', console: 'https://developer.x.com/en/portal/dashboard', appType: 'Native or Web App', keys: 'TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET' },
  { platform: 'LinkedIn', console: 'https://www.linkedin.com/developers/apps', appType: 'Web application', keys: 'LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET' },
  { platform: 'Meta (FB/IG/Threads)', console: 'https://developers.facebook.com/apps', appType: 'Business — Facebook Login', keys: 'META_APP_ID, META_APP_SECRET' },
  { platform: 'YouTube (Google)', console: 'https://console.cloud.google.com/apis/credentials', appType: 'Web application', keys: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET' },
  { platform: 'TikTok', console: 'https://developers.tiktok.com/', appType: 'Web', keys: 'TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET' },
  { platform: 'Pinterest', console: 'https://developers.pinterest.com/', appType: 'Web', keys: 'PINTEREST_APP_ID, PINTEREST_APP_SECRET' },
  { platform: 'Reddit', console: 'https://www.reddit.com/prefs/apps', appType: 'web app', keys: 'REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET' },
  { platform: 'Discord', console: 'https://discord.com/developers/applications', appType: 'OAuth2', keys: 'DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET' },
  { platform: 'Twitch', console: 'https://dev.twitch.tv/console/apps', appType: 'Web', keys: 'TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET' },
] as const;