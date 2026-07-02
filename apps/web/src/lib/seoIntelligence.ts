/**
 * Client-side SEO intelligence — live brief fetch + session learning memory
 */
import { apiFetch } from '@/lib/api';
import { isSeoRelatedQuery } from '@/lib/theeMichaelSeoExpert';

export type SeoRecommendation = {
  framework: string;
  label: string;
  actions: string[];
  siModules: string[];
};

export type EngineSnapshot = {
  engine: string;
  label: string;
  available: boolean;
  organic?: Array<{ position?: number; title: string; link: string; snippet?: string }>;
  peopleAlsoAsk?: string[];
  relatedSearches?: string[];
  error?: string;
  reason?: string;
};

export type SeoBrief = {
  query: string;
  intents: string[];
  keyword: string | null;
  location: string | null;
  frameworks: Array<{ id: string; label: string; acronym: string }>;
  engineSnapshots: EngineSnapshot[];
  recommendations: SeoRecommendation[];
  pulse: {
    topic: string;
    fetchedAt: string;
    sources: Array<{ title: string; link: string; source?: string; snippet?: string }>;
    insights: string[];
  };
  promptAppend: string;
  liveData: boolean;
  fromCache?: boolean;
  generatedAt: string;
};

export type LearningEntry = {
  query: string;
  keyword: string | null;
  intents: string[];
  insight: string;
  ts: string;
};

const LEARNING_KEY = 'si_seo_learning';
const MAX_LEARNING = 12;

export function rememberSeoLearning(entry: Omit<LearningEntry, 'ts'> & { ts?: string }) {
  if (typeof window === 'undefined') return;
  try {
    const existing = JSON.parse(localStorage.getItem(LEARNING_KEY) || '[]') as LearningEntry[];
    const next: LearningEntry = {
      ...entry,
      ts: entry.ts || new Date().toISOString(),
    };
    const deduped = [next, ...existing.filter((e) => e.insight !== next.insight)].slice(0, MAX_LEARNING);
    localStorage.setItem(LEARNING_KEY, JSON.stringify(deduped));
  } catch { /* ignore */ }
}

export function getSeoLearningMemory(): LearningEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LEARNING_KEY) || '[]') as LearningEntry[];
  } catch {
    return [];
  }
}

export function formatLearningForPrompt(): string {
  const mem = getSeoLearningMemory().slice(0, 5);
  if (!mem.length) return '';
  const lines = mem.map((m) => `- [${m.ts.slice(0, 10)}] ${m.insight}`);
  return `\nSession SEO learning memory (perpetual context):\n${lines.join('\n')}`;
}

export async function fetchSeoBrief(query: string, pathname?: string): Promise<SeoBrief | null> {
  if (!isSeoRelatedQuery(query)) return null;
  try {
    const res = await apiFetch('/api/seo/intelligence/brief', {
      method: 'POST',
      body: JSON.stringify({ query, pathname }),
    }) as { success?: boolean; brief?: SeoBrief };
    if (!res.success || !res.brief) return null;

    const brief = res.brief;
    if (brief.pulse?.insights?.[0]) {
      rememberSeoLearning({
        query: brief.query,
        keyword: brief.keyword,
        intents: brief.intents,
        insight: brief.pulse.insights[0],
      });
    }
    if (brief.engineSnapshots?.find((s) => s.available)?.organic?.[0]) {
      const top = brief.engineSnapshots.find((s) => s.available)?.organic?.[0];
      if (top) {
        rememberSeoLearning({
          query: brief.query,
          keyword: brief.keyword,
          intents: brief.intents,
          insight: `SERP leader: "${top.title}"`,
        });
      }
    }
    return brief;
  } catch {
    return null;
  }
}

export async function fetchSeoLivePulse(topic: string) {
  try {
    const res = await apiFetch('/api/seo/intelligence/live-pulse', {
      method: 'POST',
      body: JSON.stringify({ topic }),
    }) as { success?: boolean; pulse?: SeoBrief['pulse'] };
    return res.pulse || null;
  } catch {
    return null;
  }
}

export function buildSeoAugmentedContext(brief: SeoBrief | null): string {
  if (!brief) return formatLearningForPrompt();
  return `${brief.promptAppend || ''}${formatLearningForPrompt()}`;
}