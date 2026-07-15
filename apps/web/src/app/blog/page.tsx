'use client';

import Image from 'next/image';
import { NavAnchor } from '@/components/NavAnchor';
import { HomeFooter } from '@/components/HomeFooter';
import { HomePublicNav } from '@/components/HomePublicNav';
import { BLOG_POSTS, BLOG_SILOS, type BlogSilo } from '@/lib/blogPosts';
import { getArticleDiscoveryCoverage, getPublicDiscoveryStats } from '@/lib/publicSiteFeed';
import { SITE_BRAND } from '@/lib/siteBlueprint';
import { useMemo, useState } from 'react';

export default function BlogIndexPage() {
  const [filter, setFilter] = useState<BlogSilo | 'all'>('all');
  const posts = filter === 'all' ? BLOG_POSTS : BLOG_POSTS.filter((p) => p.silo === filter);
  const coverage = useMemo(() => getArticleDiscoveryCoverage(), []);
  const stats = useMemo(() => getPublicDiscoveryStats(), []);
  const articleCount = coverage.articleCount || BLOG_POSTS.length;
  const allIndexed = coverage.allInSitemap && coverage.allInRss;

  return (
    <div className="home-page blog-index-page">
      <div className="home-bg-grid" aria-hidden />
      <div className="home-floating-orb home-orb-1" aria-hidden />
      <div className="home-floating-orb home-orb-2" aria-hidden />

      <HomePublicNav variant="founder" />

      <section className="home-section blog-index-hero">
        <div className="home-container">
          <span className="home-section-eyebrow">Insights</span>
          <h1>{SITE_BRAND.name} Blog</h1>
          <p className="blog-index-lead">
            {articleCount} SEO-optimized guides on AI social automation, multi-platform publishing, growth prospecting,
            analytics, and silo architecture — built for teams running growth workflows.
          </p>
          <div className="blog-silo-tabs">
            <button type="button" className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
              All ({BLOG_POSTS.length})
            </button>
            {(Object.keys(BLOG_SILOS) as BlogSilo[]).map((silo) => (
              <button
                key={silo}
                type="button"
                className={`tab ${filter === silo ? 'active' : ''}`}
                onClick={() => setFilter(silo)}
              >
                {BLOG_SILOS[silo].label} ({BLOG_POSTS.filter((p) => p.silo === silo).length})
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
        </div>
      </section>

      <section className="home-section">
        <div className="home-container home-glass-panel blog-discovery">
          <h2>Discovery &amp; indexing</h2>
          <p>
            {allIndexed
              ? `All ${articleCount} articles are indexed in our `
              : `${articleCount} articles are published. Index coverage: `}
            <NavAnchor href="/sitemap.html">HTML sitemap</NavAnchor>
            {' '}({stats.sitemapTotal} public URLs),{' '}
            <NavAnchor href="/sitemap.xml">XML sitemap</NavAnchor>, and{' '}
            <NavAnchor href="/feed.xml">RSS feed</NavAnchor>
            {' '}({stats.feedTotal} article items)
            {allIndexed ? '.' : ' — verify missing slugs after deploy.'}
          </p>
          <ul className="blog-discovery-list" style={{ margin: '12px 0 0', paddingLeft: '1.2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
            <li>
              <strong style={{ color: '#cbd5e1' }}>HTML</strong> — human-readable, grouped by blog / marketing / legal
            </li>
            <li>
              <strong style={{ color: '#cbd5e1' }}>XML</strong> — for Google Search Console &amp; other crawlers (
              <code style={{ color: '#64748b' }}>robots.txt</code> points here)
            </li>
            <li>
              <strong style={{ color: '#cbd5e1' }}>RSS</strong> — subscribe in any reader at{' '}
              <NavAnchor href="/feed.xml">/feed.xml</NavAnchor>
            </li>
          </ul>
          {!allIndexed && (coverage.missingSitemap.length > 0 || coverage.missingRss.length > 0) && (
            <p style={{ marginTop: 10, color: '#fbbf24', fontSize: '0.85rem' }}>
              Coverage gap — sitemap missing: {coverage.missingSitemap.join(', ') || 'none'}; RSS missing:{' '}
              {coverage.missingRss.join(', ') || 'none'}.
            </p>
          )}
        </div>
      </section>

      <HomeFooter />
    </div>
  );
}