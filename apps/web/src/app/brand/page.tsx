'use client';

import { PageShell } from '@/components/PageShell';
import { BrandGuidelinesPanel } from '@/components/BrandGuidelinesPanel';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { GrokToolbar } from '@/components/GrokToolbar';
import Link from 'next/link';

export default function BrandPage() {
  return (
    <div>
      <PageShell
        title="Brand"
        actions={
          <>
            <Link href="/onboarding" className="btn primary">Setup Wizard</Link>
            <Link href="/history" className="btn">AI Replies</Link>
            <Link href="/prompt-vault" className="btn">Prompt Vault</Link>
          </>
        }
      />
      <SectionLivePanel section="brand" showAccounts={false} />
      <GrokToolbar pageId="brand" compact title="Brand AI" />
      <BrandGuidelinesPanel />
    </div>
  );
}