'use client';

import { PageHeader } from '@/components/PageHeader';
import { BrandGuidelinesPanel } from '@/components/BrandGuidelinesPanel';
import { SectionLivePanel } from '@/components/SectionLivePanel';

export default function BrandPage() {
  return (
    <div>
      <PageHeader
        title="Brand Guidelines"
        subtitle="Voice, rules, and samples — injected into post generation and AI copy"
      />
      <SectionLivePanel section="brand" showAccounts={false} />
      <BrandGuidelinesPanel />
    </div>
  );
}