'use client';

import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';
import { NavAnchor } from '@/components/NavAnchor';
import {
  PUBLIC_NAV_ANCHORS,
  PUBLIC_NAV_ROUTES,
  getPublicNavActions,
} from '@/lib/siteBlueprint';

type Props = {
  loggedIn?: boolean;
  /** Show full anchor nav (home) or minimal links (founder subpage) */
  variant?: 'home' | 'founder';
};

export function HomePublicNav({ loggedIn = false, variant = 'home' }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const actions = getPublicNavActions(loggedIn);

  useEffect(() => {
    setMobileOpen(false);
  }, [variant]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="home-nav home-nav-glass">
      <div className="home-nav-brand">
        <NavAnchor href="/" style={{ textDecoration: 'none' }} onClick={closeMobile}>
          <Logo size="sm" showText />
        </NavAnchor>
      </div>
      <button
        type="button"
        className="home-nav-toggle"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen ? '✕' : '☰'}
      </button>
      {mobileOpen && (
        <button
          type="button"
          className="home-nav-backdrop home-nav-backdrop-open"
          aria-label="Close menu"
          onClick={closeMobile}
        />
      )}
      <nav className={`home-nav-links${mobileOpen ? ' home-nav-links-open' : ''}`}>
        {variant === 'home' ? (
          <>
            {PUBLIC_NAV_ANCHORS.map((l) => (
              <a key={l.id} href={l.href} onClick={closeMobile}>{l.label}</a>
            ))}
            {PUBLIC_NAV_ROUTES.map((l) => (
              <NavAnchor key={l.id} href={l.href} onClick={closeMobile}>{l.label}</NavAnchor>
            ))}
          </>
        ) : (
          <>
            <NavAnchor href="/" onClick={closeMobile}>Home</NavAnchor>
            <a href="/#showcase" onClick={closeMobile}>Demo</a>
            <NavAnchor href="/integrations" onClick={closeMobile}>Integrations</NavAnchor>
            <NavAnchor href="/about" onClick={closeMobile}>About</NavAnchor>
            <NavAnchor href="/contact" onClick={closeMobile}>Contact</NavAnchor>
            <NavAnchor href="/founder" onClick={closeMobile}>Founder</NavAnchor>
          </>
        )}
      </nav>
      <div className="home-nav-actions">
        {actions.map((a) => (
          <NavAnchor
            key={a.id}
            href={a.href}
            className={`btn ${a.variant === 'primary' ? 'primary home-btn-glow' : 'home-btn-glass'}`}
          >
            {a.label}
          </NavAnchor>
        ))}
      </div>
    </header>
  );
}