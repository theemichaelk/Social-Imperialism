import Image from 'next/image';
import { NavAnchor } from '@/components/NavAnchor';
import { HomeFooter } from '@/components/HomeFooter';
import { HomePublicNav } from '@/components/HomePublicNav';
import { BlogArticleSidebar } from '@/components/BlogArticleSidebar';
import { BlogInlineSiloLinks } from '@/components/BlogInlineSiloLinks';
import type { BlogPostMeta } from '@/lib/blogPosts';
import type { BlogArticleBody } from '@/content/blog/articles';
import {
  BLOG_SILOS,
  getPublishedPosts,
  getPostsBySilo,
  type BlogSilo,
} from '@/lib/blogPosts';
import { SITE_BRAND } from '@/lib/siteBlueprint';

type Props = {
  post: BlogPostMeta & { body: BlogArticleBody };
  loggedIn?: boolean;
};

/** Deterministic mid-body image slots from slug (2 images placed within article). */
function midImageSlots(slug: string, sectionCount: number): [number, number] {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  const max = Math.max(2, sectionCount - 1);
  const a = 1 + (h % Math.min(3, max));
  let b = 2 + ((h >>> 3) % Math.min(4, max));
  if (b <= a) b = Math.min(max, a + 1 + (h % 2));
  return [a, b];
}

export function BlogPostLayout({ post, loggedIn = false }: Props) {
  const published = getPublishedPosts();
  const related = (() => {
    const same = getPostsBySilo(post.silo).filter((p) => p.slug !== post.slug);
    const others = published.filter((p) => p.silo !== post.silo && p.slug !== post.slug);
    const seen = new Set<string>();
    const out: typeof published = [];
    for (const p of [...same, ...others]) {
      if (seen.has(p.slug)) continue;
      seen.add(p.slug);
      out.push(p);
      if (out.length >= 8) break;
    }
    return out;
  })();

  const [imgSlotA, imgSlotB] = midImageSlots(post.slug, post.body.sections.length);
  const otherSilos = (Object.keys(BLOG_SILOS) as BlogSilo[]).filter((s) => s !== post.silo).slice(0, 3);
  const midSection = Math.floor(post.body.sections.length / 2);
  const lateSection = Math.max(midSection + 1, post.body.sections.length - 2);

  return (
    <div className="home-page blog-page si-blog-page">
      <div className="home-bg-grid" aria-hidden />
      <div className="home-floating-orb home-orb-1" aria-hidden />
      <div className="home-floating-orb home-orb-2" aria-hidden />

      <HomePublicNav loggedIn={loggedIn} variant="founder" />

      <div className="home-container si-article-layout">
        <div className="si-article-layout__main">
          <nav className="si-breadcrumbs" aria-label="Breadcrumb">
            <NavAnchor href="/">Home</NavAnchor>
            <span aria-hidden> / </span>
            <NavAnchor href="/blog">Blog</NavAnchor>
            <span aria-hidden> / </span>
            <NavAnchor href={`/blog?silo=${post.silo}`}>{post.siloLabel}</NavAnchor>
            <span aria-hidden> / </span>
            <span className="si-breadcrumbs__current">{post.title}</span>
          </nav>

          <article className="si-article" itemScope itemType="https://schema.org/BlogPosting">
            <header className="si-article-header">
              <div className="si-article-category">
                <NavAnchor href={`/blog?silo=${post.silo}`}>{post.siloLabel}</NavAnchor>
              </div>
              <h1 itemProp="headline">{post.title}</h1>
              <div className="si-article-meta">
                <span>By <span itemProp="author">Michael Kaswatuka</span></span>
                <time dateTime={post.publishedAt} itemProp="datePublished">
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                <span>{post.readMinutes} min read</span>
              </div>
            </header>

            <nav className="si-silo-crosslinks" aria-label="Related topics">
              <span className="si-silo-crosslinks__label">Also explore:</span>
              {otherSilos.map((s) => (
                <NavAnchor key={s} href={`/blog?silo=${s}`} className="si-silo-crosslink" rel="related">
                  {BLOG_SILOS[s].label}
                </NavAnchor>
              ))}
            </nav>

            {(post.aeoAnswer || post.geoLead) && (
              <>
                {post.aeoAnswer && (
                  <aside className="si-aeo-answer" data-speakable>
                    <div className="si-aeo-answer__label">Quick Answer (AEO)</div>
                    <p>{post.aeoAnswer}</p>
                  </aside>
                )}
                {(post.geoLead || (post.geoPoints && post.geoPoints.length > 0)) && (
                  <aside className="si-geo-summary" data-geo data-speakable>
                    <div className="si-geo-summary__label">AI Overview Summary (GEO)</div>
                    {post.geoLead && (
                      <p className="si-geo-summary__lead">
                        <strong>{post.title}</strong> — {post.geoLead}
                      </p>
                    )}
                    {post.geoPoints && post.geoPoints.length > 0 && (
                      <ul className="si-geo-summary__points">
                        {post.geoPoints.map((pt) => (
                          <li key={pt.slice(0, 40)}>{pt}</li>
                        ))}
                      </ul>
                    )}
                    <p className="si-geo-summary__cite">
                      Source: <NavAnchor href={`/blog/${post.slug}`}>{SITE_BRAND.name}</NavAnchor>
                      {' · '}Optimized for generative search &amp; Google AI Overviews
                    </p>
                  </aside>
                )}
              </>
            )}

            <div className="si-article-hero-image">
              <Image
                src={post.headerImage}
                alt={post.title}
                width={1200}
                height={560}
                priority
                unoptimized
                className="si-article-hero-img"
                itemProp="image"
              />
            </div>

            <div className="si-article-body" itemProp="articleBody">
              {post.body.sections.map((section, idx) => (
                <div key={`${post.slug}-sec-${idx}`}>
                  <section className="home-glass-panel blog-section si-article-section">
                    <h2>{section.heading}</h2>
                    {section.paragraphs.map((para, pIdx) => (
                      <p key={`${post.slug}-p-${idx}-${pIdx}`} className="blog-para">{para}</p>
                    ))}
                    {/* Intelligent silo placement inside the narrative — never a labeled “Silo links” box */}
                    {idx === 0 && post.siloLinks?.length ? (
                      <BlogInlineSiloLinks links={post.siloLinks} placement="early" />
                    ) : null}
                    {idx === midSection && post.siloLinks?.length ? (
                      <BlogInlineSiloLinks links={post.siloLinks} placement="mid" />
                    ) : null}
                    {idx === lateSection && post.siloLinks?.length ? (
                      <BlogInlineSiloLinks links={post.siloLinks} placement="late" />
                    ) : null}
                  </section>
                  {idx === imgSlotA && (
                    <figure className="si-inline-figure">
                      <Image
                        src={post.midImage1 || post.thumbnail}
                        alt={`${post.title} — news visual`}
                        width={1200}
                        height={640}
                        unoptimized
                        className="si-inline-img"
                      />
                      <figcaption>{post.midImage1Caption || 'News visual for this briefing.'}</figcaption>
                    </figure>
                  )}
                  {idx === imgSlotB && (
                    <figure className="si-inline-figure">
                      <Image
                        src={post.midImage2 || post.bottomImage}
                        alt={`${post.title} — supporting news visual`}
                        width={1200}
                        height={640}
                        unoptimized
                        className="si-inline-img"
                      />
                      <figcaption>{post.midImage2Caption || 'Supporting news graphic.'}</figcaption>
                    </figure>
                  )}
                  {idx === midSection && post.videoUrl && (
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
            </div>

            {related.length > 0 && (
              <section className="si-article-related" aria-label="Related coverage">
                <header className="si-article-related__head">
                  <div>
                    <h2>Related Topics</h2>
                    <p className="si-article-related__sub">
                      More from {post.siloLabel} and adjacent growth systems
                    </p>
                  </div>
                  <NavAnchor href={`/blog?silo=${post.silo}`} className="si-article-related__all">
                    View all {post.siloLabel} →
                  </NavAnchor>
                </header>
                <div className="si-related-grid">
                  {related.map((r) => (
                    <article key={r.slug} className="si-related-card home-glass-panel">
                      <NavAnchor href={`/blog/${r.slug}`} className="si-related-card__media" tabIndex={-1} aria-hidden>
                        <Image
                          src={r.thumbnail}
                          alt=""
                          width={400}
                          height={225}
                          unoptimized
                          className="si-related-card__img"
                        />
                      </NavAnchor>
                      <div className="si-related-card__body">
                        <span className="si-related-card__silo">{r.siloLabel}</span>
                        <h3 className="si-related-card__title">
                          <NavAnchor href={`/blog/${r.slug}`}>{r.title}</NavAnchor>
                        </h3>
                        <p className="si-related-card__excerpt">{r.excerpt}</p>
                        <NavAnchor href={`/blog/${r.slug}`} className="si-related-card__link">
                          Read article →
                        </NavAnchor>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </article>
        </div>

        <BlogArticleSidebar post={post} />
      </div>

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
    image: [
      `${baseUrl}${post.headerImage}`,
      `${baseUrl}${post.midImage1 || post.thumbnail}`,
      `${baseUrl}${post.midImage2 || post.bottomImage}`,
    ],
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: 'Michael Kaswatuka',
      jobTitle: 'Founder & Editor-in-Chief',
      url: `${baseUrl}/founder`,
    },
    publisher: { '@type': 'Organization', name: SITE_BRAND.name, url: baseUrl },
    mainEntityOfPage: `${baseUrl}/blog/${post.slug}`,
    keywords: post.keywords.join(', '),
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.si-aeo-answer', '.si-geo-summary'],
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
