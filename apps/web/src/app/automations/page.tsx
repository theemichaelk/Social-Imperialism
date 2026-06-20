'use client';
import { FeaturePage } from '@/components/FeaturePage';

export default function AutomationsPage() {
  return (
    <FeaturePage
      title="Visual Automation Builder"
      subtitle="Drag-drop flows, triggers, webhooks, deploy/test"
      channels={[
        { channel: 'get-automation-flow', label: 'Current Flow' },
        { channel: 'get-automation-templates', label: 'Templates' },
        { channel: 'get-automation-status', label: 'Deploy Status' },
        { channel: 'get-automation-builder-data', label: 'Builder Data' },
      ]}
    />
  );
}