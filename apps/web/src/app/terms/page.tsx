'use client';

import { PublicStaticPage } from '@/components/PublicStaticPage';
import { getTermsPageContent } from '@/lib/legalPages';

export default function TermsPage() {
  return (
    <PublicStaticPage
      {...getTermsPageContent()}
      actions={[
        { href: '/privacy', label: 'Privacy Policy' },
        { href: '/contact', label: 'Contact' },
      ]}
    />
  );
}