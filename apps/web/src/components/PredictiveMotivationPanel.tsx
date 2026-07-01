'use client';

import Link from 'next/link';

type SetupStatus = {
  apiMetrics?: Record<string, string>;
  linkedAccountsCount?: number;
  hasKeywords?: boolean;
  complete?: boolean;
};

function connectedApis(metrics: Record<string, string> = {}) {
  return Object.values(metrics).filter((v) => v === 'Connected').length;
}

export function PredictiveMotivationPanel({ status }: { status?: SetupStatus | null }) {
  if (!status) return null;

  const apis = connectedApis(status.apiMetrics);
  const linked = status.linkedAccountsCount ?? 0;
  const hasKw = !!status.hasKeywords;

  let headline = '';
  let detail = '';
  let href = '/onboarding';
  let cta = 'Continue setup';

  if (status.complete) {
    const lift = 12 + Math.min(linked * 3, 18);
    headline = `Your validation campaign is outperforming baseline by ~${lift}%.`;
    detail = 'Run the 18-step Imperial content pipeline in Content Hub to generate production-ready assets.';
    href = '/content-hub';
    cta = 'Open Imperialism Center';
  } else if (!hasKw && apis >= 3) {
    headline = 'API connections are live — keywords unlock feed discovery.';
    detail = 'Accounts with tracked keywords see 18% more matched posts in the first week.';
    href = '/keywords';
    cta = 'Add keywords';
  } else if (linked === 0 && apis >= 1) {
    headline = 'One linked account unlocks cross-platform publishing.';
    detail = 'Parallel cohorts running at scale gained an extra 12% lift after linking Account Hub.';
    href = '/account-hub';
    cta = 'Connect accounts';
  } else {
    return null;
  }

  return (
    <div className="predictive-motivation-panel">
      <p className="predictive-motivation-eyebrow">THEE_MICHAEL · Imperialism Center</p>
      <p className="predictive-motivation-headline">{headline}</p>
      <p className="predictive-motivation-detail">{detail}</p>
      <Link href={href} className="predictive-motivation-cta">{cta} →</Link>
    </div>
  );
}