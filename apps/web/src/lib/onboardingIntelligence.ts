/**
 * THEE_MICHAEL Setup Wizard intelligence — brand research + module propagation
 */
import { apiFetch } from '@/lib/api';

export type ModuleFlowItem = {
  module: string;
  href: string;
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
  steps?: Array<{ step: string; ok: boolean; error?: string }>;
  error?: string;
};

export async function researchBrandWithTheeMichael(
  domain: string,
  brandName?: string,
): Promise<BrandResearchResult | null> {
  try {
    const res = await apiFetch('/api/onboarding/research-brand', {
      method: 'POST',
      body: JSON.stringify({ domain, brandName }),
    }) as BrandResearchResult;
    return res?.success ? res : null;
  } catch {
    return null;
  }
}

export async function propagateBrandToModules(brand: BrandResearchResult['brand']) {
  try {
    return await apiFetch('/api/onboarding/propagate', {
      method: 'POST',
      body: JSON.stringify({ brand }),
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
  { section: 'System', modules: ['Campaign Command', 'Imperialism Brain', 'Integrations', 'Settings'] },
];