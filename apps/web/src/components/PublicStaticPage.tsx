'use client';

import { useEffect, useState } from 'react';
import { HomePublicNav } from '@/components/HomePublicNav';
import { HomeFooter } from '@/components/HomeFooter';
import { NavAnchor } from '@/components/NavAnchor';
import { getToken } from '@/lib/api';
import type { StaticPageContent } from '@/lib/legalPages';

type Props = StaticPageContent & {
  actions?: Array<{ href: string; label: string; primary?: boolean }>;
};

export function PublicStaticPage({ eyebrow, title, subtitle, sections, actions }: Props) {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getToken());
  }, []);

  return (
    <div className="home-page public-static-page">
      <div className="home-bg-grid" aria-hidden />
      <div className="home-floating-orb home-orb-1" aria-hidden />
      <div className="home-floating-orb home-orb-2" aria-hidden />

      <HomePublicNav loggedIn={loggedIn} variant="founder" />

      <section className="home-section public-static-hero">
        <div className="home-container public-static-container">
          <span className="home-section-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          {subtitle && <p className="public-static-lead">{subtitle}</p>}

          <div className="public-static-sections">
            {sections.map((section) => (
              <article key={section.title} className="home-glass-panel public-static-block">
                <h2>{section.title}</h2>
                {section.paragraphs.map((para) => (
                  <p key={para.slice(0, 48)} className="public-static-para">{para}</p>
                ))}
                {section.bullets && section.bullets.length > 0 && (
                  <ul className="public-static-list">
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>

          {actions && actions.length > 0 && (
            <div className="public-static-actions">
              {actions.map((a) => (
                <NavAnchor
                  key={a.href + a.label}
                  href={a.href}
                  className={`btn ${a.primary ? 'primary home-btn-glow' : 'home-btn-glass'}`}
                >
                  {a.label}
                </NavAnchor>
              ))}
            </div>
          )}
        </div>
      </section>

      <HomeFooter loggedIn={loggedIn} />
    </div>
  );
}