'use client';

import { PublicStaticPage } from '@/components/PublicStaticPage';
import { getContactPageContent } from '@/lib/legalPages';
import { FOUNDER } from '@/lib/founder';

export default function ContactPage() {
  const content = getContactPageContent();
  return (
    <PublicStaticPage
      {...content}
      actions={[
        { href: `mailto:${FOUNDER.email}`, label: 'Email Support', primary: true },
        { href: '/support', label: 'Imperialism Brain (subscribers)' },
        { href: '/subscribe', label: 'Subscribe' },
      ]}
    />
  );
}