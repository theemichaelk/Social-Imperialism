'use client';

import { NavAnchor } from '@/components/NavAnchor';
import { HomeFooter } from '@/components/HomeFooter';
import { HomePublicNav } from '@/components/HomePublicNav';
import { getPublishedPosts } from '@/lib/blogPosts';
import { SITE_BRAND } from '@/lib/siteBlueprint';

/** Visual RSS landing — machine feed remains at /feed.xml */
export default function RssLandingPage() {
  const posts = getPublishedPosts();
  return (
    <div className="home-page">
      <div className="home-bg-grid" aria-hidden />
      <HomePublicNav variant="founder" />
      <section className="home-section">
        <div className="home-container" style={{ maxWidth: 820 }}>
          <span className="home-section-eyebrow">RSS</span>
          <h1>{SITE_BRAND.name} Feed</h1>
          <p className="home-section-sub left" style={{ textAlign: 'left', margin: '0.75rem 0 1.25rem' }}>
            Subscribe in any reader with the machine-readable feed, or browse the latest published articles below.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <a className="btn primary" href="/feed.xml">Open feed.xml</a>
            <NavAnchor className="btn" href="/blog">Blog index</NavAnchor>
            <NavAnchor className="btn" href="/sitemap.html">HTML sitemap</NavAnchor>
          </div>
          <div className="home-glass-panel" style={{ padding: '1rem 1.25rem' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {posts.map((p) => (
                <li key={p.slug} style={{ borderBottom: '1px solid rgba(148,163,184,0.12)', paddingBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    <time dateTime={p.publishedAt}>{new Date(p.publishedAt).toUTCString()}</time>
                    {' · '}{p.siloLabel}
                  </div>
                  <NavAnchor href={`/blog/${p.slug}`} style={{ fontWeight: 600, color: '#e2e8f0', textDecoration: 'none' }}>
                    {p.title}
                  </NavAnchor>
                  <p style={{ margin: '0.35rem 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>{p.excerpt}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <HomeFooter />
    </div>
  );
}
