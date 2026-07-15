import { BLOG_POSTS } from '@/lib/blogPosts';
import { FOOTER_LEGAL_LINKS, PUBLIC_NAV_ROUTES, SITE_BRAND } from '@/lib/siteBlueprint';

/**
 * Public SEO discovery — only crawlable marketing + blog URLs.
 * Authenticated product modules (dashboard, settings, etc.) are intentionally
 * excluded so sitemaps stay honest and search engines are not sent to login walls.
 */

const PUBLIC_MARKETING_PATHS = [
  '/',
  '/blog',
  '/download',
  '/founder',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/login',
  '/subscribe',
  '/sitemap.html',
  '/sitemap.xml',
  '/feed.xml',
] as const;

function xmlEscape(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function getSiteBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
  const raw = process.env.WEB_URL || process.env.NEXT_PUBLIC_WEB_URL || 'https://www.socialimperialism.com';
  return raw.replace(/\/$/, '');
}

export type SitemapEntry = {
  loc: string;
  lastmod: string;
  label: string;
  group: 'blog' | 'marketing' | 'legal' | 'discovery';
  priority: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
};

function blogLastmod(slug: string): string {
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  return post?.updatedAt || post?.publishedAt || new Date().toISOString().split('T')[0];
}

function pathLabel(path: string): string {
  if (path === '/') return 'Home';
  if (path === '/blog') return 'Blog index';
  if (path === '/sitemap.html') return 'HTML sitemap';
  if (path === '/sitemap.xml') return 'XML sitemap';
  if (path === '/feed.xml') return 'RSS feed';
  const blog = BLOG_POSTS.find((p) => path === `/blog/${p.slug}`);
  if (blog) return blog.title;
  const legal = FOOTER_LEGAL_LINKS.find((l) => l.href === path);
  if (legal) return legal.label;
  const nav = PUBLIC_NAV_ROUTES.find((r) => r.href === path);
  if (nav) return nav.label;
  return path.replace(/^\//, '').replace(/-/g, ' ');
}

function pathGroup(path: string): SitemapEntry['group'] {
  if (path.startsWith('/blog')) return 'blog';
  if (FOOTER_LEGAL_LINKS.some((l) => l.href === path)) return 'legal';
  if (path === '/sitemap.html' || path === '/sitemap.xml' || path === '/feed.xml') return 'discovery';
  return 'marketing';
}

export function buildSitemapEntries(): SitemapEntry[] {
  const base = getSiteBaseUrl();
  const today = new Date().toISOString().split('T')[0];
  const paths = new Set<string>([
    ...PUBLIC_MARKETING_PATHS,
    ...FOOTER_LEGAL_LINKS.map((l) => l.href),
    ...PUBLIC_NAV_ROUTES.map((r) => r.href),
    ...BLOG_POSTS.map((p) => `/blog/${p.slug}`),
  ]);

  return [...paths]
    .sort((a, b) => {
      // Blog articles after blog index; keep home first
      if (a === '/') return -1;
      if (b === '/') return 1;
      if (a.startsWith('/blog') && !b.startsWith('/blog')) return 1;
      if (!a.startsWith('/blog') && b.startsWith('/blog')) return -1;
      return a.localeCompare(b);
    })
    .map((path) => {
      const blogSlug = path.startsWith('/blog/') ? path.slice('/blog/'.length) : null;
      const isHome = path === '/';
      const isBlogArticle = !!blogSlug;
      const isBlogIndex = path === '/blog';
      return {
        loc: `${base}${path}`,
        lastmod: blogSlug ? blogLastmod(blogSlug) : today,
        label: pathLabel(path),
        group: pathGroup(path),
        priority: isHome ? '1.0' : isBlogArticle ? '0.85' : isBlogIndex ? '0.9' : path.includes('sitemap') || path.includes('feed') ? '0.4' : '0.7',
        changefreq: isBlogArticle ? 'monthly' : isBlogIndex || isHome ? 'weekly' : 'monthly',
      };
    });
}

/** Every published blog article must appear in sitemap + RSS — used by UI claim + audits. */
export function getArticleDiscoveryCoverage() {
  const base = getSiteBaseUrl();
  const articles = BLOG_POSTS.map((p) => ({
    slug: p.slug,
    title: p.title,
    path: `/blog/${p.slug}`,
    url: `${base}/blog/${p.slug}`,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
  }));
  const sm = buildSitemapEntries();
  const rss = buildRssItems();
  const missingSitemap = articles.filter((a) => !sm.some((e) => e.loc === a.url));
  const missingRss = articles.filter((a) => !rss.some((i) => i.link === a.url));
  return {
    articleCount: articles.length,
    sitemapTotal: sm.length,
    rssArticleCount: rss.length,
    allInSitemap: missingSitemap.length === 0,
    allInRss: missingRss.length === 0,
    missingSitemap: missingSitemap.map((a) => a.slug),
    missingRss: missingRss.map((a) => a.slug),
    articles,
  };
}

export function getPublicDiscoveryStats() {
  const coverage = getArticleDiscoveryCoverage();
  const sitemapTotal = buildSitemapEntries().length;
  return {
    sitemapTotal,
    feedTotal: coverage.rssArticleCount,
    articleCount: coverage.articleCount,
    allArticlesIndexed: coverage.allInSitemap && coverage.allInRss,
    moduleRoutes: 0, // private modules intentionally excluded from public sitemap
    staticRoutes: Math.max(0, sitemapTotal - coverage.articleCount),
    feedModules: coverage.rssArticleCount,
    staticPaths: [...PUBLIC_MARKETING_PATHS],
  };
}

export type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  category?: string;
};

/** RSS items = published articles only (no private app routes). */
export function buildRssItems(): RssItem[] {
  const base = getSiteBaseUrl();
  return [...BLOG_POSTS]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .map((p) => ({
      title: p.title,
      link: `${base}/blog/${p.slug}`,
      description: p.excerpt || p.description,
      pubDate: new Date(p.publishedAt).toUTCString(),
      guid: `${base}/blog/${p.slug}`,
      category: p.siloLabel,
    }));
}

export function renderSitemapHtml(): string {
  const entries = buildSitemapEntries();
  const coverage = getArticleDiscoveryCoverage();
  const groups: Array<{ id: SitemapEntry['group']; title: string }> = [
    { id: 'blog', title: 'Blog articles' },
    { id: 'marketing', title: 'Marketing & product' },
    { id: 'legal', title: 'Legal' },
    { id: 'discovery', title: 'Discovery feeds' },
  ];

  const sections = groups
    .map((g) => {
      const items = entries.filter((e) => e.group === g.id);
      if (!items.length) return '';
      const rows = items
        .map(
          (e) => `      <li><a href="${xmlEscape(e.loc)}">${xmlEscape(e.label)}</a> <span class="date">${xmlEscape(e.lastmod)}</span></li>`,
        )
        .join('\n');
      return `  <h2>${xmlEscape(g.title)} <span class="count">${items.length}</span></h2>\n  <ul>\n${rows}\n  </ul>`;
    })
    .filter(Boolean)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${xmlEscape(SITE_BRAND.name)} — Sitemap</title>
  <meta name="description" content="HTML sitemap for ${xmlEscape(SITE_BRAND.name)} — ${coverage.articleCount} blog articles plus public marketing pages." />
  <meta name="robots" content="index,follow" />
  <link rel="alternate" type="application/rss+xml" title="${xmlEscape(SITE_BRAND.name)} RSS" href="/feed.xml" />
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; max-width: 800px; margin: 0 auto; line-height: 1.45; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.05rem; margin: 1.75rem 0 0.5rem; color: #38bdf8; display: flex; align-items: center; gap: 0.5rem; }
    .count { font-size: 0.75rem; color: #94a3b8; font-weight: 500; background: #1e293b; padding: 0.15rem 0.5rem; border-radius: 999px; }
    p { color: #94a3b8; font-size: 0.9rem; }
    .badge { display: inline-block; background: rgba(34,197,94,0.12); color: #86efac; border: 1px solid rgba(34,197,94,0.35); border-radius: 999px; padding: 0.2rem 0.65rem; font-size: 0.78rem; margin-right: 0.35rem; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { padding: 0.55rem 0; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; gap: 1rem; }
    a { color: #38bdf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .date { color: #64748b; font-size: 0.8rem; white-space: nowrap; }
    nav a { margin-right: 0.75rem; }
  </style>
</head>
<body>
  <h1>${xmlEscape(SITE_BRAND.name)} Sitemap</h1>
  <p>
    <span class="badge">${coverage.articleCount} articles indexed</span>
    <span class="badge">${entries.length} public URLs</span>
  </p>
  <p>
    All blog articles appear in this HTML sitemap, the
    <a href="/sitemap.xml">XML sitemap</a>, and the
    <a href="/feed.xml">RSS feed</a>. Private app modules (dashboard, settings, account hub) are not listed — they require login.
  </p>
  <nav>
    <a href="/">Home</a>
    <a href="/blog">Blog</a>
    <a href="/sitemap.xml">XML</a>
    <a href="/feed.xml">RSS</a>
  </nav>
${sections}
</body>
</html>`;
}

export function renderFeedXml(): string {
  const base = getSiteBaseUrl();
  const items = buildRssItems();
  const coverage = getArticleDiscoveryCoverage();
  const itemXml = items
    .map(
      (it) => `    <item>
      <title><![CDATA[${it.title}]]></title>
      <link>${xmlEscape(it.link)}</link>
      <guid isPermaLink="true">${xmlEscape(it.guid)}</guid>
      <description><![CDATA[${it.description}]]></description>
      <pubDate>${xmlEscape(it.pubDate)}</pubDate>${it.category ? `\n      <category><![CDATA[${it.category}]]></category>` : ''}
    </item>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${SITE_BRAND.name} Blog]]></title>
    <link>${xmlEscape(base)}/blog</link>
    <atom:link href="${xmlEscape(base)}/feed.xml" rel="self" type="application/rss+xml" />
    <description><![CDATA[${SITE_BRAND.tagline} — ${coverage.articleCount} SEO guides on AI social automation, multi-platform publishing, and growth intelligence.]]></description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Social Imperialism publicSiteFeed</generator>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <ttl>60</ttl>
${itemXml}
  </channel>
</rss>`;
}

export function renderSitemapXml(): string {
  const entries = buildSitemapEntries();
  const urls = entries
    .map(
      (e) => `  <url>
    <loc>${xmlEscape(e.loc)}</loc>
    <lastmod>${xmlEscape(e.lastmod)}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}
