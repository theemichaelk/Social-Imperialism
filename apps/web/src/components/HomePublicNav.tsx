'use client';

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
  const actions = getPublicNavActions(loggedIn);

  return (
    <header className="home-nav home-nav-glass">
      <div className="home-nav-brand">
        <NavAnchor href="/" style={{ textDecoration: 'none' }}>
          <Logo size="sm" showText />
        </NavAnchor>
      </div>
      <nav className="home-nav-links">
        {variant === 'home' ? (
          <>
            {PUBLIC_NAV_ANCHORS.map((l) => (
              <a key={l.id} href={l.href}>{l.label}</a>
            ))}
            {PUBLIC_NAV_ROUTES.map((l) => (
              <NavAnchor key={l.id} href={l.href}>{l.label}</NavAnchor>
            ))}
          </>
        ) : (
          <>
            <NavAnchor href="/">Home</NavAnchor>
            <a href="/#showcase">Demo</a>
            <NavAnchor href="/integrations">Integrations</NavAnchor>
            <NavAnchor href="/founder">Founder</NavAnchor>
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