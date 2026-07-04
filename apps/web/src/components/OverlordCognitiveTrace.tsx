'use client';

import { useEffect, useState } from 'react';
import {
  COGNITIVE_TRACE_EYEBROW,
  SI_OVERLORD_TRACE,
  loadTraceSteps,
  type CognitiveTraceStep,
} from '@/lib/theeMichaelOverlord';

export function OverlordCognitiveTrace({
  compact = false,
  showEmptyHint = false,
}: {
  compact?: boolean;
  /** When true, show idle copy instead of hiding the panel (Live Support Trace toggle). */
  showEmptyHint?: boolean;
}) {
  const [steps, setSteps] = useState<CognitiveTraceStep[]>([]);

  useEffect(() => {
    setSteps(loadTraceSteps());
    const onTrace = (ev: Event) => {
      const detail = (ev as CustomEvent<{ steps: CognitiveTraceStep[] }>).detail;
      if (detail?.steps) setSteps(detail.steps);
    };
    window.addEventListener(SI_OVERLORD_TRACE, onTrace);
    return () => window.removeEventListener(SI_OVERLORD_TRACE, onTrace);
  }, []);

  const freshCutoff = Date.now() - 5 * 60 * 1000;
  const fresh = steps.filter((s) => {
    const ts = s.ts ? new Date(s.ts).getTime() : 0;
    return !ts || ts >= freshCutoff;
  });
  const active = fresh.filter((s) => s.status === 'active' || s.status === 'error');

  const list = compact ? active.slice(-5) : steps.slice(-8);
  const isIdle = compact ? !active.length : !steps.length;

  if (isIdle && !showEmptyHint) return null;

  return (
    <div className={`overlord-trace ${compact ? 'overlord-trace-compact' : ''}`} aria-live="polite">
      <p className="overlord-trace-eyebrow">{COGNITIVE_TRACE_EYEBROW}</p>
      {isIdle ? (
        <p className="overlord-trace-idle">Idle — steps appear here while Brain navigates, audits, or ingests files.</p>
      ) : (
        <ul className="overlord-trace-list">
          {list.map((s) => (
            <li key={s.id} className={`overlord-trace-step is-${s.status}`}>
              <span className="overlord-trace-dot" aria-hidden />
              <span className="overlord-trace-label">{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}