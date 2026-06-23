'use client';

import { PageHeader } from '@/components/PageHeader';
import { BrandGuidelinesPanel } from '@/components/BrandGuidelinesPanel';

export default function BrandPage() {
  return (
    <div>
      <PageHeader
        title="Brand Guidelines"
        subtitle="Voice, rules, and samples — injected into post generation and AI copy"
      />
      <BrandGuidelinesPanel />
    </div>
  );
}