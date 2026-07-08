'use client';

import { PublicStaticPage } from '@/components/PublicStaticPage';
import { getPrivacyPageContent } from '@/lib/legalPages';

export default function PrivacyPage() {
  return <PublicStaticPage {...getPrivacyPageContent()} />;
}