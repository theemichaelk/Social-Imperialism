/**
 * Public-site blueprint — single source for marketing pages, nav, footer, and stats.
 * Synced with brain/FEATURES.md, brain/features/*.md, PRD.md, and apps/web/src/lib/nav.ts.
 * When modules, platforms, or features change, update nav.ts / brain docs — this file recomputes.
 */
import { NAV_SECTIONS } from '@/lib/nav';
import { ALL_PLATFORMS, platformDisplayName } from '@/lib/platforms';

/** Brain / blueprint sources this module mirrors */
export const BLUEPRINT_SOURCES = [
  'brain/FEATURES.md',
  'brain/features/AUDIT_ACCURACY_RULE.md',
  'brain/features/*.md',
  'PRD.md',
  'apps/web/src/lib/nav.ts',
  'apps/web/src/lib/siteBlueprint.ts',
] as const;

export const SITE_BRAND = {
  name: 'Social Imperialism',
  tagline: 'AI Social Growth Platform',
  year: new Date().getFullYear(),
} as const;

export const SITE_FOOTER = {
  copyright: (year = SITE_BRAND.year) =>
    `© ${year} ${SITE_BRAND.name}. All rights reserved.`,
  creditOrg: 'The Stone Builders Rejected',
  creditUrl: 'https://tsbrenterprises.com',
  creditPerson: 'Michael K',
} as const;

/** Verified marketing constants — align with brain/FEATURES.md */
export const BLUEPRINT_METRICS = {
  ipcChannels: '380',
  platformLabel: '14+',
  aiModels: '100+',
  apiIntegrations: '50+',
} as const;

export function getModuleCount(): number {
  return NAV_SECTIONS.reduce((n, s) => n + s.items.length, 0);
}

export function getAllModuleFeatures() {
  return NAV_SECTIONS.flatMap((s) =>
    s.items.map((item) => ({ ...item, section: s.label })),
  );
}

/** Anchor links on the home page (Demo → Pricing) */
export const PUBLIC_NAV_ANCHORS = [
  { id: 'demo', label: 'Demo', href: '#showcase' },
  { id: 'features', label: 'Features', href: '#features' },
  { id: 'platforms', label: 'Platforms', href: '#platforms' },
  { id: 'how-it-works', label: 'How It Works', href: '#how-it-works' },
  { id: 'pricing', label: 'Pricing', href: '#pricing' },
] as const;

export const PUBLIC_NAV_ROUTES = [
  { id: 'founder', label: 'Founder', href: '/founder' },
] as const;

export type PublicNavAction = {
  id: string;
  label: string;
  href: string;
  variant: 'glass' | 'primary';
};

export function getPublicNavActions(loggedIn = false): PublicNavAction[] {
  if (loggedIn) {
    return [
      { id: 'dashboard', label: 'Open Dashboard', href: '/dashboard', variant: 'primary' },
    ];
  }
  return [
    { id: 'sign-in', label: 'Sign In', href: '/login', variant: 'glass' },
    { id: 'open-dashboard', label: 'Open Dashboard', href: '/dashboard', variant: 'primary' },
  ];
}

/** Default footer links — Sign In, Dashboard, Integrations, Settings, Founder */
export const FOOTER_LINKS = [
  { href: '/login', label: 'Sign In' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/settings', label: 'Settings' },
  { href: '/founder', label: 'Founder' },
] as const;

export function getSiteCapabilities() {
  const modules = getModuleCount();
  return [
    { label: 'IPC Channels', value: BLUEPRINT_METRICS.ipcChannels, sub: 'full desktop parity' },
    { label: 'Platforms', value: BLUEPRINT_METRICS.platformLabel, sub: 'OAuth & API' },
    { label: 'AI Models', value: BLUEPRINT_METRICS.aiModels, sub: 'OpenRouter & Gemini' },
    { label: 'App Modules', value: String(modules), sub: 'end-to-end workflows' },
  ] as const;
}

/** Display chips for the Platforms section — canonical list + data APIs */
export function getMarketingPlatforms(): string[] {
  const social = ALL_PLATFORMS.map((p) => platformDisplayName(p));
  return [...social, 'NewsAPI', 'SerpAPI'];
}

export const BILLING_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$49',
    period: '/mo',
    highlight: false,
    features: [
      '3 Social Accounts',
      '500 AI Generations/mo',
      'Content Calendar',
      'Keyword Tracking',
      'Setup Wizard',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$149',
    period: '/mo',
    highlight: true,
    features: [
      '15 Social Accounts',
      '5,000 AI Generations',
      'Reddit Prospector',
      'Visual Automations',
      'Auto-Rules Engine',
      'Advanced Analytics',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    highlight: false,
    features: [
      'Unlimited Accounts',
      '24/7 Crisis Monitoring',
      'Dedicated Manager',
      'Custom Routing',
      'SLA & Priority Support',
    ],
  },
] as const;

export function getOnboardingSteps() {
  return [
    {
      n: 1,
      title: 'Brand Profile',
      desc: 'Integrate your brand, domain, and tone — AI uses this for every reply and post.',
    },
    {
      n: 2,
      title: 'Keywords & Platforms',
      desc: `AI-suggested keywords across ${BLUEPRINT_METRICS.platformLabel} networks. Track what matters to your audience.`,
    },
    {
      n: 3,
      title: 'Live Feed Preview',
      desc: 'Quick scan or full discovery — see real posts from connected APIs instantly.',
    },
    {
      n: 4,
      title: 'Go Live',
      desc: 'Worker starts automatically. Mission Control tracks engagement in real time.',
    },
  ] as const;
}

/** Intelligence checklist — one bullet per nav section group */
export function getIntelligenceHighlights(): string[] {
  return NAV_SECTIONS.map((s) => {
    const names = s.items.map((i) => i.label).slice(0, 2).join(', ');
    return `${s.label}: ${names}${s.items.length > 2 ? ', …' : ''}`;
  });
}

/** Ticker items derived from live module labels + blueprint metrics */
export function getTickerItems(): string[] {
  const modules = getAllModuleFeatures().map((f) => f.label);
  const head = [
    `${BLUEPRINT_METRICS.ipcChannels} IPC Channels`,
    `${BLUEPRINT_METRICS.platformLabel} Social Platforms`,
    `${getModuleCount()} App Modules`,
    'Live NewsAPI Feed',
    'AI Reply Engine',
    'Imperialism Brain',
    'THEE_MICHAEL Security Control',
    'Guardian Gatekeeper',
    'Prompt Vault',
    'Grok Imagine (Edge)',
  ];
  const tail = modules.filter(
    (m) => !head.some((h) => h.toLowerCase().includes(m.toLowerCase())),
  );
  return [...head, ...tail.slice(0, 6)];
}

export function getFeaturesSectionCopy() {
  const n = getModuleCount();
  return {
    eyebrow: 'Platform',
    title: 'Everything your team needs',
    subtitle: `${n} modules — from discovery to publish to growth automation.`,
  };
}

export function getFounderHighlights() {
  return [
    { label: 'Platforms Built', value: String(getModuleCount()), sub: 'end-to-end modules' },
    { label: 'API Integrations', value: BLUEPRINT_METRICS.apiIntegrations, sub: 'live connections' },
    { label: 'IPC Channels', value: BLUEPRINT_METRICS.ipcChannels, sub: 'desktop parity' },
    { label: 'Vision', value: '1', sub: 'dominate your niche' },
  ] as const;
}

export function getFounderBioIntro(): string {
  const n = getModuleCount();
  return `Michael K is the founder and architect behind Social Imperialism — a full-stack social automation platform that connects ${BLUEPRINT_METRICS.platformLabel} networks, ${BLUEPRINT_METRICS.ipcChannels} IPC channels, and ${BLUEPRINT_METRICS.aiModels} AI models into one mission-control dashboard.`;
}