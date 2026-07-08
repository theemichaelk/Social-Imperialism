export type DiscoveredTarget = {
  id: string;
  platform: string;
  type: 'account' | 'page' | 'community' | 'post' | 'keyword' | string;
  term: string;
  label?: string;
  url?: string | null;
  followers?: number;
  subscribers?: number;
  activityScore?: number;
  rankScore?: number;
  postCount?: number;
  engagementTotal?: number;
  matchedKeywords?: string[];
  samplePost?: string;
  source?: string;
};

export type DiscoverKeywordTargetsResult = {
  success?: boolean;
  error?: string;
  keywords?: string[];
  targets?: DiscoveredTarget[];
  postCount?: number;
  scannedPlatforms?: string[];
};

export type WatchMonitor = {
  id?: string;
  term?: string;
  label?: string;
  platform?: string;
  type?: string;
  target?: string;
  url?: string;
  added?: string;
  enabled?: boolean;
};

export function formatAudienceCount(target: DiscoveredTarget): string {
  const n = target.subscribers || target.followers || 0;
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function monitorMatchesTarget(
  monitors: WatchMonitor[],
  target: DiscoveredTarget,
): boolean {
  const term = String(target.term || '').toLowerCase();
  const platform = target.platform || 'All';
  return monitors.some((m) => {
    const mTerm = String(m.term || m.target || m.label || '').toLowerCase();
    const mPlatform = m.platform || 'All';
    const platformOk = mPlatform === 'All' || platform === 'All' || mPlatform === platform;
    return platformOk && (mTerm === term || mTerm.includes(term) || term.includes(mTerm));
  });
}

export function targetToMonitor(target: DiscoveredTarget): WatchMonitor {
  const type = target.type === 'community' ? 'page' : target.type;
  return {
    id: `mon_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    term: target.term,
    label: target.label || target.term,
    type: type || 'account',
    target: target.term,
    platform: target.platform || 'All',
    url: target.url || undefined,
    added: new Date().toISOString(),
    enabled: true,
  };
}

export function parseKeywordInput(input: string): string[] {
  return String(input || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}