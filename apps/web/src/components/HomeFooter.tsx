'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { FooterCredit } from '@/components/FooterCredit';

type Props = {
  loggedIn?: boolean;
  links?: { href: string; label: string }[];
};

const DEFAULT_LINKS = (loggedIn: boolean) => [
  { href: '/login', label: 'Sign In' },
  { href: loggedIn ? '/onboarding' : '/login', label: 'Setup' },
  { href: loggedIn ? '/integrations' : '/login', label: 'Integrations' },
  { href: loggedIn ? '/settings' : '/login', label: 'Settings' },
  { href: '/founder', label: 'Founder' },
];

export function HomeFooter({ loggedIn = false, links }: Props) {
  const items = links ?? DEFAULT_LINKS(loggedIn);

  return (
    <footer className="home-footer">
      <Logo size="sm" showText />
      <div className="home-footer-links">
        {items.map((l) => (
          <Link key={l.href + l.label} href={l.href}>{l.label}</Link>
        ))}
      </div>
      <p className="home-footer-copy">© {new Date().getFullYear()} Social Imperialism. All rights reserved.</p>
      <FooterCredit />
    </footer>
  );
}