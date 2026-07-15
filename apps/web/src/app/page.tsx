'use client';

import { useEffect, useState } from 'react';
import { NavAnchor } from '@/components/NavAnchor';
import { HomeHeroBanner } from '@/components/HomeHeroBanner';
import { HomeShowcaseSlider } from '@/components/HomeShowcaseSlider';
import { HomeTicker } from '@/components/HomeTicker';
import { HomeFounderSection } from '@/components/HomeFounderSection';
import { HomeFooter } from '@/components/HomeFooter';
import { HomePublicNav } from '@/components/HomePublicNav';
import { getApiBase, getToken } from '@/lib/api';
import {
  BILLING_PLANS,
  getAllModuleFeatures,
  getFeaturesSectionCopy,
  getIntelligenceHighlights,
  getMarketingPlatforms,
  getOnboardingSteps,
  getSiteCapabilities,
} from '@/lib/siteBlueprint';
import { getPublishedPosts } from '@/lib/blogPosts';
import Image from 'next/image';

const DASH_STATS = [
  { label: 'Overview', pct: 92, color: '#38bdf8' },
  { label: 'Feed', pct: 78, color: '#a855f7' },
  { label: 'Growth', pct: 65, color: '#22c55e' },
  { label: 'Analytics', pct: 88, color: '#f59e0b' },
];

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    setLoggedIn(!!getToken());
    fetch(`${getApiBase()}/health`)
      .then((r) => r.json())
      .then((d) => setApiOk(!!d?.ok))
      .catch(() => setApiOk(false));
  }, []);

  const allFeatures = getAllModuleFeatures();
  const featuresCopy = getFeaturesSectionCopy();
  const capabilities = getSiteCapabilities();
  const platforms = getMarketingPlatforms();
  const steps = getOnboardingSteps();
  const intelligenceBullets = getIntelligenceHighlights();
  const apiLabel = apiOk ? 'API LIVE' : apiOk === false ? 'OFFLINE' : 'CONNECTING';

  return (
    <div className="home-page">
      <div className="home-bg-grid" aria-hidden />
      <div className="hex-mesh" aria-hidden />
      <div className="home-floating-orb home-orb-1" aria-hidden />
      <div className="home-floating-orb home-orb-2" aria-hidden />
      <div className="dash-scanlines" aria-hidden />

      <HomePublicNav loggedIn={loggedIn} variant="home" />

      <HomeHeroBanner loggedIn={loggedIn} apiLabel={apiLabel} />
      <HomeTicker />

      <section className="home-metrics-band">
        <div className="home-container home-cap-grid-wide">
          {capabilities.map((c) => (
            <div key={c.label} className="home-cap-tile home-cap-glow">
              <div className="home-cap-val">{c.value}</div>
              <div className="home-cap-label">{c.label}</div>
              <div className="home-cap-sub">{c.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <HomeShowcaseSlider loggedIn={loggedIn} />

      <section id="platforms" className="home-section home-section-media">
        <div className="home-section-bg-img" style={{ backgroundImage: 'url(/hero/slide-02.jpg)' }} aria-hidden />
        <div className="home-section-bg-overlay" aria-hidden />
        <div className="home-container">
          <span className="home-section-eyebrow">Integrations</span>
          <h2>Connected to the networks that matter</h2>
          <p className="home-section-sub">Real OAuth, API keys, and live feeds — not mocks.</p>
          <div className="home-platform-strip">
            {platforms.map((p) => (
              <span key={p} className="home-platform-chip home-platform-glow">{p}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="home-section">
        <div className="home-container">
          <span className="home-section-eyebrow">{featuresCopy.eyebrow}</span>
          <h2>{featuresCopy.title}</h2>
          <p className="home-section-sub">{featuresCopy.subtitle}</p>
          <div className="home-feature-grid">
            {allFeatures.map((f) => (
              <NavAnchor key={f.id} href={f.href} className="home-feature-card home-feature-glow">
                <span className="home-feature-icon">{f.icon}</span>
                <div className="home-feature-text">
                  <div className="home-feature-section">{f.section}</div>
                  <div className="home-feature-title">{f.label}</div>
                </div>
              </NavAnchor>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-section-alt home-section-media">
        <div className="home-section-bg-img" style={{ backgroundImage: 'url(/hero/slide-08.jpg)' }} aria-hidden />
        <div className="home-section-bg-overlay" aria-hidden />
        <div className="home-container home-split">
          <div className="home-split-copy home-glass-panel">
            <span className="home-section-eyebrow">Intelligence</span>
            <h2>Real-time intelligence</h2>
            <p className="home-section-sub left">
              Live feeds, trending topics, domain authority, engagement queues, and worker status —
              actionable charts on every dashboard tab.
            </p>
            <ul className="home-checklist">
              {intelligenceBullets.map((t) => <li key={t}>{t}</li>)}
            </ul>
            <NavAnchor href={loggedIn ? '/dashboard' : '/subscribe'} className="btn primary home-cta-lg home-btn-glow">
              {loggedIn ? 'Open Mission Control' : 'Get Started'}
            </NavAnchor>
          </div>
          <div className="home-stats-panel home-glass-panel">
            {DASH_STATS.map((s) => (
              <div key={s.label} className="home-stat-row">
                <span className="home-stat-label">{s.label}</span>
                <div className="home-stat-bar-track">
                  <div className="home-stat-bar-fill" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
                <span className="home-stat-pct" style={{ color: s.color }}>{s.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="home-section">
        <div className="home-container">
          <span className="home-section-eyebrow">Onboarding</span>
          <h2>Go live in four steps</h2>
          <p className="home-section-sub">Setup Wizard walks you from zero to automated engagement.</p>
          <div className="home-steps">
            {steps.map((s) => (
              <div key={s.n} className="home-step-card home-glass-panel">
                <div className="home-step-num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="home-center-cta">
            <NavAnchor href="/subscribe" className="btn primary home-cta-lg home-btn-glow">
              Get Started →
            </NavAnchor>
          </div>
        </div>
      </section>

      <section id="pricing" className="home-section home-section-media">
        <div className="home-section-bg-img" style={{ backgroundImage: 'url(/hero/slide-07.jpg)' }} aria-hidden />
        <div className="home-section-bg-overlay dark" aria-hidden />
        <div className="home-container">
          <span className="home-section-eyebrow">Pricing</span>
          <h2>Simple, scalable pricing</h2>
          <p className="home-section-sub">Start small, grow into agency-scale automation.</p>
          <div className="home-pricing-grid">
            {BILLING_PLANS.map((plan) => (
              <div key={plan.id} className={`home-plan-card home-glass-panel ${plan.highlight ? 'highlight' : ''}`}>
                {plan.highlight && <span className="home-plan-badge">Most Popular</span>}
                <h3>{plan.name}</h3>
                <div className="home-plan-price">
                  {plan.price}<span>{plan.period}</span>
                </div>
                <ul>
                  {plan.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
                <NavAnchor href={plan.id === 'enterprise' ? 'mailto:sales@socialimperialism.com' : `/subscribe?plan=${plan.id}`} className={`btn home-btn-block ${plan.highlight ? 'primary home-btn-glow' : 'home-btn-glass'}`}>
                  {plan.id === 'enterprise' ? 'Contact Sales' : 'Choose Plan'}
                </NavAnchor>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="blog" className="home-section">
        <div className="home-container">
          <span className="home-section-eyebrow">Blog · AEO / GEO</span>
          <h2>Authority guides for social + search operators</h2>
          <p className="home-section-sub">
            Long-form playbooks engineered for answer engines and generative overviews — updated weekly via drip schedule.
          </p>
          <div className="blog-grid home-blog-grid">
            {getPublishedPosts().slice(0, 4).map((post) => (
              <article key={post.slug} className="home-glass-panel blog-card">
                <NavAnchor href={`/blog/${post.slug}`} className="blog-card-link">
                  <div className="blog-card-thumb">
                    <Image src={post.thumbnail} alt={post.title} width={400} height={220} className="blog-card-img" />
                    <span className="blog-card-silo">{post.siloLabel}</span>
                  </div>
                  <div className="blog-card-body">
                    <time dateTime={post.publishedAt}>
                      {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </time>
                    <h3 style={{ fontSize: '1.05rem', margin: '0.4rem 0 0.5rem' }}>{post.title}</h3>
                    <p>{post.excerpt}</p>
                    <span className="blog-card-cta">Read article →</span>
                  </div>
                </NavAnchor>
              </article>
            ))}
          </div>
          <div className="home-center-cta" style={{ marginTop: '1.5rem' }}>
            <NavAnchor href="/blog" className="btn primary home-cta-lg home-btn-glow">View all blog posts</NavAnchor>
            <NavAnchor href="/sitemap.html" className="btn home-cta-lg home-btn-glass">HTML sitemap</NavAnchor>
            <NavAnchor href="/feed.xml" className="btn home-cta-lg home-btn-glass">RSS feed</NavAnchor>
          </div>
        </div>
      </section>

      <HomeFounderSection />

      <section className="home-cta-band home-cta-video">
        <video
          className="home-cta-video-bg"
          autoPlay
          muted
          loop
          playsInline
          poster="/hero/slide-15.jpg"
          src="https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-futuristic-devices-99786-large.mp4"
        />
        <div className="home-cta-video-overlay" aria-hidden />
        <div className="home-container">
          <h2>Ready to dominate your niche?</h2>
          <p>Join teams using AI-powered social automation with full API connectivity.</p>
          <div className="home-hero-cta center">
            <NavAnchor href="/subscribe" className="btn primary home-cta-lg home-btn-glow">Subscribe</NavAnchor>
            <NavAnchor href="/integrations" className="btn home-cta-lg home-btn-glass">Explore Integrations</NavAnchor>
          </div>
        </div>
      </section>

      <HomeFooter loggedIn={loggedIn} />
    </div>
  );
}