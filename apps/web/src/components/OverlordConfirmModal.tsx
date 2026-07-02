'use client';

import { useCallback, useEffect, useState } from 'react';
import { SI_OVERLORD_CONFIRM, OVERLORD_IDENTITY, type ConfirmChallenge } from '@/lib/theeMichaelOverlord';

export function OverlordConfirmModal() {
  const [challenge, setChallenge] = useState<ConfirmChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => {
    const onConfirm = (ev: Event) => {
      const detail = (ev as CustomEvent<ConfirmChallenge>).detail;
      if (detail?.id) {
        setChallenge(detail);
        setCode('');
      }
    };
    window.addEventListener(SI_OVERLORD_CONFIRM, onConfirm);
    return () => window.removeEventListener(SI_OVERLORD_CONFIRM, onConfirm);
  }, []);

  const close = useCallback(() => {
    challenge?.onRollback?.();
    setChallenge(null);
    setCode('');
  }, [challenge]);

  const confirm = useCallback(async () => {
    if (!challenge || busy) return;
    setBusy(true);
    try {
      await challenge.onConfirm();
      setChallenge(null);
      setCode('');
    } finally {
      setBusy(false);
    }
  }, [challenge, busy]);

  if (!challenge) return null;

  const expected = challenge.id.slice(-6).toUpperCase();

  return (
    <div className="overlord-confirm-backdrop" role="presentation" onClick={close}>
      <div className="overlord-confirm-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <p className="overlord-confirm-eyebrow">{OVERLORD_IDENTITY} confirmation</p>
        <h3 className="overlord-confirm-title">Cryptographic risk gate</h3>
        <p className="overlord-confirm-summary">{challenge.summary}</p>
        <p className="overlord-confirm-hint">
          Type <code>{expected}</code> to authorize this {challenge.riskLevel}-risk change.
        </p>
        <input
          className="overlord-confirm-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Confirmation code"
          autoComplete="off"
        />
        <div className="overlord-confirm-actions">
          <button type="button" className="btn primary" disabled={busy || code !== expected} onClick={confirm}>
            {busy ? 'Committing…' : 'Authorize'}
          </button>
          <button type="button" className="btn" onClick={close}>Rollback</button>
        </div>
      </div>
    </div>
  );
}