'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import {
  THEE_MICHAEL,
  THEE_MICHAEL_BANNER,
  type SovereignStatus,
} from '@/lib/sovereignThreatCapture';

export function SovereignThreatBanner() {
  const [status, setStatus] = useState<SovereignStatus | null>(null);

  useEffect(() => {
    invoke<SovereignStatus>('get-sovereign-threat-status')
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const pending = status?.pendingReviewCount ?? 0;
  if (!status?.liveFrozen && pending === 0 && !(status?.openThreatCount && status.openThreatCount > 0)) {
    return null;
  }

  return (
    <div className="sovereign-banner-card card" role="alert">
      <p className="sovereign-banner-text">{THEE_MICHAEL_BANNER}</p>
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {pending > 0
          ? `${pending} action(s) awaiting ${THEE_MICHAEL} Accept or Deny before they are final.`
          : status?.liveFrozen
            ? 'Live paths frozen — review and decide in Security Control.'
            : `${status?.openThreatCount} contained threat(s) under review.`}
      </p>
      <Link href="/settings?tab=guardian-api" className="btn btn-sm" style={{ marginTop: '0.5rem' }}>
        Open {THEE_MICHAEL} Security Control
      </Link>
    </div>
  );
}