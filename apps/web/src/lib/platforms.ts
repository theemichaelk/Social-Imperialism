/** Canonical 15-platform list — single source for web UI (matches platformCatalog.js). */
export const PLATFORM_GROUPS = [
  {
    id: 'social',
    label: 'Social & Content',
    platforms: ['Facebook', 'Instagram', 'WhatsApp', 'YouTube', 'TikTok', 'Twitter', 'Pinterest', 'Snapchat', 'Threads', 'Twitch'],
  },
  {
    id: 'professional',
    label: 'Professional & Community',
    platforms: ['LinkedIn', 'Reddit', 'Quora', 'Discord'],
  },
  {
    id: 'messaging',
    label: 'Messaging & Other',
    platforms: ['Telegram'],
  },
] as const;

export const ALL_PLATFORMS = PLATFORM_GROUPS.flatMap((g) => g.platforms);

export const BROWSE_PLATFORMS = ['All', ...ALL_PLATFORMS, 'News'] as const;

export const INTENT_TAGS = [
  { id: 'brand', label: 'Brand mentions' },
  { id: 'affiliate', label: 'Affiliate product' },
  { id: 'client', label: 'Client brand' },
  { id: 'qa', label: 'Q&A questions' },
] as const;

export function platformDisplayName(p: string): string {
  if (p === 'Twitter') return 'X (Twitter)';
  return p;
}

export function normalizePlatformFilter(p: string): string {
  if (!p || p === 'All') return p;
  if (p === 'X' || p.includes('Twitter')) return 'Twitter';
  return p;
}