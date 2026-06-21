import { INTEGRATION_GROUPS } from '@/lib/integrationCatalog';

export const SUPPORTED_PLATFORMS = [
  'Twitter', 'LinkedIn', 'Facebook', 'Instagram', 'YouTube', 'TikTok',
  'Pinterest', 'Reddit', 'Threads', 'Twitch', 'Telegram', 'Discord',
] as const;

export type PlatformConnection = {
  platform: string;
  icon: string;
  color: string;
  metric: string;
  keyFields: string[];
  hint: string;
};

export const PLATFORM_CONNECTIONS: PlatformConnection[] = [
  { platform: 'Twitter', icon: '𝕏', color: '#38bdf8', metric: 'Twitter / X', keyFields: ['twId', 'twSecret', 'twBearer', 'twAccess', 'twAccessSecret'], hint: 'OAuth + bearer for posting' },
  { platform: 'LinkedIn', icon: 'in', color: '#0ea5e9', metric: 'LinkedIn', keyFields: ['linkedinAccessToken'], hint: 'Access token for profile API' },
  { platform: 'Facebook', icon: 'f', color: '#3b82f6', metric: 'Meta / Facebook', keyFields: ['fbId', 'fbSecret', 'metaAccess'], hint: 'Meta app + page token' },
  { platform: 'Instagram', icon: '📷', color: '#ec4899', metric: 'Meta / Facebook', keyFields: ['fbId', 'fbSecret', 'metaAccess'], hint: 'Uses Meta Graph API' },
  { platform: 'YouTube', icon: '▶', color: '#ef4444', metric: 'YouTube', keyFields: ['ytId', 'ytSecret', 'youtubeApiKey'], hint: 'OAuth + Data API key' },
  { platform: 'TikTok', icon: '♪', color: '#f472b6', metric: 'TikTok', keyFields: ['tkId', 'tkSecret'], hint: 'TikTok developer app' },
  { platform: 'Pinterest', icon: 'P', color: '#f43f5e', metric: 'Pinterest', keyFields: ['pinterestAppId', 'pinterestSecret'], hint: 'Pinterest app credentials — OAuth for profile pins' },
  { platform: 'Reddit', icon: 'R', color: '#f97316', metric: 'Reddit OAuth', keyFields: ['rdId', 'rdSecret'], hint: 'Reddit OAuth app' },
  { platform: 'Threads', icon: '@', color: '#a78bfa', metric: 'Meta / Facebook', keyFields: ['fbId', 'fbSecret', 'metaAccess'], hint: 'Meta Threads via Graph' },
  { platform: 'Twitch', icon: '⬛', color: '#a855f7', metric: 'Twitch', keyFields: ['twitchClientId', 'twitchClientSecret', 'twitchStreamKey'], hint: 'Twitch Helix + stream key' },
  { platform: 'Telegram', icon: '✈', color: '#22d3ee', metric: 'Telegram', keyFields: ['telegramBotToken'], hint: 'Bot token — create via @BotFather' },
  { platform: 'Discord', icon: '◆', color: '#6366f1', metric: 'Discord', keyFields: ['discordClientId', 'discordBotToken'], hint: 'Bot token for server profiles' },
];

export const CREATOR_ENGINE_KEYS = ['gemini', 'openrouter', 'openai', 'falKey', 'advancedWorkflowKey', 'unsplashAccessKey', 'unsplashAppId'];

export function getFieldMeta(key: string) {
  for (const g of INTEGRATION_GROUPS) {
    const f = g.fields.find((x) => x.key === key);
    if (f) return { ...f, group: g };
  }
  return null;
}

export function platformConnectionStatus(
  platform: PlatformConnection,
  keys: Record<string, string>,
  apiStatus: Record<string, string>,
): 'connected' | 'partial' | 'empty' {
  if (platform.metric && apiStatus[platform.metric] === 'Connected') return 'connected';
  const set = platform.keyFields.filter((k) => keys[k]?.trim()).length;
  if (set > 0) return 'partial';
  return 'empty';
}