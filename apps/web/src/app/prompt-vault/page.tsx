'use client';

import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { PromptVaultPanel } from '@/components/PromptVaultPanel';

export default function PromptVaultPage() {
  return (
    <div>
      <PageShell
        title="Prompt Vault"
        actions={
          <>
            <Link href="/content-hub?tab=studio" className="btn primary">Create with Prompt →</Link>
            <Link href="/keywords" className="btn">Keywords</Link>
            <Link href="/brand" className="btn">Brand</Link>
          </>
        }
      />
      <SectionLivePanel section="prompt-vault" showAccounts={false} />
      <PromptVaultPanel />
    </div>
  );
}