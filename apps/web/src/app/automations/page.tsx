'use client';
import { PageHeader } from '@/components/PageHeader';
import { AutomationCanvas } from '@/components/AutomationCanvas';

export default function AutomationsPage() {
  return (
    <div>
      <PageHeader title="Visual Automation Builder" subtitle="Drag-drop triggers, actions, and logic — deploy and test flows" />
      <AutomationCanvas />
    </div>
  );
}