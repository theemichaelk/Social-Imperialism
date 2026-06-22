'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SHOWCASE_SLIDES } from '@/lib/homeMedia';

type Props = { loggedIn: boolean };

export function HomeShowcaseSlider({ loggedIn }: Props) {
  const [active, setActive] = useState(0);
  const slide = SHOWCASE_SLIDES[active];

  useEffect(() => {
    const t = setInterval(() => setActive((i) => (i + 1) % SHOWCASE_SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <section id="showcase" className="home-showcase">
      <div className="home-showcase-bg" style={{ backgroundImage: `url(${slide.image})` }} aria-hidden />
      <div className="home-showcase-overlay" aria-hidden />
      <div className="home-container">
        <div className="home-showcase-head">
          <span className="home-section-eyebrow">Product Tour</span>
          <h2>See the platform in motion</h2>
          <p className="home-section-sub">Swipe through live modules — each wired to real APIs.</p>
        </div>

        <div className="home-showcase-stage">
          <button
            type="button"
            className="home-showcase-nav prev"
            onClick={() => setActive((i) => (i - 1 + SHOWCASE_SLIDES.length) % SHOWCASE_SLIDES.length)}
            aria-label="Previous"
          >
            ‹
          </button>

          <div className="home-showcase-main">
            <div className="home-showcase-img-wrap">
              {SHOWCASE_SLIDES.map((s, i) => (
                <img
                  key={s.id}
                  src={s.image}
                  alt={s.title}
                  className={`home-showcase-img ${i === active ? 'visible' : ''}`}
                />
              ))}
              <div className="home-showcase-img-shine" />
              <div className="home-holo-corner tl" />
              <div className="home-holo-corner tr" />
              <div className="home-holo-corner bl" />
              <div className="home-holo-corner br" />
            </div>
            <div className="home-showcase-card-body">
              <h3 key={slide.id}>{slide.title}</h3>
              <p>{slide.caption}</p>
              <Link href="/dashboard" className="btn primary home-cta-sm">
                Open Module →
              </Link>
            </div>
          </div>

          <button
            type="button"
            className="home-showcase-nav next"
            onClick={() => setActive((i) => (i + 1) % SHOWCASE_SLIDES.length)}
            aria-label="Next"
          >
            ›
          </button>
        </div>

        <div className="home-showcase-thumbs">
          {SHOWCASE_SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`home-showcase-thumb ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
            >
              <img src={s.image} alt="" />
              <span>{s.title}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}