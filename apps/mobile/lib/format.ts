export function compactNumber(n: number | null | undefined): string {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return '0';
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(v));
}

export function engagementRate(engagement: number, posts: number): string {
  if (!posts) return '0%';
  const rate = (engagement / Math.max(posts, 1)) * 100;
  if (rate >= 100) return `${Math.round(rate)}%`;
  return `${rate.toFixed(1)}%`;
}

export function platformColor(platform: string | undefined, palette: Record<string, string>): string {
  const p = String(platform || '').toLowerCase();
  if (p.includes('twitter') || p === 'x' || p.includes('x (')) return palette.x || palette.twitter;
  if (p.includes('linkedin')) return palette.linkedin;
  if (p.includes('reddit')) return palette.reddit;
  if (p.includes('facebook')) return palette.facebook;
  if (p.includes('instagram')) return palette.instagram;
  if (p.includes('youtube')) return palette.youtube;
  if (p.includes('tiktok')) return palette.tiktok;
  if (p.includes('quora')) return palette.quora;
  return palette.default;
}

export function platformShort(platform: string | undefined): string {
  const p = String(platform || '').toLowerCase();
  if (p.includes('twitter') || p === 'x' || p.includes('x (')) return 'X';
  if (p.includes('linkedin')) return 'LinkedIn';
  if (p.includes('reddit')) return 'Reddit';
  if (p.includes('facebook')) return 'Facebook';
  if (p.includes('instagram')) return 'IG';
  if (p.includes('youtube')) return 'YouTube';
  if (p.includes('tiktok')) return 'TikTok';
  if (p.includes('quora')) return 'Quora';
  return platform || 'Social';
}

export function clip(text: string | undefined, max = 160): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function relativeTime(iso?: string | number | Date): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
