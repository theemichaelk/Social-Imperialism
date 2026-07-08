'use client';

import { PublicStaticPage } from '@/components/PublicStaticPage';
import { getAboutPageContent } from '@/lib/legalPages';

export default function AboutPage() {
  const content = getAboutPageContent();
  return (
    <PublicStaticPage
      {...content}
      actions={[
        { href: '/subscribe', label: 'Get Started', primary: true },
        { href: '/founder', label: 'Meet the Founder' },
        { href: '/contact', label: 'Contact' },
      ]}
    />
  );
}