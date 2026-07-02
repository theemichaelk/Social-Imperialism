'use client';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { AutomationCanvas } from '@/components/AutomationCanvas';
import { SectionLivePanel } from '@/components/SectionLivePanel';

export default function AutomationsPage() {
  return (
    <div>
      <PageShell
        title="Visual Automation Builder"
        actions={
          <>
            <Link href="/rules" className="btn">Auto-Rules</Link>
            <Link href="/account-hub" className="btn">Accounts</Link>
          </>
        }
      />
      <SectionLivePanel section="automations" />
      <AutomationCanvas />
    </div>
  );
}