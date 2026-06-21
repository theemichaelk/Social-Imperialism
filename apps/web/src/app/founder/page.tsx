'use client';

import Link from 'next/link';
import { FounderPortrait } from '@/components/FounderPortrait';
import { Logo } from '@/components/Logo';
import { HomeFooter } from '@/components/HomeFooter';
import { FOUNDER } from '@/lib/founder';

export default function FounderPage() {
  return (
    <div className="home-page founder-page">
      <div className="home-bg-grid" aria-hidden />
      <div className="home-floating-orb home-orb-1" aria-hidden />
      <div className="home-floating-orb home-orb-2" aria-hidden />

      <header className="home-nav home-nav-glass">
        <div className="home-nav-brand">
          <Link href="/"><Logo size="sm" showText /></Link>
        </div>
        <nav className="home-nav-links">
          <Link href="/">Home</Link>
          <Link href="/#showcase">Demo</Link>
          <Link href="/integrations">Integrations</Link>
        </nav>
        <div className="home-nav-actions">
          <Link href="/login" className="btn primary home-btn-glow">Get Started</Link>
        </div>
      </header>

      <section className="founder-hero">
        <div className="home-container founder-hero-inner">
          <div className="founder-hero-visual">
            <FounderPortrait className="founder-hero-portrait" showCorners />
          </div>
          <div className="founder-hero-copy">
            <span className="home-section-eyebrow">Author & Founder</span>
            <h1>{FOUNDER.name}</h1>
            <p className="founder-hero-role">{FOUNDER.title}</p>
            <p className="founder-hero-tagline">{FOUNDER.tagline}</p>
            <div className="founder-hero-stats">
              {FOUNDER.highlights.map((h) => (
                <div key={h.label} className="home-founder-stat">
                  <span className="home-founder-stat-val">{h.value}</span>
                  <span className="home-founder-stat-label">{h.label}</span>
                  <span className="home-founder-stat-sub">{h.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-container home-split">
          <div className="home-glass-panel founder-bio-panel">
            <h2>About Michael K</h2>
            {FOUNDER.bio.split('\n\n').map((para) => (
              <p key={para.slice(0, 40)} className="founder-bio-para">{para}</p>
            ))}
            <div className="founder-contact">
              <a href={`mailto:${FOUNDER.email}`} className="btn home-btn-glass">{FOUNDER.email}</a>
              <a href={FOUNDER.github} target="_blank" rel="noopener noreferrer" className="btn home-btn-glass">GitHub →</a>
            </div>
          </div>
          <div className="founder-principles">
            <h2>Founding Principles</h2>
            {FOUNDER.principles.map((p) => (
              <div key={p.title} className="founder-principle-card home-glass-panel">
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-section-alt">
        <div className="home-container">
          <span className="home-section-eyebrow">Timeline</span>
          <h2>The journey</h2>
          <div className="founder-timeline">
            {FOUNDER.timeline.map((t) => (
              <div key={t.year} className="founder-timeline-item home-glass-panel">
                <span className="founder-timeline-year">{t.year}</span>
                <p>{t.event}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-cta-band">
        <div className="home-container">
          <h2>Built by Michael K. Ready for your team.</h2>
          <p>Start automating social growth with the platform he designed from the ground up.</p>
          <div className="home-hero-cta center">
            <Link href="/login" className="btn primary home-cta-lg home-btn-glow">Create Account</Link>
            <Link href="/" className="btn home-cta-lg home-btn-glass">← Back to Home</Link>
          </div>
        </div>
      </section>

      <HomeFooter
        links={[
          { href: '/', label: 'Home' },
          { href: '/founder', label: 'Founder' },
          { href: '/integrations', label: 'Integrations' },
          { href: '/login', label: 'Sign In' },
        ]}
      />
    </div>
  );
}