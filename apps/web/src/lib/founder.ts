import {
  BLUEPRINT_METRICS,
  getFounderBioIntro,
  getFounderHighlights,
  getModuleCount,
} from '@/lib/siteBlueprint';

export const FOUNDER = {
  name: 'Michael K',
  title: 'Founder & Author',
  role: 'Creator of Social Imperialism',
  image: '/founder/michael-k.png',
  imageAlt: 'Portrait of Michael K, founder of Social Imperialism, smiling warmly',
  tagline: 'Building the command center for AI-powered social dominance.',
  email: 'theesaintmichael@gmail.com',
  github: 'https://github.com/theemichaelk/Social-Imperialism',
  get bio() {
    return `${getFounderBioIntro()}

He built the platform to solve a problem every growth team faces: scattered tools, disconnected APIs, and manual engagement that never scales. Social Imperialism unifies discovery, AI replies, content publishing, Reddit prospecting, Quora ops, visual automations, and real-time analytics — all wired to live OAuth and API credentials.

As both engineer and operator, Michael designed every module end-to-end: from the Setup Wizard and Integrations Hub to the Partner REST API and webhook layer that lets Zapier, Make, and custom apps plug in natively.`;
  },
  get highlights() {
    return getFounderHighlights();
  },
  principles: [
    { title: 'Real APIs, Not Mocks', desc: 'Every feed, probe, and chart pulls live data — OAuth, API keys, and .env-backed credentials.' },
    { title: 'Agency-Scale by Default', desc: 'Multi-campaign isolation, per-brand keywords, and white-label-ready workflows from day one.' },
    { title: 'Actionable Intelligence', desc: 'Dashboards show what to do next — draft replies, schedule posts, prospect leads, deploy automations.' },
    { title: 'Open Integration', desc: 'Partner API, inbound/outbound webhooks, and connectors for the tools teams already use.' },
  ],
  timeline: [
    { year: '2024', event: 'Concept — unified social command center for multi-brand agencies' },
    { year: '2025', event: `Desktop app — ${BLUEPRINT_METRICS.ipcChannels} IPC handlers, live feeds, AI reply engine` },
    { year: '2026', event: `SaaS launch — ${getModuleCount()} web modules, Integrations Hub, Partner API` },
  ],
};