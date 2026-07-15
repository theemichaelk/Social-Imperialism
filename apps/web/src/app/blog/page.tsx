'use client';

import Image from 'next/image';
import { NavAnchor } from '@/components/NavAnchor';
import { HomeFooter } from '@/components/HomeFooter';
import { HomePublicNav } from '@/components/HomePublicNav';
import {
  BLOG_SILOS,
  getPublishedPosts,
  getScheduledPosts,
  type BlogSilo,
} from '@/lib/blogPosts';
import { getArticleDiscoveryCoverage, getPublicDiscoveryStats } from '@/lib/publicSiteFeed';
import { SITE_BRAND } from '@/lib/siteBlueprint';
import { useMemo, useState, useEffect } from 'react';

export default function BlogIndexPage() {
  const [filter, setFilter] = useState<BlogSilo | 'all'>('all');
  const [q, setQ] = useState('');
  const published = useMemo(() => getPublishedPosts(), []);
  const scheduled = useMemo(() => getScheduledPosts(), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const silo = params.get('silo') as BlogSilo | null;
    const query = params.get('q');
    if (silo && BLOG_SILOS[silo]) setFilter(silo);
    if (query) setQ(query);
  }, []);

  const posts = useMemo(() => {
    let list = filter === 'all' ? published : published.filter((p) => p.silo === filter);
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter((p) =>
        [p.title, p.excerpt, p.description, p.siloLabel, ...p.keywords].join(' ').toLowerCase().includes(term),
      );
    }
    return list;
  }, [filter, published, q]);

  const coverage = useMemo(() => getArticleDiscoveryCoverage(), []);
  const stats = useMemo(() => getPublicDiscoveryStats(), []);
  const articleCount = coverage.articleCount || published.length;
  const allIndexed = coverage.allInSitemap && coverage.allInRss;

  return (
    <div className="home-page blog-index-page">
      <div className="home-bg-grid" aria-hidden />
      <div className="home-floating-orb home-orb-1" aria-hidden />
      <div className="home-floating-orb home-orb-2" aria-hidden />

      <HomePublicNav variant="founder" />

      <section className="home-section blog-index-hero">
        <div className="home-container">
          <span className="home-section-eyebrow">Insights · AEO / GEO</span>
          <h1>{SITE_BRAND.name} Blog</h1>
          <p className="blog-index-lead">
            {articleCount} live SEO guides engineered for answer engines and generative overviews — automation,
            platforms, growth, and analytics. {scheduled.length > 0 && (
              <span>{scheduled.length} more drip-scheduled weekly through {scheduled[scheduled.length - 1]?.publishedAt}.</span>
            )}
          </p>
          <form
            className="blog-index-search"
            role="search"
            onSubmit={(e) => e.preventDefault()}
          >
            <label className="sr-only" htmlFor="blog-index-q">Search posts</label>
            <input
              id="blog-index-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search posts by keyword…"
            />
          </form>
          <div className="blog-silo-tabs">
            <button type="button" className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
              All ({published.length})
            </button>
            {(Object.keys(BLOG_SILOS) as BlogSilo[]).map((silo) => (
              <button
                key={silo}
                type="button"
                className={`tab ${filter === silo ? 'active' : ''}`}
                onClick={() => setFilter(silo)}
              >
                {BLOG_SILOS[silo].label} ({published.filter((p) => p.silo === silo).length})
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-container blog-grid">
          {posts.map((post) => (
            <article key={post.slug} className="home-glass-panel blog-card">
              <NavAnchor href={`/blog/${post.slug}`} className="blog-card-link">
                <div className="blog-card-thumb">
                  <Image
                    src={post.thumbnail}
                    alt={post.title}
                    width={400}
                    height={220}
                    unoptimized
                    className="blog-card-img"
                  />
                  <span className="blog-card-silo">{post.siloLabel}</span>
                </div>
                <div className="blog-card-body">
                  <time dateTime={post.publishedAt}>
                    {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </time>
                  <h2>{post.title}</h2>
                  <p>{post.excerpt}</p>
                  <span className="blog-card-cta">Read article →</span>
                </div>
              </NavAnchor>
            </article>
          ))}
          {posts.length === 0 && (
            <p className="blog-index-empty">No posts match your filters.</p>
          )}
        </div>
      </section>

      <section className="home-section">
        <div className="home-container home-glass-panel blog-discovery">
          <p>
            {allIndexed
              ? `All ${articleCount} live articles are indexed in our `
              : `${articleCount} articles are published. Index coverage: `}
            <NavAnchor href="/sitemap.html">HTML sitemap</NavAnchor>
            {' '}({stats.sitemapTotal} public URLs),{' '}
            <NavAnchor href="/sitemap.xml">XML sitemap</NavAnchor>, and{' '}
            <NavAnchor href="/feed.xml">RSS feed</NavAnchor>
            {' '}({stats.feedTotal} article items)
            {allIndexed ? '.' : ' — verify missing slugs after deploy.'}
          </p>
        </div>
      </section>

      <HomeFooter />
    </div>
  );
}
