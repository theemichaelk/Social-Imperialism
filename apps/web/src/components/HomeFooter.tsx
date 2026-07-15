'use client';

import { NavAnchor } from '@/components/NavAnchor';
import { Logo } from '@/components/Logo';
import { FooterCredit } from '@/components/FooterCredit';
import { FOOTER_LEGAL_LINKS, FOOTER_LINKS, SITE_FOOTER } from '@/lib/siteBlueprint';

type Props = {
  loggedIn?: boolean;
  links?: { href: string; label: string }[];
};

const DISCOVERY_HREFS = new Set(['/sitemap.html', '/sitemap.xml', '/feed.xml', '/rss']);

export function HomeFooter({ links }: Props) {
  const items = links ?? [...FOOTER_LINKS];
  const main = items.filter(
    (l) => !FOOTER_LEGAL_LINKS.some((x) => x.href === l.href) && !DISCOVERY_HREFS.has(l.href),
  );
  const discovery = items.filter((l) => DISCOVERY_HREFS.has(l.href));

  return (
    <footer className="home-footer">
      <Logo size="sm" showText />
      <div className="home-footer-links">
        {main.map((l) => (
          <NavAnchor key={l.href + l.label} href={l.href}>{l.label}</NavAnchor>
        ))}
      </div>
      <div className="home-footer-discovery" aria-label="Site discovery feeds">
        {discovery.length ? discovery.map((l) => (
          l.href.endsWith('.xml') ? (
            <a key={l.href + l.label} href={l.href}>{l.label}</a>
          ) : (
            <NavAnchor key={l.href + l.label} href={l.href}>{l.label}</NavAnchor>
          )
        )) : (
          <>
            <NavAnchor href="/sitemap.html">HTML Sitemap</NavAnchor>
            <a href="/sitemap.xml">XML Sitemap</a>
            <a href="/feed.xml">RSS Feed</a>
          </>
        )}
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