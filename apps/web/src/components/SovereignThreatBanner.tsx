'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import {
  SOVEREIGN_ADMIN,
  SOVEREIGN_BANNER,
  type SovereignStatus,
} from '@/lib/sovereignThreatCapture';

export function SovereignThreatBanner() {
  const [status, setStatus] = useState<SovereignStatus | null>(null);

  useEffect(() => {
    invoke<SovereignStatus>('get-sovereign-threat-status')
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status?.liveFrozen && !(status?.openThreatCount && status.openThreatCount > 0)) {
    return null;
  }

  return (
    <div className="sovereign-banner-card card" role="alert">
      <p className="sovereign-banner-text">{SOVEREIGN_BANNER}</p>
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {status.liveFrozen
          ? 'Live paths frozen — production changes require kinetic 2FA through the registered administrator channel.'
          : `${status.openThreatCount} contained threat(s) under review.`}
        {' '}
        Authorized release: {SOVEREIGN_ADMIN}.
      </p>
      <Link href="/settings?tab=guardian-api" className="btn btn-sm" style={{ marginTop: '0.5rem' }}>
        Open Sovereign panel
      </Link>
    </div>
  );
}