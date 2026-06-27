'use client';

import { NavAnchor } from '@/components/NavAnchor';
import { Logo } from '@/components/Logo';
import { FooterCredit } from '@/components/FooterCredit';
import { FOOTER_LINKS, SITE_FOOTER } from '@/lib/siteBlueprint';

type Props = {
  loggedIn?: boolean;
  links?: { href: string; label: string }[];
};

export function HomeFooter({ links }: Props) {
  const items = links ?? [...FOOTER_LINKS];

  return (
    <footer className="home-footer">
      <Logo size="sm" showText />
      <div className="home-footer-links">
        {items.map((l) => (
          <NavAnchor key={l.href + l.label} href={l.href}>{l.label}</NavAnchor>
        ))}
      </div>
      <p className="home-footer-copy">{SITE_FOOTER.copyright()}</p>
      <FooterCredit />
    </footer>
  );
}