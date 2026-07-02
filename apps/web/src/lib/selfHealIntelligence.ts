/**
 * THEE_MICHAEL Self-Heal Intelligence — daily recommendations, error journal, learnings
 */
import { apiFetch } from '@/lib/api';

export type SelfHealRecommendation = {
  category: string;
  title: string;
  action: string;
  href: string;
  priority: number;
  topic?: string;
};

export type SelfHealStatus = {
  journal: {
    total: number;
    openErrors: number;
    recentFixes: Array<{ fixAction?: string; message?: string; ts: string }>;
    recentErrors: Array<{ errorCode?: string; rootCause?: string; message?: string; ts: string }>;
  };
  lastAudit: {
    status: string;
    checksPassed: number;
    checksRun: number;
    autoFixesApplied: number;
    ts: string;
  } | null;
  learning: Array<{ topic: string; insight: string; ts: string }>;
  recommendations: {
    generatedAt: string | null;
    count: number;
    items: SelfHealRecommendation[];
  };
  promptAppend?: string;
};

const RECS_CACHE_KEY = 'si_self_heal_recs';
const RECS_CACHE_TTL_MS = 4 * 60 * 60 * 1000;

export const SELF_HEAL_EXPERT_APPEND = `
Self-heal protocol active: you maintain a documented error journal, apply safe daily auto-fixes, and learn from every fix.
- Reference DAILY RECOMMENDATIONS and SELF-HEAL INTELLIGENCE blocks when advising — they come from live audits + SEO data + Guardian scans.
- For open documented errors, explain root cause + documented fix before suggesting new actions.
- Proactively recommend improvements across SEO, content, engagement, integrations, and brand — not only when asked.
- When users ask "what should I improve", lead with top 3 daily recommendations sorted by priority.
- Self-audit runs daily; users can trigger manual audit via "run audit now" in support.
`;

export async function fetchSelfHealStatus(): Promise<SelfHealStatus | null> {
  try {
    const res = await apiFetch('/api/self-heal/status') as SelfHealStatus & { success?: boolean };
    if (!res.success && !res.recommendations) return null;
    return res;
  } catch {
    return null;
  }
}

export async function fetchDailyRecommendations(): Promise<SelfHealStatus['recommendations'] | null> {
  if (typeof window !== 'undefined') {
    try {
      const cached = JSON.parse(localStorage.getItem(RECS_CACHE_KEY) || 'null') as {
        ts: number;
        data: SelfHealStatus['recommendations'];
      } | null;
      if (cached && Date.now() - cached.ts < RECS_CACHE_TTL_MS) return cached.data;
    } catch { /* ignore */ }
  }

  try {
    const res = await apiFetch('/api/self-heal/recommendations/daily') as {
      success?: boolean;
      recommendations?: SelfHealStatus['recommendations'];
    };
    if (!res.recommendations) return null;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(RECS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: res.recommendations }));
      } catch { /* ignore */ }
    }
    return res.recommendations;
  } catch {
    return null;
  }
}

export async function runSelfHealAudit(): Promise<{ success: boolean; audit?: unknown; recommendations?: SelfHealRecommendation[] }> {
  try {
    const res = await apiFetch('/api/self-heal/audit/run', { method: 'POST', body: JSON.stringify({}) }) as {
      success?: boolean;
      audit?: unknown;
      recommendations?: SelfHealRecommendation[];
    };
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(RECS_CACHE_KEY); } catch { /* ignore */ }
    }
    return { success: !!res.success, audit: res.audit, recommendations: res.recommendations };
  } catch {
    return { success: false };
  }
}

export function formatRecommendationsForPrompt(recs: SelfHealStatus['recommendations'] | null): string {
  if (!recs?.items?.length) return '';
  const lines = [
    '',
    '--- DAILY USER RECOMMENDATIONS (self-audit + SEO + Guardian data) ---',
    `Generated: ${recs.generatedAt?.slice(0, 16) || 'recent'}`,
  ];
  for (const r of recs.items.slice(0, 6)) {
    lines.push(`- [${r.category}] ${r.title} → ${r.action} (route: ${r.href})`);
  }
  lines.push('Prioritize highest-impact recommendations. Offer [[NAV:...]] for top action.');
  lines.push('--- END DAILY RECOMMENDATIONS ---');
  return lines.join('\n');
}

export function buildSelfHealAugmentedContext(status: SelfHealStatus | null): string {
  if (!status) return '';
  const recBlock = formatRecommendationsForPrompt(status.recommendations);
  const journalBlock = status.promptAppend || '';
  return `${recBlock}${journalBlock}`;
}

export function formatRecommendationsBanner(recs: SelfHealStatus['recommendations'] | null): string | null {
  if (!recs?.items?.length) return null;
  const top = recs.items.slice(0, 3);
  return `**Today's top improvements** (${recs.generatedAt?.slice(0, 10) || 'daily'}):\n${
    top.map((r, i) => `${i + 1}. **${r.title}** — ${r.action}`).join('\n')
  }`;
}