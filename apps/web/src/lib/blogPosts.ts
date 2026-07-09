import { BLOG_ARTICLES, type BlogArticleBody } from '@/content/blog/articles';

export type BlogSilo = 'automation' | 'platforms' | 'growth' | 'analytics-seo';

export type SiloLink = {
  label: string;
  href: string;
  kind: 'home' | 'internal' | 'authority';
};

export type BlogPostMeta = {
  slug: string;
  title: string;
  excerpt: string;
  description: string;
  silo: BlogSilo;
  siloLabel: string;
  publishedAt: string;
  updatedAt: string;
  readMinutes: number;
  thumbnail: string;
  headerImage: string;
  bottomImage: string;
  videoUrl: string;
  videoCaption: string;
  keywords: string[];
  siloLinks: SiloLink[];
};

export const BLOG_SILOS: Record<BlogSilo, { label: string; description: string }> = {
  automation: {
    label: 'Automation',
    description: 'AI workflows, calendars, and visual automation for hands-free social growth.',
  },
  platforms: {
    label: 'Platforms',
    description: 'Multi-network publishing, OAuth connections, and cross-platform strategy.',
  },
  growth: {
    label: 'Growth',
    description: 'Reddit, Quora, keywords, and prospecting tactics that compound reach.',
  },
  'analytics-seo': {
    label: 'Analytics & SEO',
    description: 'GA4, silo architecture, and measurable authority for your brand.',
  },
};

const VIDEOS = [
  'https://assets.mixkit.co/videos/preview/mixkit-hud-map-interface-with-data-and-information-27998-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-code-screen-close-up-1728-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-a-digital-stock-market-ticker-32608-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-futuristic-devices-99786-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-hud-map-interface-with-data-and-information-27998-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-code-screen-close-up-1728-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-a-digital-stock-market-ticker-32608-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-futuristic-devices-99786-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-hud-map-interface-with-data-and-information-27998-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-code-screen-close-up-1728-large.mp4',
] as const;

const IMAGES = [
  ['/hero/slide-15.jpg', '/hero/slide-06.jpg', '/hero/slide-07.jpg'],
  ['/hero/slide-01.jpg', '/hero/slide-08.jpg', '/hero/slide-02.jpg'],
  ['/hero/slide-10.jpg', '/hero/slide-15.jpg', '/hero/slide-06.jpg'],
  ['/hero/slide-07.jpg', '/hero/slide-01.jpg', '/hero/slide-08.jpg'],
  ['/hero/slide-02.jpg', '/hero/slide-10.jpg', '/hero/slide-15.jpg'],
  ['/hero/slide-06.jpg', '/hero/slide-07.jpg', '/hero/slide-01.jpg'],
  ['/hero/slide-08.jpg', '/hero/slide-02.jpg', '/hero/slide-10.jpg'],
  ['/hero/slide-15.jpg', '/hero/slide-01.jpg', '/hero/slide-06.jpg'],
  ['/hero/slide-07.jpg', '/hero/slide-08.jpg', '/hero/slide-02.jpg'],
  ['/hero/slide-10.jpg', '/hero/slide-15.jpg', '/hero/slide-07.jpg'],
] as const;

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: 'ai-social-media-automation-guide-2026',
    title: 'AI Social Media Automation: The Complete 2026 Guide',
    excerpt: 'How mission-control dashboards, AI drafts, and worker automation replace manual posting across every major network.',
    description: 'Master AI social media automation in 2026 — workflows, tools, and a mission-control approach for 14+ platforms.',
    silo: 'automation',
    siloLabel: 'Automation',
    publishedAt: '2026-01-15',
    updatedAt: '2026-07-01',
    readMinutes: 8,
    thumbnail: IMAGES[0][0],
    headerImage: IMAGES[0][1],
    bottomImage: IMAGES[0][2],
    videoUrl: VIDEOS[0],
    videoCaption: 'Mission-control automation — live feeds, AI drafts, and scheduled publishing.',
    keywords: ['AI social media automation', 'social automation 2026', 'automated posting'],
    siloLinks: [
      { label: 'Social Imperialism homepage', href: '/', kind: 'home' },
      { label: 'Visual Automations module', href: '/automations', kind: 'internal' },
      { label: 'HubSpot — Social Media Marketing', href: 'https://blog.hubspot.com/marketing/social-media-marketing', kind: 'authority' },
    ],
  },
  {
    slug: 'multi-platform-publishing-strategy',
    title: 'Multi-Platform Publishing Strategy for Modern Brands',
    excerpt: 'Repurpose once, publish everywhere — without losing tone, compliance, or platform-native formatting.',
    description: 'Build a multi-platform publishing strategy that scales across 14+ networks with OAuth-connected accounts and AI tone control.',
    silo: 'platforms',
    siloLabel: 'Platforms',
    publishedAt: '2026-01-22',
    updatedAt: '2026-07-01',
    readMinutes: 8,
    thumbnail: IMAGES[1][0],
    headerImage: IMAGES[1][1],
    bottomImage: IMAGES[1][2],
    videoUrl: VIDEOS[1],
    videoCaption: 'Cross-platform publishing pipeline — from draft to scheduled post.',
    keywords: ['multi-platform publishing', 'social media distribution', 'cross-posting strategy'],
    siloLinks: [
      { label: 'Social Imperialism homepage', href: '/', kind: 'home' },
      { label: 'Content Hub', href: '/content-hub', kind: 'internal' },
      { label: 'Buffer — Cross-Posting Guide', href: 'https://buffer.com/resources/social-media-cross-posting/', kind: 'authority' },
    ],
  },
  {
    slug: 'reddit-marketing-automation-b2b',
    title: 'Reddit Marketing Automation for B2B Growth Teams',
    excerpt: 'Ethical prospecting, keyword monitors, and AI-assisted replies that respect community rules.',
    description: 'Reddit marketing automation for B2B — keyword discovery, prospect lists, and compliant engagement workflows.',
    silo: 'growth',
    siloLabel: 'Growth',
    publishedAt: '2026-02-05',
    updatedAt: '2026-07-01',
    readMinutes: 8,
    thumbnail: IMAGES[2][0],
    headerImage: IMAGES[2][1],
    bottomImage: IMAGES[2][2],
    videoUrl: VIDEOS[2],
    videoCaption: 'Reddit prospecting — keyword monitors and engagement queues in action.',
    keywords: ['Reddit marketing automation', 'B2B Reddit strategy', 'Reddit prospecting'],
    siloLinks: [
      { label: 'Social Imperialism homepage', href: '/', kind: 'home' },
      { label: 'Reddit AI module', href: '/reddit-ai', kind: 'internal' },
      { label: 'Reddit for Business', href: 'https://www.business.reddit.com/', kind: 'authority' },
    ],
  },
  {
    slug: 'content-calendar-automation-best-practices',
    title: 'Content Calendar Automation: Best Practices for 2026',
    excerpt: 'Drag-and-drop scheduling, auto-publish workers, and AI gap-fill so your calendar never goes dark.',
    description: 'Content calendar automation best practices — scheduling workers, AI content fill, and multi-timezone publishing.',
    silo: 'automation',
    siloLabel: 'Automation',
    publishedAt: '2026-02-12',
    updatedAt: '2026-07-01',
    readMinutes: 8,
    thumbnail: IMAGES[3][0],
    headerImage: IMAGES[3][1],
    bottomImage: IMAGES[3][2],
    videoUrl: VIDEOS[3],
    videoCaption: 'Automated content calendar — schedule, queue, and publish without manual checks.',
    keywords: ['content calendar automation', 'social media scheduling', 'auto-publish'],
    siloLinks: [
      { label: 'Social Imperialism homepage', href: '/', kind: 'home' },
      { label: 'Content Calendar', href: '/calendar', kind: 'internal' },
      { label: 'Hootsuite — Content Calendar Tips', href: 'https://blog.hootsuite.com/social-media-content-calendar/', kind: 'authority' },
    ],
  },
  {
    slug: 'social-media-analytics-ga4-integration',
    title: 'Social Media Analytics & GA4 Integration Explained',
    excerpt: 'Connect social campaigns to measurable site outcomes with GA4, UTM discipline, and dashboard visibility.',
    description: 'Social media analytics and GA4 integration — measurement IDs, verification, and attribution for growth teams.',
    silo: 'analytics-seo',
    siloLabel: 'Analytics & SEO',
    publishedAt: '2026-02-19',
    updatedAt: '2026-07-01',
    readMinutes: 8,
    thumbnail: IMAGES[4][0],
    headerImage: IMAGES[4][1],
    bottomImage: IMAGES[4][2],
    videoUrl: VIDEOS[4],
    videoCaption: 'Analytics pipeline — from social click to GA4 conversion event.',
    keywords: ['social media analytics', 'GA4 integration', 'social attribution'],
    siloLinks: [
      { label: 'Social Imperialism homepage', href: '/', kind: 'home' },
      { label: 'SEO Tools module', href: '/seo-tools', kind: 'internal' },
      { label: 'Google Analytics Help — GA4', href: 'https://support.google.com/analytics/answer/10089681', kind: 'authority' },
    ],
  },
  {
    slug: 'quora-traffic-generation-with-ai',
    title: 'Quora Traffic Generation with AI-Assisted Answers',
    excerpt: 'Find high-intent questions, draft authoritative answers, and route readers to owned landing pages.',
    description: 'Quora traffic generation with AI — keyword discovery, answer drafting, and ethical link placement for sustained referral traffic.',
    silo: 'growth',
    siloLabel: 'Growth',
    publishedAt: '2026-03-01',
    updatedAt: '2026-07-01',
    readMinutes: 8,
    thumbnail: IMAGES[5][0],
    headerImage: IMAGES[5][1],
    bottomImage: IMAGES[5][2],
    videoUrl: VIDEOS[5],
    videoCaption: 'Quora ops workflow — discover, draft, and publish authoritative answers.',
    keywords: ['Quora traffic', 'AI Quora answers', 'Quora marketing'],
    siloLinks: [
      { label: 'Social Imperialism homepage', href: '/', kind: 'home' },
      { label: 'Quora Traffic module', href: '/quora-traffic', kind: 'internal' },
      { label: 'Moz — Content Marketing', href: 'https://moz.com/blog/category/content-marketing', kind: 'authority' },
    ],
  },
  {
    slug: 'keyword-intelligence-social-growth',
    title: 'Keyword Intelligence for Social Growth in 2026',
    excerpt: 'Track terms across networks, align content to search intent, and feed automations from live keyword data.',
    description: 'Keyword intelligence for social growth — discovery, monitoring, and AI content alignment across platforms.',
    silo: 'growth',
    siloLabel: 'Growth',
    publishedAt: '2026-03-08',
    updatedAt: '2026-07-01',
    readMinutes: 8,
    thumbnail: IMAGES[6][0],
    headerImage: IMAGES[6][1],
    bottomImage: IMAGES[6][2],
    videoUrl: VIDEOS[6],
    videoCaption: 'Keyword monitors — live intelligence feeding content and engagement queues.',
    keywords: ['keyword intelligence', 'social keyword tracking', 'social SEO'],
    siloLinks: [
      { label: 'Social Imperialism homepage', href: '/', kind: 'home' },
      { label: 'Keywords module', href: '/keywords', kind: 'internal' },
      { label: 'Search Engine Journal', href: 'https://www.searchenginejournal.com/', kind: 'authority' },
    ],
  },
  {
    slug: 'visual-automation-workflows-agencies',
    title: 'Visual Automation Workflows for Agency Teams',
    excerpt: 'Trigger nodes, webhooks, and deployable flows that scale client campaigns without custom code.',
    description: 'Visual automation workflows for agencies — node-based flows, webhooks, and multi-client campaign orchestration.',
    silo: 'automation',
    siloLabel: 'Automation',
    publishedAt: '2026-03-15',
    updatedAt: '2026-07-01',
    readMinutes: 8,
    thumbnail: IMAGES[7][0],
    headerImage: IMAGES[7][1],
    bottomImage: IMAGES[7][2],
    videoUrl: VIDEOS[7],
    videoCaption: 'Visual automation builder — triggers, conditions, and multi-step flows.',
    keywords: ['visual automation', 'agency social automation', 'workflow automation'],
    siloLinks: [
      { label: 'Social Imperialism homepage', href: '/', kind: 'home' },
      { label: 'Download desktop app', href: '/download', kind: 'internal' },
      { label: 'Zapier — Automation Guide', href: 'https://zapier.com/blog/what-is-workflow-automation/', kind: 'authority' },
    ],
  },
  {
    slug: 'oauth-social-account-management-scale',
    title: 'OAuth Social Account Management at Scale',
    excerpt: 'Secure token refresh, multi-account groups, and health probes across every connected network.',
    description: 'OAuth social account management at scale — connection health, token lifecycle, and 14+ platform integrations.',
    silo: 'platforms',
    siloLabel: 'Platforms',
    publishedAt: '2026-03-22',
    updatedAt: '2026-07-01',
    readMinutes: 8,
    thumbnail: IMAGES[8][0],
    headerImage: IMAGES[8][1],
    bottomImage: IMAGES[8][2],
    videoUrl: VIDEOS[8],
    videoCaption: 'OAuth connection matrix — live probes and account health monitoring.',
    keywords: ['OAuth social accounts', 'social account management', 'platform integrations'],
    siloLinks: [
      { label: 'Social Imperialism homepage', href: '/', kind: 'home' },
      { label: 'Integrations Hub', href: '/integrations', kind: 'internal' },
      { label: 'OAuth 2.0 Specification', href: 'https://oauth.net/2/', kind: 'authority' },
    ],
  },
  {
    slug: 'seo-social-silo-structure-brand-authority',
    title: 'SEO + Social Silo Structure for Brand Authority',
    excerpt: 'Topic clusters, internal links, RSS discovery, and sitemap discipline that search engines reward.',
    description: 'SEO and social silo structure — topic clusters, internal linking, sitemaps, and RSS for compounding brand authority.',
    silo: 'analytics-seo',
    siloLabel: 'Analytics & SEO',
    publishedAt: '2026-03-29',
    updatedAt: '2026-07-01',
    readMinutes: 8,
    thumbnail: IMAGES[9][0],
    headerImage: IMAGES[9][1],
    bottomImage: IMAGES[9][2],
    videoUrl: VIDEOS[9],
    videoCaption: 'Silo architecture — clustered content, feeds, and discovery endpoints.',
    keywords: ['SEO silo structure', 'topic clusters', 'brand authority SEO'],
    siloLinks: [
      { label: 'Social Imperialism homepage', href: '/', kind: 'home' },
      { label: 'About Social Imperialism', href: '/about', kind: 'internal' },
      { label: 'Google Search Central — SEO Starter Guide', href: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', kind: 'authority' },
    ],
  },
];

export function getBlogPost(slug: string): (BlogPostMeta & { body: BlogArticleBody }) | null {
  const meta = BLOG_POSTS.find((p) => p.slug === slug);
  const body = BLOG_ARTICLES[slug];
  if (!meta || !body) return null;
  return { ...meta, body };
}

export function getAllBlogSlugs(): string[] {
  return BLOG_POSTS.map((p) => p.slug);
}

export function getPostsBySilo(silo: BlogSilo): BlogPostMeta[] {
  return BLOG_POSTS.filter((p) => p.silo === silo);
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function countArticleWords(body: BlogArticleBody): number {
  return body.sections.reduce(
    (n, s) => n + s.paragraphs.reduce((m, p) => m + countWords(p), 0),
    0,
  );
}