'use client';

import { useEffect, useState } from 'react';
import {
  SI_OVERLORD_TRACE,
  loadTraceSteps,
  type CognitiveTraceStep,
} from '@/lib/theeMichaelOverlord';

export function OverlordCognitiveTrace({ compact = false }: { compact?: boolean }) {
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

  const visible = steps.filter((s) => s.status === 'active' || s.status === 'error').slice(-6);
  const recent = steps.filter((s) => s.status === 'done').slice(-4);

  if (!steps.length) return null;

  const list = compact ? [...visible, ...recent].slice(-5) : steps.slice(-8);

  return (
    <div className={`overlord-trace ${compact ? 'overlord-trace-compact' : ''}`} aria-live="polite">
      <p className="overlord-trace-eyebrow">THEE_MICHAEL cognitive trace</p>
      <ul className="overlord-trace-list">
        {list.map((s) => (
          <li key={s.id} className={`overlord-trace-step is-${s.status}`}>
            <span className="overlord-trace-dot" aria-hidden />
            <span className="overlord-trace-label">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}