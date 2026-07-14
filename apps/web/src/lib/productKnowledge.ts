/**
 * Authoritative product map for Imperialism Brain / THEE_MICHAEL live support.
 * Synced with nav.ts, pageFocus.ts, and siteBlueprint.ts.
 */
import { PAGE_FOCUS } from '@/lib/pageFocus';
import { NAV_SECTIONS } from '@/lib/nav';
import { ALL_PLATFORMS, platformDisplayName } from '@/lib/platforms';
import {
  BLUEPRINT_METRICS,
  BILLING_PLANS,
  FOOTER_LEGAL_LINKS,
  PUBLIC_NAV_ROUTES,
  getAllModuleFeatures,
  getModuleCount,
} from '@/lib/siteBlueprint';

export function buildProductKnowledgeAppend(): string {
  const modules = getAllModuleFeatures()
    .map((m) => `- **${m.label}** → \`${m.href}\` (${m.section})`)
    .join('\n');

  const pageOutcomes = Object.entries(PAGE_FOCUS)
    .map(([path, cfg]) => `- \`${path}\` **${cfg.title}**: ${cfg.outcome}`)
    .join('\n');

  const related = Object.entries(PAGE_FOCUS)
    .flatMap(([path, cfg]) =>
      (cfg.related || []).map((r) => `- From ${path}: ${r.label} → \`${r.href}\``),
    )
    .slice(0, 40)
    .join('\n');

  const platforms = ALL_PLATFORMS.map((p) => platformDisplayName(p)).join(', ');
  const billing = BILLING_PLANS.map((p) => `${p.name} ${p.price}${p.period}`).join(' · ');
  const publicRoutes = [...PUBLIC_NAV_ROUTES, ...FOOTER_LEGAL_LINKS]
    .map((r) => `${r.label} → ${r.href}`)
    .join(' · ');

  return `
PRODUCT KNOWLEDGE — Social Imperialism (authoritative; prefer over stale priors):
- Product: AI social growth platform at socialimperialism.com
- Metrics: ${BLUEPRINT_METRICS.ipcChannels} IPC channels · ${BLUEPRINT_METRICS.platformLabel} platforms · ${BLUEPRINT_METRICS.aiModels} AI models · ${getModuleCount()} app modules
- Supported platforms: ${platforms}
- Billing tiers: ${billing}
- Public pages: ${publicRoutes}

Sidebar modules (use [[NAV:path|Label]] when user needs to go there):
${modules}

Page outcomes (match user intent → best route):
${pageOutcomes}

Common cross-links:
${related}

404 / lost navigation: infer closest module from intent, suggest 1–3 links, emit [[NAV:...]] when user wants to go there.
Never open with the long onboarding script ("Welcome to Social Imperialism", "26 steps", "Walk me through A-Z") unless the user explicitly asks for full A→Z setup or campaign mastery walkthrough.
Answer product questions directly using this map — modules, platforms, integrations, Be-First monitors, Video Studio, SEO Tools, Auto-Rules, Imperialism Brain, THEE_MICHAEL admin approvals.
`;
}