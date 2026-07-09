import { BLOG_POSTS } from '@/lib/blogPosts';
import { FOOTER_LEGAL_LINKS, getAllModuleFeatures, PUBLIC_NAV_ROUTES, SITE_BRAND } from '@/lib/siteBlueprint';

const STATIC_DISCOVERY_PATHS = [
  '/', '/login', '/subscribe', '/founder', '/dashboard', '/blog',
  '/about', '/contact', '/privacy', '/terms', '/download',
  '/sitemap.html', '/sitemap.xml', '/feed.xml',
] as const;

export function getPublicDiscoveryStats() {
  const moduleCount = getAllModuleFeatures().length;
  const sitemapTotal = buildSitemapEntries().length;
  const feedTotal = buildRssItems().length;
  return {
    sitemapTotal,
    feedTotal,
    moduleRoutes: moduleCount,
    staticRoutes: Math.max(0, sitemapTotal - moduleCount),
    feedModules: Math.max(0, feedTotal - 1),
    staticPaths: [...STATIC_DISCOVERY_PATHS],
  };
}

export function getSiteBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
  const raw = process.env.WEB_URL || process.env.NEXT_PUBLIC_WEB_URL || 'https://www.socialimperialism.com';
  return raw.replace(/\/$/, '');
}

export type SitemapEntry = { loc: string; lastmod: string; label?: string };

function blogLastmod(slug: string): string {
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  return post?.updatedAt || new Date().toISOString().split('T')[0];
}

export function buildSitemapEntries(): SitemapEntry[] {
  const base = getSiteBaseUrl();
  const today = new Date().toISOString().split('T')[0];
  const paths = new Set<string>([
    '/',
    '/login',
    '/subscribe',
    '/founder',
    '/dashboard',
    '/blog',
    '/download',
    '/sitemap.html',
    '/sitemap.xml',
    '/feed.xml',
    ...FOOTER_LEGAL_LINKS.map((l) => l.href),
    ...PUBLIC_NAV_ROUTES.map((r) => r.href),
    ...getAllModuleFeatures().map((m) => m.href),
    ...BLOG_POSTS.map((p) => `/blog/${p.slug}`),
  ]);
  return [...paths].sort().map((path) => {
    const blogSlug = path.startsWith('/blog/') ? path.replace('/blog/', '') : null;
    return {
      loc: `${base}${path}`,
      lastmod: blogSlug ? blogLastmod(blogSlug) : today,
      label: path === '/' ? 'Home' : path.replace(/^\//, '').replace(/-/g, ' '),
    };
  });
}

export type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  category?: string;
  enclosure?: { url: string; type: string };
};

export function buildRssItems(): RssItem[] {
  const base = getSiteBaseUrl();
  const now = new Date().toUTCString();
  const blogItems: RssItem[] = BLOG_POSTS.map((p) => ({
    title: p.title,
    link: `${base}/blog/${p.slug}`,
    description: p.excerpt,
    pubDate: new Date(p.publishedAt).toUTCString(),
    guid: `${base}/blog/${p.slug}`,
    category: p.siloLabel,
    enclosure: { url: `${base}${p.thumbnail}`, type: 'image/jpeg' },
  }));
  return [
    {
      title: `${SITE_BRAND.name} Blog`,
      link: `${base}/blog`,
      description: 'SEO guides on AI social automation, multi-platform publishing, and growth intelligence.',
      pubDate: now,
      guid: `${base}/blog`,
    },
    ...blogItems,
  ];
}

export function renderSitemapHtml(): string {
  const entries = buildSitemapEntries();
  const rows = entries
    .map(
      (e) => `<li><a href="${e.loc}">${e.label || e.loc}</a> <span class="date">${e.lastmod}</span></li>`,
    )
    .join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${SITE_BRAND.name} — Sitemap</title>
  <meta name="robots" content="index,follow" />
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    p { color: #94a3b8; font-size: 0.9rem; }
    ul { list-style: none; padding: 0; }
    li { padding: 0.5rem 0; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; gap: 1rem; }
    a { color: #38bdf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .date { color: #64748b; font-size: 0.8rem; white-space: nowrap; }
  </style>
</head>
<body>
  <h1>${SITE_BRAND.name} Sitemap</h1>
  <p>${entries.length} URLs including blog articles · <a href="/feed.xml">RSS feed</a> · <a href="/sitemap.xml">XML sitemap</a></p>
  <ul>${rows}</ul>
</body>
</html>`;
}

export function renderFeedXml(): string {
  const base = getSiteBaseUrl();
  const items = buildRssItems();
  const itemXml = items
    .map(
      (it) => `    <item>
      <title><![CDATA[${it.title}]]></title>
      <link>${it.link}</link>
      <guid isPermaLink="true">${it.guid}</guid>
      <description><![CDATA[${it.description}]]></description>
      <pubDate>${it.pubDate}</pubDate>${it.category ? `\n      <category>${it.category}</category>` : ''}${it.enclosure ? `\n      <enclosure url="${it.enclosure.url}" type="${it.enclosure.type}" />` : ''}
    </item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${SITE_BRAND.name}</title>
    <link>${base}/</link>
    <description>${SITE_BRAND.tagline}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${itemXml}
  </channel>
</rss>`;
}

export function renderSitemapXml(): string {
  const entries = buildSitemapEntries();
  const urls = entries
    .map(
      (e) => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.loc.includes('/blog/') ? 'monthly' : 'weekly'}</changefreq>
    <priority>${e.loc.endsWith('/') ? '1.0' : e.loc.includes('/blog/') ? '0.8' : '0.6'}</priority>
  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}