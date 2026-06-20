'use client';
import { FeaturePage } from '@/components/FeaturePage';

export default function AccountCreatorPage() {
  return (
    <FeaturePage
      title="Account Creator"
      subtitle="AI profile kits, proxy pool, bulk generation, calendar push"
      channels={[
        { channel: 'get-profile-kits', label: 'Profile Kits' },
        { channel: 'get-proxy-pool', label: 'Proxy Pool' },
        { channel: 'get-account-creator-status', label: 'Creator Status' },
      ]}
    />
  );
}