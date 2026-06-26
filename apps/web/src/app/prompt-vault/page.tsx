'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { PromptVaultPanel } from '@/components/PromptVaultPanel';

export default function PromptVaultPage() {
  return (
    <div>
      <PageHeader
        title="Prompt Vault"
        subtitle="Create, search, load, export, and delete reusable prompt templates — routed to the right features and brain workflows"
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