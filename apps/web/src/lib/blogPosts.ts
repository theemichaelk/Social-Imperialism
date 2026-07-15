import { BLOG_ARTICLES, type BlogArticleBody } from '@/content/blog/articles';
import { GENERATED_BLOG_POSTS } from '@/content/blog/generatedPosts';

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
  midImage1?: string;
  midImage2?: string;
  midImage1Caption?: string;
  midImage2Caption?: string;
  videoUrl: string;
  videoCaption: string;
  keywords: string[];
  siloLinks: SiloLink[];
  /** Quick Answer (AEO) — speakable */
  aeoAnswer?: string;
  /** GEO lead sentence */
  geoLead?: string;
  /** GEO bullet points for AI Overviews */
  geoPoints?: string[];
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
    description: 'AEO, GEO, GA4, silo architecture, and measurable authority for your brand.',
  },
};

/** All posts including future drip schedule (sorted by publish date desc for display lists). */
export const BLOG_POSTS: BlogPostMeta[] = ([...GENERATED_BLOG_POSTS] as BlogPostMeta[]).sort(
  (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
);

/** Posts visible to the public (publishedAt <= now). */
export function getPublishedPosts(asOf: Date = new Date()): BlogPostMeta[] {
  const t = asOf.getTime();
  return BLOG_POSTS.filter((p) => new Date(p.publishedAt).getTime() <= t);
}

/** Scheduled drip posts not yet live. */
export function getScheduledPosts(asOf: Date = new Date()): BlogPostMeta[] {
  const t = asOf.getTime();
  return [...BLOG_POSTS]
    .filter((p) => new Date(p.publishedAt).getTime() > t)
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
}

export function getBlogPost(slug: string): (BlogPostMeta & { body: BlogArticleBody }) | null {
  const meta = BLOG_POSTS.find((p) => p.slug === slug);
  const body = BLOG_ARTICLES[slug];
  if (!meta || !body) return null;
  // Future drip posts are prebuilt but only listed in index/RSS/sitemap after publishedAt.
  // Direct URL remains available so the weekly drip needs no redeploy when the date arrives.
  return { ...meta, body };
}

/** Include scheduled for static param generation so weekly drip is prebuilt. */
export function getAllBlogSlugs(): string[] {
  return BLOG_POSTS.map((p) => p.slug);
}

export function getPostsBySilo(silo: BlogSilo): BlogPostMeta[] {
  return getPublishedPosts().filter((p) => p.silo === silo);
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

export function searchPublishedPosts(query: string): BlogPostMeta[] {
  const term = query.trim().toLowerCase();
  if (!term) return getPublishedPosts();
  return getPublishedPosts().filter((p) => {
    const hay = [p.title, p.excerpt, p.description, p.siloLabel, ...p.keywords].join(' ').toLowerCase();
    return hay.includes(term);
  });
}
