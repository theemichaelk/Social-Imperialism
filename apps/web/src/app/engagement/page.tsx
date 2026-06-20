'use client';
import { FeaturePage } from '@/components/FeaturePage';

export default function EngagementPage() {
  return (
    <FeaturePage
      title="Engagement CRM"
      subtitle="LinkedIn lists, AI comments, auto-engage toggles"
      channels={[
        { channel: 'get-engagement-lists', label: 'Engagement Lists' },
        { channel: 'get-linked-accounts', label: 'Linked Accounts' },
      ]}
    />
  );
}