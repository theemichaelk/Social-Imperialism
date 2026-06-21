'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { HERO_SLIDES } from '@/lib/homeMedia';

type Props = {
  loggedIn: boolean;
  apiLabel: string;
};

export function HomeHeroBanner({ loggedIn, apiLabel }: Props) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = HERO_SLIDES[active];

  const next = useCallback(() => {
    setActive((i) => (i + 1) % HERO_SLIDES.length);
  }, []);

  const prev = useCallback(() => {
    setActive((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(next, 6000);
    return () => clearInterval(t);
  }, [paused, next]);

  return (
    <section
      className="home-hero-banner"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="home-hero-slides" aria-hidden>
        {HERO_SLIDES.map((s, i) => (
          <div key={s.id} className={`home-hero-slide ${i === active ? 'active' : ''}`}>
            {s.video && (
              <video
                className="home-hero-media"
                autoPlay
                muted
                loop
                playsInline
                poster={s.image}
                src={i === active ? s.video : undefined}
              />
            )}
            <div
              className="home-hero-media home-hero-image"
              style={{ backgroundImage: `url(${s.image})` }}
            />
            <div className="home-hero-slide-tint" style={{ background: `linear-gradient(135deg, ${s.accent}22, transparent 55%)` }} />
          </div>
        ))}
      </div>

      <div className="home-aurora" aria-hidden />
      <div className="home-scanlines" aria-hidden />
      <div className="home-noise" aria-hidden />

      <div className="home-hero-banner-content home-container">
        <div className="home-hero-banner-grid">
          <div className="home-hero-banner-copy">
            <span className="home-live-badge">
              <span className="home-live-dot" />
              {apiLabel}
            </span>
            <span className="home-hero-tag" style={{ borderColor: slide.accent, color: slide.accent }}>
              {slide.tag}
            </span>
            <h1 className="home-banner-title">{slide.title}</h1>
            <p className="home-banner-sub">{slide.subtitle}</p>
            <div className="home-hero-cta">
              {loggedIn ? (
                <>
                  <Link href="/dashboard" className="btn primary home-cta-lg home-btn-glow">Mission Control →</Link>
                  <Link href="/onboarding" className="btn home-cta-lg home-btn-glass">Setup Wizard</Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn primary home-cta-lg home-btn-glow">Start Free Trial</Link>
                  <a href="#showcase" className="btn home-cta-lg home-btn-glass">Watch Demo</a>
                </>
              )}
            </div>
            <div className="home-hero-controls">
              <button type="button" className="home-hero-arrow" onClick={prev} aria-label="Previous slide">‹</button>
              <div className="home-hero-dots">
                {HERO_SLIDES.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`home-hero-dot ${i === active ? 'active' : ''}`}
                    style={i === active ? { background: s.accent, boxShadow: `0 0 12px ${s.accent}` } : undefined}
                    onClick={() => setActive(i)}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
              <button type="button" className="home-hero-arrow" onClick={next} aria-label="Next slide">›</button>
            </div>
          </div>

          <div className="home-hero-banner-visual">
            <div className="home-holo-frame">
              <div className="home-holo-corner tl" />
              <div className="home-holo-corner tr" />
              <div className="home-holo-corner bl" />
              <div className="home-holo-corner br" />
              <img
                src={slide.image}
                alt={slide.title}
                className="home-holo-img"
              />
              <div className="home-holo-scan" />
            </div>
            <div className="home-orbit home-orbit-1" />
            <div className="home-orbit home-orbit-2" />
          </div>
        </div>
      </div>

      <div className="home-hero-progress">
        <div
          className="home-hero-progress-bar"
          key={active}
          style={{ background: slide.accent }}
        />
      </div>
    </section>
  );
}