'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { NavAnchor } from '@/components/NavAnchor';
import {
  BLOG_POSTS,
  BLOG_SILOS,
  getPublishedPosts,
  type BlogPostMeta,
  type BlogSilo,
} from '@/lib/blogPosts';
import { SITE_BRAND } from '@/lib/siteBlueprint';
import { StickyExploreRail } from '@/components/StickyExploreRail';

type Props = {
  post: BlogPostMeta;
};

export function BlogArticleSidebar({ post }: Props) {
  const [q, setQ] = useState('');
  const published = useMemo(() => getPublishedPosts(), []);
  const recent = published.filter((p) => p.slug !== post.slug).slice(0, 5);
  const trending = published
    .filter((p) => p.slug !== post.slug)
    .sort((a, b) => b.keywords.length - a.keywords.length || b.title.length - a.title.length)
    .slice(0, 4);
  const relatedTopics = useMemo(() => {
    const set = new Set<string>();
    post.keywords.forEach((k) => set.add(k));
    published
      .filter((p) => p.silo === post.silo && p.slug !== post.slug)
      .forEach((p) => p.keywords.slice(0, 2).forEach((k) => set.add(k)));
    return [...set].slice(0, 8);
  }, [post, published]);

  const searchHits = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term || term.length < 2) return [];
    return published
      .filter((p) => {
        const hay = [p.title, p.excerpt, p.description, p.siloLabel, ...p.keywords].join(' ').toLowerCase();
        return hay.includes(term);
      })
      .slice(0, 8);
  }, [q, published]);

  return (
    <StickyExploreRail>
        <header className="si-blog-sidebar__head">
          <h2 className="si-blog-sidebar__title">Explore</h2>
        </header>

        <section className="si-sidebar-widget si-sidebar-widget--search">
          <h3 className="si-sidebar-widget__title">Search Posts</h3>
          <form
            className="si-sidebar-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <label className="sr-only" htmlFor="si-blog-sidebar-search">Search site posts</label>
            <input
              id="si-blog-sidebar-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Keywords across the site…"
              autoComplete="off"
            />
          </form>
          {searchHits.length > 0 && (
            <ul className="si-sidebar-list si-sidebar-search-results">
              {searchHits.map((p) => (
                <li key={p.slug}>
                  <NavAnchor href={`/blog/${p.slug}`}>{p.title}</NavAnchor>
                </li>
              ))}
            </ul>
          )}
          {q.trim().length >= 2 && searchHits.length === 0 && (
            <p className="si-sidebar-hint">No posts match “{q.trim()}”.</p>
          )}
        </section>

        <section className="si-sidebar-widget si-sidebar-widget--subscribe">
          <h3 className="si-sidebar-widget__title">Subscribe</h3>
          <p className="si-sidebar-hint">Get Social Imperialism growth playbooks and product updates.</p>
          <NavAnchor href="/subscribe" className="btn primary si-sidebar-btn">Subscribe</NavAnchor>
          <a className="si-sidebar-rss" href="/feed.xml">RSS feed →</a>
        </section>

        <section className="si-sidebar-widget si-sidebar-widget--founder">
          <h3 className="si-sidebar-widget__title">Founder</h3>
          <div className="si-sidebar-founder">
            <Image
              src="/founder/michael-k.jpg"
              alt="Michael Kaswatuka"
              width={96}
              height={96}
              className="si-sidebar-founder__img"
            />
            <h4>Michael Kaswatuka</h4>
            <p className="si-sidebar-founder__role">Founder &amp; Editor-in-Chief</p>
            <p className="si-sidebar-hint">
              Architect of {SITE_BRAND.name} — mission-control social automation, AEO/GEO content systems, and multi-platform growth.
            </p>
            <NavAnchor href="/founder" className="btn si-sidebar-btn">About — Learn more</NavAnchor>
          </div>
        </section>

        <section className="si-sidebar-widget">
          <h3 className="si-sidebar-widget__title">Trending Articles</h3>
          <ul className="si-sidebar-list">
            {trending.map((p) => (
              <li key={p.slug}>
                <NavAnchor href={`/blog/${p.slug}`}>{p.title}</NavAnchor>
              </li>
            ))}
          </ul>
        </section>

        <section className="si-sidebar-widget">
          <h3 className="si-sidebar-widget__title">Recent Posts</h3>
          <ul className="si-sidebar-list">
            {recent.map((p) => (
              <li key={p.slug}>
                <NavAnchor href={`/blog/${p.slug}`}>{p.title}</NavAnchor>
                <time dateTime={p.publishedAt}>
                  {new Date(p.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </time>
              </li>
            ))}
          </ul>
        </section>

        <section className="si-sidebar-widget">
          <h3 className="si-sidebar-widget__title">Related Topics</h3>
          <div className="si-sidebar-tags">
            {relatedTopics.map((t) => (
              <NavAnchor key={t} href={`/blog?q=${encodeURIComponent(t)}`} className="si-sidebar-tag">
                {t}
              </NavAnchor>
            ))}
          </div>
        </section>

        <section className="si-sidebar-widget">
          <h3 className="si-sidebar-widget__title">Browse Topics</h3>
          <ul className="si-sidebar-list">
            {(Object.keys(BLOG_SILOS) as BlogSilo[]).map((silo) => (
              <li key={silo}>
                <NavAnchor href={`/blog?silo=${silo}`}>{BLOG_SILOS[silo].label}</NavAnchor>
                <span className="si-sidebar-count">
                  {BLOG_POSTS.filter((p) => p.silo === silo && new Date(p.publishedAt) <= new Date()).length}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="si-sidebar-widget">
          <h3 className="si-sidebar-widget__title">Post Categories</h3>
          <ul className="si-sidebar-list">
            {(Object.keys(BLOG_SILOS) as BlogSilo[]).map((silo) => (
              <li key={`cat-${silo}`}>
                <NavAnchor href={`/blog?silo=${silo}`}>{BLOG_SILOS[silo].label}</NavAnchor>
              </li>
            ))}
          </ul>
        </section>

        <section className="si-sidebar-widget si-sidebar-widget--home">
          <NavAnchor href="/" className="btn primary si-sidebar-btn">← Back to Homepage</NavAnchor>
          <div className="si-sidebar-mini-nav">
            <NavAnchor href="/blog">Blog index</NavAnchor>
            <NavAnchor href="/sitemap.html">HTML sitemap</NavAnchor>
            <a href="/sitemap.xml">XML sitemap</a>
            <a href="/feed.xml">RSS feed</a>
          </div>
        </section>
    </StickyExploreRail>
  );
}
