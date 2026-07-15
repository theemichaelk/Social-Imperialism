/** Platform connection guidance — mirrors apps/desktop/services/connectionService.js */
export const CONNECT_HINTS: Record<string, string> = {
  Twitter: 'OAuth: add X Client ID + Secret in Settings → Integrations. Email & Password: paste access token as password.',
  X: 'OAuth: add X Client ID + Secret in Settings → Integrations.',
  'Twitter / X': 'OAuth: add X Client ID + Secret in Settings → Integrations.',
  YouTube: 'Email & Password: enter Google email + password to sign in and pull every channel. OAuth: uses Google Cloud app (add redirect URI in Settings).',
  TikTok: 'Settings → Integrations: TikTok Client Key/Secret, then OAuth.',
  Pinterest: 'Settings → Integrations: Pinterest App ID/Secret, then OAuth.',
  Snapchat: 'Settings → Integrations: Snapchat Client ID/Secret, then OAuth.',
  Telegram: 'Email & Password: password = @BotFather bot token. Username = @channel or chat ID (optional).',
  WhatsApp: 'Email & Password: email = Phone Number ID, password = Meta Business Access Token.',
  Facebook: 'OAuth with Meta app, or paste access token as password.',
  Instagram: 'OAuth via Meta app credentials.',
  Threads: 'OAuth via Meta app credentials.',
  Twitch: 'OAuth: Twitch Client ID/Secret in Settings → Integrations.',
  Reddit: 'Email & Password: username + password or token. OAuth: add redirect URI in Reddit app settings.',
  Quora: 'Email & Password: Quora email + password opens a browser session to save cookies.',
  LinkedIn: 'OAuth recommended: add Client ID + Secret under Integrations → Social OAuth, then OAuth Connect. Token path: paste access token (AQW…) as password — not your website password.',
  Discord: 'OAuth or paste bot token as password.',
};

export function connectHintFor(platform: string): string {
  return CONNECT_HINTS[platform] || 'Use OAuth for app authorization, or Email & Password for direct login / API tokens.';
}