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

const RECS_CACHE_KEY = 'si_self_heal_recs_v2';
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

export type DailyRecsPreview = {
  dateLabel: string;
  items: SelfHealRecommendation[];
};

const SEO_FRAMEWORK_TITLE_PREFIX =
  /^(?:National|Research|Local|AEO|GEO|Keyword|Technical):\s+/i;

/** Legacy API titles → cleaner daily-rec labels. */
export function formatRecDisplayTitle(title: string): string {
  if (/^no keywords monitored$/i.test(title.trim())) return 'Add monitored keywords';

  const frameworkStripped = title.replace(SEO_FRAMEWORK_TITLE_PREFIX, '').trim();
  if (frameworkStripped && frameworkStripped !== title) return frameworkStripped;

  const m = title.match(/^([^:]+):\s*(.+)$/);
  if (!m) return title;
  const prefix = m[1].trim();
  const rest = m[2].trim();
  if (rest.toLowerCase().startsWith(prefix.toLowerCase())) return rest;
  return title;
}

/** Replace audit-query placeholder keywords in cached rec actions. */
export function formatRecDisplayAction(action: string): string {
  return action
    .replace(/Run KGR on "daily growth audit"/i, 'Run KGR on your top monitored keyword')
    .replace(
      /Add 3–5 high-intent terms in Keywords, then run KGR in SEO Tools/i,
      'Add 3–5 high-intent terms, then run KGR in SEO Tools',
    );
}

const REC_ROUTE_LABELS: Record<string, string> = {
  '/seo-tools': 'SEO Tools',
  '/keywords': 'Keywords',
  '/integrations': 'Integrations',
  '/calendar': 'Calendar',
  '/history': 'AI Replies',
  '/onboarding': 'Setup Wizard',
  '/dashboard': 'Mission Control',
  '/dashboard/issues': 'Issue Control',
  '/settings': 'Settings',
};

/** Human label for nav toast / [[NAV]] when opening a daily rec module. */
export function recNavigationLabel(rec: Pick<SelfHealRecommendation, 'title' | 'href'>): string {
  const path = rec.href.split('?')[0];
  return REC_ROUTE_LABELS[path] || formatRecDisplayTitle(rec.title);
}

/** ISO date (2026-07-03) → readable label (July 3, 2026). */
export function formatRecsDateLabel(iso?: string | null): string {
  if (!iso) return 'today';
  const day = iso.slice(0, 10);
  const parsed = new Date(`${day}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return day;
  return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Prefer one rec per category in the top-3 UI strip. */
function pickDiverseTopRecs(items: SelfHealRecommendation[], limit: number): SelfHealRecommendation[] {
  const sorted = [...items].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const picked: SelfHealRecommendation[] = [];
  const usedCategories = new Set<string>();

  for (const item of sorted) {
    if (picked.length >= limit) break;
    const cat = item.category || 'General';
    if (usedCategories.has(cat) && picked.length < limit - 1 && sorted.some((x) => !usedCategories.has(x.category || 'General'))) {
      continue;
    }
    usedCategories.add(cat);
    picked.push(item);
  }

  if (picked.length < limit) {
    for (const item of sorted) {
      if (picked.length >= limit) break;
      if (!picked.includes(item)) picked.push(item);
    }
  }

  return picked.slice(0, limit);
}

export function parseDailyRecsPreview(
  recs: SelfHealStatus['recommendations'] | null,
): DailyRecsPreview | null {
  if (!recs?.items?.length) return null;
  return {
    dateLabel: formatRecsDateLabel(recs.generatedAt),
    items: pickDiverseTopRecs(recs.items, 3).map((item) => ({
      ...item,
      title: formatRecDisplayTitle(item.title),
      action: formatRecDisplayAction(item.action),
    })),
  };
}

export function isDailyImprovementRequest(text: string): boolean {
  return /what\s+should\s+i\s+improve|top\s+improvements?\s+today|daily\s+improvements?/i.test(text);
}

export function buildDailyImprovementReply(
  recs: SelfHealStatus['recommendations'] | null,
): string {
  const preview = parseDailyRecsPreview(recs);
  if (!preview?.items.length) {
    return 'No daily recommendations cached yet. Say **run audit now** and I will pull fresh improvements from Guardian, SEO, and your campaign signals.';
  }
  const lines = preview.items.map((r, i) => `${i + 1}. **${r.title}** — ${r.action}`).join('\n');
  const top = preview.items[0];
  const topNav = top?.href
    ? `\n\n[[NAV:${top.href}|${recNavigationLabel(top)}]]`
    : '';
  return `Today's top improvements (${preview.dateLabel}):\n\n${lines}\n\nSay **1**, **2**, or **3** to open that module — or **run audit now** for a fresh self-heal pass.${topNav}`;
}

/** @deprecated Use parseDailyRecsPreview for UI */
export function formatRecommendationsBanner(recs: SelfHealStatus['recommendations'] | null): string | null {
  const preview = parseDailyRecsPreview(recs);
  if (!preview) return null;
  return `Today's top improvements (${preview.dateLabel}):\n${preview.items.map((r, i) => `${i + 1}. ${r.title} — ${r.action}`).join('\n')}`;
}