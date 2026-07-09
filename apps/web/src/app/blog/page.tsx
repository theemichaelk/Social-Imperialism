'use client';

import Image from 'next/image';
import { NavAnchor } from '@/components/NavAnchor';
import { HomeFooter } from '@/components/HomeFooter';
import { HomePublicNav } from '@/components/HomePublicNav';
import { BLOG_POSTS, BLOG_SILOS, type BlogSilo } from '@/lib/blogPosts';
import { SITE_BRAND } from '@/lib/siteBlueprint';
import { useState } from 'react';

export default function BlogIndexPage() {
  const [filter, setFilter] = useState<BlogSilo | 'all'>('all');
  const posts = filter === 'all' ? BLOG_POSTS : BLOG_POSTS.filter((p) => p.silo === filter);

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
            Ten SEO-optimized guides on AI social automation, multi-platform publishing, growth prospecting,
            analytics, and silo architecture — built for teams running mission-control workflows.
          </p>
          <div className="blog-silo-tabs">
            <button type="button" className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
            {(Object.keys(BLOG_SILOS) as BlogSilo[]).map((silo) => (
              <button
                key={silo}
                type="button"
                className={`tab ${filter === silo ? 'active' : ''}`}
                onClick={() => setFilter(silo)}
              >
                {BLOG_SILOS[silo].label}
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
          <h2>Discovery</h2>
          <p>
            All articles are indexed in our{' '}
            <NavAnchor href="/sitemap.html">HTML sitemap</NavAnchor>,{' '}
            <NavAnchor href="/sitemap.xml">XML sitemap</NavAnchor>, and{' '}
            <NavAnchor href="/feed.xml">RSS feed</NavAnchor>.
          </p>
        </div>
      </section>

      <HomeFooter />
    </div>
  );
}