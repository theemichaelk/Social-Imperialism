'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  SI_OVERLORD_INTERVENTION,
  type OverlordIntervention,
} from '@/lib/theeMichaelOverlord';
import { executeLiveSupportAction } from '@/lib/liveSupportActions';

export function OverlordInterventionBanner() {
  const [current, setCurrent] = useState<OverlordIntervention | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onIntervention = (ev: Event) => {
      const detail = (ev as CustomEvent<OverlordIntervention>).detail;
      if (!detail?.id || dismissed.has(detail.id)) return;
      setCurrent((prev) => (!prev || detail.priority >= prev.priority ? detail : prev));
    };
    window.addEventListener(SI_OVERLORD_INTERVENTION, onIntervention);
    return () => window.removeEventListener(SI_OVERLORD_INTERVENTION, onIntervention);
  }, [dismissed]);

  const dismiss = useCallback(() => {
    if (!current) return;
    setDismissed((d) => new Set(d).add(current.id));
    setCurrent(null);
  }, [current]);

  const act = useCallback(() => {
    if (!current) return;
    if (current.action) executeLiveSupportAction(current.action);
    else if (current.href) {
      executeLiveSupportAction({
        type: 'navigate',
        label: current.actionLabel || 'Open',
        href: current.href,
        autoExecute: true,
      });
    }
    dismiss();
  }, [current, dismiss]);

  if (!current) return null;

  return (
    <div className="overlord-intervention" role="dialog" aria-label="THEE_MICHAEL proactive guidance">
      <div className="overlord-intervention-inner">
        <p className="overlord-intervention-kind">{current.kind.replace('_', ' ')}</p>
        <strong className="overlord-intervention-title">{current.title}</strong>
        <p className="overlord-intervention-body">{current.body}</p>
        <div className="overlord-intervention-actions">
          {current.actionLabel && (
            <button type="button" className="btn primary" onClick={act}>{current.actionLabel}</button>
          )}
          <button type="button" className="btn" onClick={dismiss}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}