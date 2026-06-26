'use client';

import { PageHeader } from '@/components/PageHeader';
import { BrandGuidelinesPanel } from '@/components/BrandGuidelinesPanel';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { GrokToolbar } from '@/components/GrokToolbar';

export default function BrandPage() {
  return (
    <div>
      <PageHeader
        title="Brand Guidelines"
        subtitle="Voice, rules, and samples — injected into post generation and AI copy"
      />
      <SectionLivePanel section="brand" showAccounts={false} />
      <GrokToolbar pageId="brand" compact title="Brand AI" />
      <BrandGuidelinesPanel />
    </div>
  );
}