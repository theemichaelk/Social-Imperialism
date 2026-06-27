'use client';
import { PageShell } from '@/components/PageShell';
import { AutomationCanvas } from '@/components/AutomationCanvas';
import { SectionLivePanel } from '@/components/SectionLivePanel';

export default function AutomationsPage() {
  return (
    <div>
      <PageShell title="Visual Automation Builder" />
      <SectionLivePanel section="automations" />
      <AutomationCanvas />
    </div>
  );
}