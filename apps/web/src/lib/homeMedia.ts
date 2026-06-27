import { BLUEPRINT_METRICS, getTickerItems } from '@/lib/siteBlueprint';

export type HeroSlide = {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  video?: string;
  image?: string;
  accent: string;
};

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'command',
    tag: 'Mission Control',
    title: 'One dashboard. Every network.',
    subtitle: 'Live feeds, AI drafts, engagement queues, and worker automation in real time.',
    video: 'https://assets.mixkit.co/videos/preview/mixkit-hud-map-interface-with-data-and-information-27998-large.mp4',
    image: '/hero/slide-15.jpg',
    accent: '#38bdf8',
  },
  {
    id: 'publish',
    tag: 'Create & Publish',
    title: 'AI content that ships itself.',
    subtitle: 'Content Hub, calendar scheduling, stock media, and multi-platform publishing.',
    video: 'https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-code-screen-close-up-1728-large.mp4',
    image: '/hero/slide-06.jpg',
    accent: '#a855f7',
  },
  {
    id: 'growth',
    tag: 'Growth Labs',
    title: 'Prospect. Engage. Convert.',
    subtitle: 'Reddit scanner, Quora ops, lead capture, and visual automation flows.',
    video: 'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-a-digital-stock-market-ticker-32608-large.mp4',
    image: '/hero/slide-10.jpg',
    accent: '#22c55e',
  },
  {
    id: 'scale',
    tag: 'Agency Scale',
    title: `${BLUEPRINT_METRICS.platformLabel} platforms. Zero friction.`,
    subtitle: 'OAuth-connected accounts, keyword intelligence, and API health monitoring.',
    video: 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-futuristic-devices-99786-large.mp4',
    image: '/hero/slide-01.jpg',
    accent: '#f59e0b',
  },
];

export const SHOWCASE_SLIDES = [
  { id: 'dash', title: 'Mission Control Dashboard', caption: 'Live API rings, trending intelligence, and six actionable tabs.', image: '/hero/slide-15.jpg', href: '/dashboard' },
  { id: 'content', title: 'Content Hub', caption: 'AI generation, RSS curation, stock photos, and publish queue.', image: '/hero/slide-06.jpg', href: '/content-hub' },
  { id: 'calendar', title: 'Content Calendar', caption: 'Drag-and-drop scheduling with auto-publish worker.', image: '/hero/slide-07.jpg', href: '/calendar' },
  { id: 'wizard', title: 'Setup Wizard', caption: 'Brand profile, keywords, feed preview, and go-live checklist.', image: '/hero/slide-01.jpg', href: '/onboarding' },
  { id: 'automate', title: 'Visual Automations', caption: 'Trigger nodes, webhooks, and deployable automation flows.', image: '/hero/slide-08.jpg', href: '/automations' },
  { id: 'integrate', title: 'Integrations Hub', caption: 'Live API probes, connection matrix, and credential management.', image: '/hero/slide-02.jpg', href: '/integrations' },
];

/** Recomputed from nav + brain blueprint on each import */
export const TICKER_ITEMS = getTickerItems();