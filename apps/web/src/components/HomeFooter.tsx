'use client';

import { NavAnchor } from '@/components/NavAnchor';
import { Logo } from '@/components/Logo';
import { FooterCredit } from '@/components/FooterCredit';
import { FOOTER_LEGAL_LINKS, FOOTER_LINKS, SITE_FOOTER } from '@/lib/siteBlueprint';

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
        {items.filter((l) => !FOOTER_LEGAL_LINKS.some((x) => x.href === l.href)).map((l) => (
          <NavAnchor key={l.href + l.label} href={l.href}>{l.label}</NavAnchor>
        ))}
      </div>
      <div className="home-footer-legal">
        {FOOTER_LEGAL_LINKS.map((l) => (
          <NavAnchor key={l.href} href={l.href}>{l.label}</NavAnchor>
        ))}
      </div>
      <p className="home-footer-copy">{SITE_FOOTER.copyright()}</p>
      <FooterCredit />
    </footer>
  );
}