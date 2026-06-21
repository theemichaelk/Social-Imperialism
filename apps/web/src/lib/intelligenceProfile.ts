export type IntelligenceProfile = {
  followers?: string | number;
  likes?: string | number;
  bestTime?: string;
  topTrendingNiche?: string;
  growthVelocity?: string;
  suggestedGroups?: string[];
};

export type LinkedAccountIntel = {
  id: string;
  platform: string;
  handle?: string;
  username?: string;
  type?: string;
  profile?: unknown;
  profileRefreshedAt?: string;
};

export type IntelligenceSettings = {
  enabled: boolean;
  surfaces: string[];
  autoSuggestScheduling: boolean;
  autoSuggestNiches: boolean;
  autoSuggestCommunities: boolean;
};

export const INTELLIGENCE_SURFACES = [
  { id: 'account-hub', label: 'Account Hub' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'calendar', label: 'Content Calendar' },
  { id: 'content-hub', label: 'Content Hub' },
  { id: 'browse-posts', label: 'Browse Posts' },
  { id: 'rules', label: 'Automation Rules' },
  { id: 'account-creator', label: 'Account Creator' },
] as const;

export const DEFAULT_INTELLIGENCE_SETTINGS: IntelligenceSettings = {
  enabled: true,
  surfaces: INTELLIGENCE_SURFACES.map((s) => s.id),
  autoSuggestScheduling: true,
  autoSuggestNiches: true,
  autoSuggestCommunities: true,
};

export function normalizeProfile(raw: unknown): IntelligenceProfile | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === 'object' && parsed ? (parsed as IntelligenceProfile) : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw as IntelligenceProfile;
  return null;
}

export function formatProfileValue(v: string | number | undefined): string {
  if (v == null || v === '') return '—';
  return String(v);
}

export type IntelligenceRecommendation = {
  id: string;
  kind: 'schedule' | 'niche' | 'community' | 'growth' | 'audience';
  label: string;
  detail: string;
  action?: string;
};

export function buildRecommendations(
  profile: IntelligenceProfile | null,
  account?: Pick<LinkedAccountIntel, 'platform' | 'handle' | 'type'>,
  settings?: Partial<IntelligenceSettings>,
): IntelligenceRecommendation[] {
  if (!profile) return [];
  const out: IntelligenceRecommendation[] = [];
  const platform = account?.platform || 'Account';
  const handle = account?.handle || account?.type || '';

  if (settings?.autoSuggestScheduling !== false && profile.bestTime && profile.bestTime !== '—') {
    out.push({
      id: 'best-time',
      kind: 'schedule',
      label: 'Best time to post',
      detail: profile.bestTime,
      action: `Schedule ${platform} content during this window`,
    });
  }
  if (settings?.autoSuggestNiches !== false && profile.topTrendingNiche && profile.topTrendingNiche !== '—') {
    out.push({
      id: 'niche',
      kind: 'niche',
      label: 'Trending niche',
      detail: profile.topTrendingNiche,
      action: `Target keywords and replies around ${profile.topTrendingNiche}`,
    });
  }
  if (settings?.autoSuggestCommunities !== false && profile.suggestedGroups?.length) {
    out.push({
      id: 'communities',
      kind: 'community',
      label: 'Suggested communities',
      detail: profile.suggestedGroups.join(', '),
      action: `Engage in these ${platform} communities for ${handle || 'this account'}`,
    });
  }
  if (profile.growthVelocity && profile.growthVelocity !== '—') {
    out.push({
      id: 'growth',
      kind: 'growth',
      label: 'Growth signal',
      detail: profile.growthVelocity,
      action: 'Track velocity in dashboard metrics',
    });
  }
  if (profile.followers && profile.followers !== '—') {
    out.push({
      id: 'audience',
      kind: 'audience',
      label: 'Audience',
      detail: formatProfileValue(profile.followers),
      action: 'Size content ambition to current reach',
    });
  }
  return out;
}

export function workspaceTitle(account: Pick<LinkedAccountIntel, 'platform' | 'type' | 'handle' | 'username'>): string {
  const type = account.type ? ` (${account.type})` : '';
  return `Workspace — ${account.platform}${type}`;
}