import { BLOG_POSTS, getPublishedPosts } from '@/lib/blogPosts';
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
  '/rss',
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
  // Only published posts — weekly drip remains out of crawlers until publishedAt
  const published = getPublishedPosts();
  const paths = new Set<string>([
    ...PUBLIC_MARKETING_PATHS,
    ...FOOTER_LEGAL_LINKS.map((l) => l.href),
    ...PUBLIC_NAV_ROUTES.map((r) => r.href),
    ...published.map((p) => `/blog/${p.slug}`),
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
  const published = getPublishedPosts();
  const articles = published.map((p) => ({
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
    scheduledCount: BLOG_POSTS.length - published.length,
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

/** RSS items = published articles only (no private app routes, no future drip). */
export function buildRssItems(): RssItem[] {
  const base = getSiteBaseUrl();
  return getPublishedPosts().map((p) => ({
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
  <title>${xmlEscape(SITE_BRAND.name)} — HTML Sitemap</title>
  <meta name="description" content="Visual HTML sitemap for ${xmlEscape(SITE_BRAND.name)} — ${coverage.articleCount} published blog articles plus public marketing pages." />
  <meta name="robots" content="index,follow" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="alternate" type="application/rss+xml" title="${xmlEscape(SITE_BRAND.name)} RSS" href="/feed.xml" />
  <style>
    :root { --bg:#020617; --card:#0f172a; --line:rgba(56,189,248,.18); --text:#e2e8f0; --muted:#94a3b8; --accent:#38bdf8; --violet:#a855f7; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: ui-sans-serif, system-ui, Segoe UI, sans-serif; background:
      radial-gradient(900px 420px at 10% -10%, rgba(56,189,248,.18), transparent 55%),
      radial-gradient(700px 380px at 90% 0%, rgba(168,85,247,.14), transparent 50%),
      var(--bg); color: var(--text); line-height: 1.5; min-height: 100vh; }
    .wrap { max-width: 960px; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
    .hero { border:1px solid var(--line); background: linear-gradient(145deg, rgba(15,23,42,.95), rgba(15,23,42,.7)); border-radius: 20px; padding: 1.75rem 1.5rem; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
    h1 { font-size: clamp(1.5rem, 3vw, 2rem); margin: 0 0 .5rem; letter-spacing: -0.02em; }
    .lead { color: var(--muted); margin: 0 0 1rem; max-width: 62ch; }
    .badges { display:flex; flex-wrap:wrap; gap:.45rem; margin-bottom: 1rem; }
    .badge { display:inline-flex; align-items:center; gap:.35rem; background: rgba(34,197,94,.1); color:#86efac; border:1px solid rgba(34,197,94,.35); border-radius:999px; padding:.25rem .7rem; font-size:.78rem; font-weight:600; }
    .badge.alt { background: rgba(56,189,248,.1); color:#7dd3fc; border-color: rgba(56,189,248,.35); }
    nav { display:flex; flex-wrap:wrap; gap:.65rem; }
    nav a { color: var(--accent); text-decoration:none; font-size:.9rem; padding:.35rem .7rem; border-radius:999px; border:1px solid var(--line); background: rgba(15,23,42,.6); }
    nav a:hover { border-color: var(--accent); background: rgba(56,189,248,.08); }
    h2 { font-size: 1.05rem; margin: 2rem 0 .75rem; color: var(--accent); display:flex; align-items:center; gap:.55rem; }
    .count { font-size:.72rem; color:var(--muted); font-weight:600; background:rgba(30,41,59,.9); padding:.15rem .5rem; border-radius:999px; border:1px solid var(--line); }
    ul { list-style:none; padding:0; margin:0; display:grid; gap:.45rem; }
    li { display:flex; justify-content:space-between; gap:1rem; align-items:center; padding:.75rem 1rem; border:1px solid var(--line); border-radius:14px; background: rgba(15,23,42,.72); transition: border-color .15s, transform .15s; }
    li:hover { border-color: rgba(56,189,248,.45); transform: translateY(-1px); }
    li a { color: var(--text); text-decoration:none; font-weight:500; }
    li a:hover { color: var(--accent); }
    .date { color:#64748b; font-size:.78rem; white-space:nowrap; }
    footer { margin-top: 2.5rem; color:#64748b; font-size:.82rem; text-align:center; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>${xmlEscape(SITE_BRAND.name)} · HTML Sitemap</h1>
      <p class="lead">Human-readable map of every public page. Blog articles are AEO/GEO-ready guides. Private app modules (dashboard, settings, account hub) require login and are intentionally omitted.</p>
      <div class="badges">
        <span class="badge">${coverage.articleCount} articles live</span>
        <span class="badge alt">${entries.length} public URLs</span>
        <span class="badge alt">${coverage.scheduledCount || 0} scheduled drip</span>
      </div>
      <nav>
        <a href="/">Home</a>
        <a href="/blog">Blog</a>
        <a href="/sitemap.xml">XML sitemap</a>
        <a href="/feed.xml">RSS feed</a>
        <a href="/subscribe">Subscribe</a>
      </nav>
    </div>
${sections}
    <footer>Machine-readable: <a href="/sitemap.xml" style="color:var(--accent)">sitemap.xml</a> · <a href="/feed.xml" style="color:var(--accent)">feed.xml</a></footer>
  </div>
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
