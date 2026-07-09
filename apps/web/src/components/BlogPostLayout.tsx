import Image from 'next/image';
import { NavAnchor } from '@/components/NavAnchor';
import { HomeFooter } from '@/components/HomeFooter';
import { HomePublicNav } from '@/components/HomePublicNav';
import type { BlogPostMeta } from '@/lib/blogPosts';
import type { BlogArticleBody } from '@/content/blog/articles';
import { BLOG_SILOS, getPostsBySilo } from '@/lib/blogPosts';
import { SITE_BRAND } from '@/lib/siteBlueprint';

type Props = {
  post: BlogPostMeta & { body: BlogArticleBody };
  loggedIn?: boolean;
};

export function BlogPostLayout({ post, loggedIn = false }: Props) {
  const related = getPostsBySilo(post.silo).filter((p) => p.slug !== post.slug).slice(0, 3);
  const videoMid = Math.floor(post.body.sections.length / 2);

  return (
    <div className="home-page blog-page">
      <div className="home-bg-grid" aria-hidden />
      <div className="home-floating-orb home-orb-1" aria-hidden />
      <div className="home-floating-orb home-orb-2" aria-hidden />

      <HomePublicNav loggedIn={loggedIn} variant="founder" />

      <article className="blog-article">
        <header className="blog-article-header">
          <div className="home-container blog-article-header-inner">
            <NavAnchor href="/blog" className="blog-back-link">← Blog</NavAnchor>
            <span className="home-section-eyebrow">{post.siloLabel} Silo</span>
            <h1>{post.title}</h1>
            <p className="blog-article-excerpt">{post.excerpt}</p>
            <div className="blog-article-meta">
              <time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
              <span>·</span>
              <span>{post.readMinutes} min read</span>
              <span>·</span>
              <span>{BLOG_SILOS[post.silo].label}</span>
            </div>
          </div>
          <div className="blog-article-hero">
            <Image
              src={post.headerImage}
              alt={`${post.title} — header`}
              width={1200}
              height={500}
              priority
              className="blog-hero-img"
            />
          </div>
        </header>

        <div className="home-container blog-article-body">
          <div className="home-glass-panel blog-silo-links">
            <h2>Silo links</h2>
            <ul className="blog-silo-links-list">
              {post.siloLinks.map((link) => (
                <li key={link.href}>
                  <span className={`blog-link-badge blog-link-${link.kind}`}>{link.kind}</span>
                  {link.kind === 'authority' ? (
                    <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
                  ) : (
                    <NavAnchor href={link.href}>{link.label}</NavAnchor>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {post.body.sections.map((section, idx) => (
            <div key={section.heading}>
              <section className="home-glass-panel blog-section">
                <h2>{section.heading}</h2>
                {section.paragraphs.map((para) => (
                  <p key={para.slice(0, 48)} className="blog-para">{para}</p>
                ))}
              </section>
              {idx === videoMid && (
                <figure className="blog-video-embed">
                  <video
                    src={post.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    poster={post.thumbnail}
                    className="blog-video"
                    aria-label={post.videoCaption}
                  />
                  <figcaption>{post.videoCaption}</figcaption>
                </figure>
              )}
            </div>
          ))}

          <figure className="blog-bottom-image">
            <Image
              src={post.bottomImage}
              alt={`${post.title} — closing visual`}
              width={900}
              height={400}
              className="blog-bottom-img"
            />
          </figure>

          {related.length > 0 && (
            <aside className="home-glass-panel blog-related">
              <h2>More in {post.siloLabel}</h2>
              <ul>
                {related.map((r) => (
                  <li key={r.slug}>
                    <NavAnchor href={`/blog/${r.slug}`}>{r.title}</NavAnchor>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </article>

      <HomeFooter loggedIn={loggedIn} />
    </div>
  );
}

export function BlogJsonLd({ post, baseUrl }: { post: BlogPostMeta; baseUrl: string }) {
  const json = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    image: [`${baseUrl}${post.headerImage}`],
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { '@type': 'Organization', name: SITE_BRAND.name },
    publisher: { '@type': 'Organization', name: SITE_BRAND.name },
    mainEntityOfPage: `${baseUrl}/blog/${post.slug}`,
    keywords: post.keywords.join(', '),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}