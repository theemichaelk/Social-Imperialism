'use client';

import Link from 'next/link';
import { FounderPortrait } from '@/components/FounderPortrait';
import { FOUNDER } from '@/lib/founder';

export function HomeFounderSection() {
  return (
    <section id="founder" className="home-section home-founder-section">
      <div className="home-section-bg-img" style={{ backgroundImage: 'url(/hero/slide-01.jpg)' }} aria-hidden />
      <div className="home-section-bg-overlay dark" aria-hidden />
      <div className="home-container">
        <span className="home-section-eyebrow">Founder</span>
        <h2>Meet the mind behind the platform</h2>
        <p className="home-section-sub">Author, architect, and operator — building tools that turn social noise into revenue.</p>

        <div className="home-founder-grid">
          <div className="home-founder-visual">
            <FounderPortrait showScan showCorners />
            <div className="home-founder-stats">
              {FOUNDER.highlights.map((h) => (
                <div key={h.label} className="home-founder-stat">
                  <span className="home-founder-stat-val">{h.value}</span>
                  <span className="home-founder-stat-label">{h.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="home-founder-copy home-glass-panel">
            <h3>{FOUNDER.name}</h3>
            <p className="home-founder-role">{FOUNDER.title} · {FOUNDER.role}</p>
            <p className="home-founder-tagline">{FOUNDER.tagline}</p>
            <p className="home-founder-bio-short">
              {FOUNDER.bio.split('\n\n')[0]}
            </p>
            <div className="home-hero-cta">
              <Link href="/founder" className="btn primary home-cta-lg home-btn-glow">Read Full Bio →</Link>
              <a href={FOUNDER.github} target="_blank" rel="noopener noreferrer" className="btn home-cta-lg home-btn-glass">GitHub</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}