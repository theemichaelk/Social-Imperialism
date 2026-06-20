'use client';
import { FeaturePage } from '@/components/FeaturePage';

export default function RulesPage() {
  return (
    <FeaturePage
      title="Auto-Rules Engine"
      subtitle="Worker control, Be First monitors, crisis moderation, fanpage automation"
      channels={[
        { channel: 'get-auto-rules', label: 'Auto Rules' },
        { channel: 'get-auto-rules-status', label: 'Worker Status' },
        { channel: 'get-watched-monitors', label: 'Be First Monitors' },
        { channel: 'get-worker-status', label: 'Background Worker' },
      ]}
    />
  );
}