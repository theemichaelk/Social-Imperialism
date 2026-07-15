/** Platform connection guidance — mirrors apps/desktop/services/connectionService.js */
export const CONNECT_HINTS: Record<string, string> = {
  Twitter: 'Save password & connect stores your login for automations. For full API: add X Client ID + Secret, or paste access token as password.',
  X: 'Save password & connect stores login. Full API needs X Client ID + Secret or access token.',
  'Twitter / X': 'Save password & connect stores login. Full API needs X Client ID + Secret or access token.',
  YouTube: 'Enter Google email + password → Save password & connect pulls every channel when OAuth keys exist; credentials stay on file for automations.',
  TikTok: 'Enter email + password → Save password & connect. Add TikTok Client Key/Secret for full API pages.',
  Pinterest: 'Enter email + password → Save password & connect. Add Pinterest App ID/Secret for full API.',
  Snapchat: 'Enter email + password → Save password & connect. Add Snapchat Client ID/Secret for full API.',
  Telegram: 'Password = @BotFather bot token. Optional username = @channel or chat ID.',
  WhatsApp: 'Email = Phone Number ID. Password = Meta Business Access Token (EAA…).',
  Facebook: 'Enter email + password → Save password & connect (credentials + profile shell). Or paste Meta token (EAA…). OAuth for full pages list.',
  Instagram: 'Enter email + password → Save password & connect. Or Meta token / OAuth for full Graph data.',
  Threads: 'Enter email + password → Save password & connect. Or Meta token / OAuth for full Graph data.',
  Twitch: 'Enter email + password → Save password & connect. Add Twitch Client ID/Secret for full API.',
  Reddit: 'Username + password (or token) → Save password & connect. Client ID/Secret enables password grant + subreddits.',
  Quora: 'Email + password → Save password & connect (browser session for automated answers).',
  LinkedIn: 'Email + password → Save password & connect opens browser when OAuth is ready; company pages import after authorize. Or paste AQW… token.',
  Discord: 'Email + password or bot token → Save password & connect. OAuth Client ID for full guild import.',
};

export function connectHintFor(platform: string): string {
  return CONNECT_HINTS[platform] || 'Use OAuth for app authorization, or Email & Password for direct login / API tokens.';
}