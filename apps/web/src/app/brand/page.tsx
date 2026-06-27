'use client';

import { PageShell } from '@/components/PageShell';
import { BrandGuidelinesPanel } from '@/components/BrandGuidelinesPanel';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { GrokToolbar } from '@/components/GrokToolbar';

export default function BrandPage() {
  return (
    <div>
      <PageShell title="Brand Guidelines" />
      <SectionLivePanel section="brand" showAccounts={false} />
      <GrokToolbar pageId="brand" compact title="Brand AI" />
      <BrandGuidelinesPanel />
    </div>
  );
}