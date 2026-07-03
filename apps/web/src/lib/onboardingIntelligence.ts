/**
 * THEE_MICHAEL Setup Wizard intelligence — brand research + module propagation
 */
import { apiFetch } from '@/lib/api';

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

export async function researchBrandWithTheeMichael(
  domain: string,
  brandName?: string,
  opts?: { persist?: boolean },
): Promise<BrandResearchResult | null> {
  try {
    const res = await apiFetch('/api/onboarding/research-brand', {
      method: 'POST',
      body: JSON.stringify({ domain, brandName, persist: opts?.persist }),
    }) as BrandResearchResult;
    return res?.success ? res : null;
  } catch {
    return null;
  }
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