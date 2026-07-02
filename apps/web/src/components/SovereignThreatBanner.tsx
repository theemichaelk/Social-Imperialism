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

  const loadStatus = () => {
    invoke<SovereignStatus>('get-sovereign-threat-status')
      .then(setStatus)
      .catch(() => setStatus(null));
  };

  useEffect(() => {
    loadStatus();
    const id = setInterval(loadStatus, 120000);
    return () => clearInterval(id);
  }, []);

  const pending = status?.pendingReviewCount ?? 0;
  const frozen = !!status?.liveFrozen;
  const openCount = status?.openThreatCount ?? 0;
  if (!frozen && pending === 0 && openCount === 0) {
    return null;
  }

  const compact = pending > 0 && !frozen && openCount === 0;

  return (
    <div className={`sovereign-banner-card card ${compact ? 'sovereign-banner-compact' : ''}`} role="alert">
      {!compact && <p className="sovereign-banner-text">{THEE_MICHAEL_BANNER}</p>}
      <p style={{ margin: compact ? 0 : '0.35rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {pending > 0
          ? `${pending} routine action(s) logged — review in Security Control when convenient.`
          : frozen
            ? 'Live paths frozen — review and decide in Security Control.'
            : `${openCount} contained threat(s) under review.`}
      </p>
      <Link href="/settings?tab=guardian-api" className="btn btn-sm" style={{ marginTop: compact ? 0 : '0.5rem' }}>
        {compact ? `Review (${pending})` : `Open ${THEE_MICHAEL} Security Control`}
      </Link>
    </div>
  );
}