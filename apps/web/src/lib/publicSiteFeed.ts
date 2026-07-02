import { getAllModuleFeatures, PUBLIC_NAV_ROUTES, SITE_BRAND } from '@/lib/siteBlueprint';

const STATIC_DISCOVERY_PATHS = ['/', '/login', '/subscribe', '/founder', '/dashboard', '/sitemap.html', '/feed.xml'] as const;

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

export function buildSitemapEntries(): SitemapEntry[] {
  const base = getSiteBaseUrl();
  const today = new Date().toISOString().split('T')[0];
  const paths = new Set<string>([
    '/',
    '/login',
    '/subscribe',
    '/founder',
    '/dashboard',
    '/sitemap.html',
    '/feed.xml',
    ...PUBLIC_NAV_ROUTES.map((r) => r.href),
    ...getAllModuleFeatures().map((m) => m.href),
  ]);
  return [...paths].sort().map((path) => ({
    loc: `${base}${path}`,
    lastmod: today,
    label: path === '/' ? 'Home' : path.replace(/^\//, '').replace(/-/g, ' '),
  }));
}

export type RssItem = { title: string; link: string; description: string; pubDate: string; guid: string };

export function buildRssItems(): RssItem[] {
  const base = getSiteBaseUrl();
  const now = new Date().toUTCString();
  const modules = getAllModuleFeatures();
  const items: RssItem[] = [
    {
      title: `${SITE_BRAND.name} — ${SITE_BRAND.tagline}`,
      link: `${base}/`,
      description: 'AI social growth platform — automate discovery, replies, and publishing.',
      pubDate: now,
      guid: `${base}/#home`,
    },
    ...modules.map((m) => ({
      title: `${m.label} (${m.section})`,
      link: `${base}${m.href}`,
      description: m.hint || `${m.label} module in ${SITE_BRAND.name}`,
      pubDate: now,
      guid: `${base}${m.href}`,
    })),
  ];
  return items;
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
  <p>${entries.length} public and authenticated module routes · <a href="/feed.xml">RSS feed</a></p>
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
      <pubDate>${it.pubDate}</pubDate>
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