'use client';

import { PageShell } from '@/components/PageShell';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { UserAccountPanel } from '@/components/UserAccountPanel';

export default function DashboardUsersPage() {
  return (
    <>
      <PageShell
        title="My Account"
        subtitle="Your profile, organization, campaigns, and public site discovery feeds"
        eyebrow="Dashboard / Users"
      />
      <SectionLivePanel section="dashboard-users" />
      <UserAccountPanel />
    </>
  );
}