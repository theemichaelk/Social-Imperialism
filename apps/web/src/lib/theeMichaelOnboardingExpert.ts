/**
 * THEE_MICHAEL onboarding intelligence — domain extraction + context for Imperialism Brain
 */

import type { BrandResearchResult, OnboardingContext } from '@/lib/onboardingIntelligence';

export const ONBOARDING_EXPERT_APPEND = `
Setup Wizard intelligence: When the user asks to research their brand, auto-fill setup, or wire onboarding data:
1. Extract domain from message (e.g. acme.com, https://acme.com) or ask for it in ONE question.
2. Research pulls live website content, SEO brief (AEO/GEO/local/national), keywords, global AI reply prompt, Prompt Vault templates, Be-First monitors, and Campaign Command verified target URL.
3. Data propagates to all sidebar modules by relevancy: Brand → Keywords → SEO Tools → AI Replies → Prompt Vault → Auto-Rules → Campaign Command → Create/Library/Design Studio.
4. After research, direct user to finish Setup Wizard step 2 (Integrations) if APIs < 5 connected, then Campaign Command for verified nodes.
Never invent brand facts — only cite research results or ask for domain.`;

const DOMAIN_RE = /(?:https?:\/\/)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)/i;

export function extractDomainFromText(text: string): string | null {
  const q = String(text || '').trim();
  if (!q) return null;

  const labeled = q.match(/(?:domain|site|website|url)\s*[:\s]+\s*(\S+)/i);
  if (labeled?.[1]) {
    const d = labeled[1].replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
    if (d.includes('.')) return d;
  }

  const matches = q.match(DOMAIN_RE);
  if (matches?.[1]) {
    const d = matches[1].toLowerCase();
    if (!d.includes('socialimperialism') && d.includes('.')) return d;
  }
  return null;
}

export function isBrandResearchRequest(text: string): boolean {
  return /research\s+(my\s+)?brand|auto[\s-]?fill\s+(my\s+)?brand|setup\s+my\s+brand|wire\s+my\s+brand|intelligent\s+setup/i.test(text);
}

export function formatBrandResearchSummary(result: BrandResearchResult): string {
  const wired = result.propagation?.results?.filter((r) => r.ok).map((r) => r.module) || [];
  const lines = [
    `**Brand research complete** for **${result.brand.brandName}** (${result.brand.domain})`,
    '',
    `- **${result.suggestedKeywords?.length || 0} keywords** → Keywords, Browse Posts, Auto-Rules`,
    `- **Global reply prompt** → AI Replies + Prompt Vault`,
    `- **Target URL** → Campaign Command: ${result.targetUrl}`,
    result.seoBrief?.liveData ? '- **Live SEO pulse** active (SerpAPI connected)' : '- **SEO frameworks** loaded — add SerpAPI for live SERP',
    wired.length ? `- **Wired modules:** ${wired.join(', ')}` : '',
    '',
    'Next: finish **Setup Wizard** → **Integrations** (connect APIs) → **Campaign Command** verified nodes.',
  ].filter(Boolean);
  return lines.join('\n');
}

export function buildOnboardingAugmentedContext(ctx: OnboardingContext | null): string {
  if (!ctx?.brand?.domain) return '';
  const ready = ctx.readyCount || 0;
  const total = ctx.totalModules || 0;
  return `LIVE ONBOARDING CONTEXT:
Brand: ${ctx.brand.brandName || '—'} · Domain: ${ctx.brand.domain}
Module readiness: ${ready}/${total} wired
Target URL: ${ctx.targetUrl}
Use this when advising setup, keywords, or campaign wiring.`;
}