'use client';

import { NavAnchor } from '@/components/NavAnchor';
import { Logo } from '@/components/Logo';
import { FooterCredit } from '@/components/FooterCredit';

type Props = {
  loggedIn?: boolean;
  links?: { href: string; label: string }[];
};

const DEFAULT_LINKS = () => [
  { href: '/login', label: 'Sign In' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard', label: 'Integrations' },
  { href: '/dashboard', label: 'Settings' },
  { href: '/founder', label: 'Founder' },
];

export function HomeFooter({ loggedIn = false, links }: Props) {
  const items = links ?? DEFAULT_LINKS();

  return (
    <footer className="home-footer">
      <Logo size="sm" showText />
      <div className="home-footer-links">
        {items.map((l) => (
          <NavAnchor key={l.href + l.label} href={l.href}>{l.label}</NavAnchor>
        ))}
      </div>
      <p className="home-footer-copy">© {new Date().getFullYear()} Social Imperialism. All rights reserved.</p>
      <FooterCredit />
    </footer>
  );
}