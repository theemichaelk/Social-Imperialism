/**
 * Imperialism Brain Setup Wizard intelligence — brand research + module propagation
 */
import { apiFetch, type ApiError } from '@/lib/api';

export type ModuleFlowItem = {
  section?: string;
  module: string;
  href: string;
  hint?: string;
  data: string;
  status: string;
};

export type BrandResearchResult = {
  success: boolean;
  brand: {
    brandName: string;
    domain: string;
    description: string;
    tone: string;
    audience: string;
    disallowedTopics: string;
    sampleMessages: string;
    affiliateLinks: string;
  };
  keywords: Array<{ term: string; platforms?: string[] }>;
  suggestedKeywords: string[];
  platforms: string[];
  globalPrompt: string;
  monitors: Array<{ id: string; term: string; platform: string; type: string; target: string }>;
  moduleFlow: ModuleFlowItem[];
  recommendations: Array<{ step?: number; action: string; href: string }>;
  targetUrl: string;
  seoBrief?: {
    intents: string[];
    keyword: string | null;
    liveData: boolean;
  };
  propagation?: { success: boolean; results: Array<{ module: string; ok: boolean; error?: string }> };
  steps?: Array<{ step: string; ok: boolean; error?: string }>;
  error?: string;
};

export type OnboardingContext = {
  success: boolean;
  brand: BrandResearchResult['brand'];
  moduleFlow: ModuleFlowItem[];
  readyCount: number;
  totalModules: number;
  targetUrl: string;
};

export class BrandResearchError extends Error {
  detail?: string;
  steps?: BrandResearchResult['steps'];

  constructor(message: string, opts?: { detail?: string; steps?: BrandResearchResult['steps'] }) {
    super(message);
    this.name = 'BrandResearchError';
    this.detail = opts?.detail;
    this.steps = opts?.steps;
  }
}

function failedResearchSteps(steps?: BrandResearchResult['steps']) {
  return (steps || []).filter((s) => !s.ok);
}

export function formatBrandResearchError(err: unknown): string {
  if (err instanceof BrandResearchError) return err.message;
  const e = err as ApiError & Error;
  const msg = String(e?.message || '').trim();

  if (/^unauthorized$/i.test(msg) || /invalid token|not authenticated|401/i.test(msg)) {
    return 'Session expired — log in again, then retry brand research.';
  }
  if (/project not found|no project/i.test(msg)) {
    return 'Workspace project not found — refresh the page or open Dashboard to sync your session.';
  }
  if (/domain is required/i.test(msg)) {
    return 'Enter a valid domain first (e.g. acme.com).';
  }
  if (/subscription|SUBSCRIPTION_REQUIRED/i.test(msg) || e?.code === 'SUBSCRIPTION_REQUIRED') {
    return 'Active subscription required before brand research can run.';
  }
  if (/SOVEREIGN_|live.?freeze|security review/i.test(msg) || (e?.code || '').startsWith('SOVEREIGN_')) {
    return 'Request blocked by security review — open Settings → Guardian & API → Security Control, then retry.';
  }
  if (/gemini|openrouter|openai|anthropic|api key|no ai|provider/i.test(msg)) {
    return `AI provider unavailable${msg ? ` (${msg})` : ''} — add Gemini or OpenRouter keys under Integrations → Connections.`;
  }
  if (/fetch failed|network|ECONNREFUSED|ENOTFOUND|502|503|504|timeout/i.test(msg)) {
    return `Cannot reach the API server${msg ? ` (${msg})` : ''} — check your connection or retry in a moment.`;
  }
  return msg || 'Brand research failed — open Integrations and confirm API keys, then try again.';
}

export async function researchBrandWithTheeMichael(
  domain: string,
  brandName?: string,
  opts?: { persist?: boolean },
): Promise<BrandResearchResult> {
  let res: BrandResearchResult;
  try {
    res = await apiFetch('/api/onboarding/research-brand', {
      method: 'POST',
      body: JSON.stringify({ domain, brandName, persist: opts?.persist }),
    }) as BrandResearchResult;
  } catch (e) {
    throw new BrandResearchError(formatBrandResearchError(e), { detail: (e as Error).message });
  }

  if (!res || typeof res !== 'object') {
    throw new BrandResearchError('Invalid response from brand research API — check API connection and retry.');
  }

  if (!res.success) {
    const failed = failedResearchSteps(res.steps);
    const stepHint = failed.length
      ? ` Failed steps: ${failed.map((s) => s.step.replace(/-/g, ' ')).join(', ')}.`
      : '';
    throw new BrandResearchError(
      `${formatBrandResearchError(new Error(res.error || 'Brand research did not complete'))}${stepHint}`,
      { detail: res.error, steps: res.steps },
    );
  }

  const failed = failedResearchSteps(res.steps);
  if (res.steps?.length && failed.length === res.steps.length) {
    throw new BrandResearchError(
      `Brand research could not pull live data for ${domain}.${failed.map((s) => ` ${s.step.replace(/-/g, ' ')}: ${s.error || 'failed'}`).join(';')}`,
      { detail: failed.map((s) => s.error).filter(Boolean).join('; '), steps: res.steps },
    );
  }

  return res;
}

export async function fetchOnboardingContext(): Promise<OnboardingContext | null> {
  try {
    const res = await apiFetch('/api/onboarding/context') as OnboardingContext;
    return res?.success ? res : null;
  } catch {
    return null;
  }
}

export type PropagateMonitor = {
  id?: string;
  term?: string;
  platform?: string;
  type?: string;
  target?: string;
  added?: string;
};

export type PropagatePayload = {
  brand: BrandResearchResult['brand'];
  keywords?: BrandResearchResult['keywords'];
  monitors?: PropagateMonitor[];
  globalPrompt?: string;
  platforms?: string[];
};

export async function propagateBrandToModules(payload: PropagatePayload) {
  try {
    return await apiFetch('/api/onboarding/propagate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    return { success: false };
  }
}

export const WIZARD_MODULE_MAP = [
  { section: 'Mission Control', modules: ['Dashboard', 'Browse Posts'] },
  { section: 'Create & Publish', modules: ['Setup Wizard', 'Create', 'Library', 'Design Studio', 'Brand', 'Calendar', 'Scheduler'] },
  { section: 'Discovery & Replies', modules: ['Prompt Vault', 'Engagement', 'AI Replies', 'Keywords', 'SEO Tools'] },
  { section: 'Growth Labs', modules: ['Growth Lab', 'Quora Ops'] },
  { section: 'Automation', modules: ['Automations', 'Auto-Rules'] },
  { section: 'Accounts', modules: ['Accounts', 'Acct Creator'] },
  { section: 'System', modules: ['Campaign Command', 'Imperialism Brain', 'Integrations', 'Settings'] },
];

export function groupModuleFlowBySection(flow: ModuleFlowItem[]) {
  const sections: Array<{ section: string; items: ModuleFlowItem[] }> = [];
  for (const item of flow) {
    const section = item.section || 'Modules';
    const existing = sections.find((s) => s.section === section);
    if (existing) existing.items.push(item);
    else sections.push({ section, items: [item] });
  }
  return sections;
}