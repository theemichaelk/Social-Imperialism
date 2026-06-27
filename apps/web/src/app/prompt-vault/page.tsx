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
            <Link href="/content-hub" className="btn">Content Hub</Link>
            <Link href="/keywords" className="btn">Keywords</Link>
            <Link href="/settings" className="btn">Settings</Link>
          </>
        }
      />
      <SectionLivePanel section="prompt-vault" showAccounts={false} />
      <PromptVaultPanel />
    </div>
  );
}