'use client';

import { useCallback, useEffect, useState } from 'react';
import { bumpFriction, dispatchUiMutate, pushTrace, completeTrace } from '@/lib/theeMichaelOverlord';
import { usePathname } from 'next/navigation';

type FieldHint = {
  id: string;
  label: string;
  selector: string;
  top: number;
  left: number;
};

export function OverlordFieldGuard() {
  const pathname = usePathname();
  const [hint, setHint] = useState<FieldHint | null>(null);

  const attachHint = useCallback((el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
    const rect = el.getBoundingClientRect();
    const label = el.getAttribute('aria-label')
      || el.getAttribute('placeholder')
      || el.getAttribute('name')
      || 'this field';
    const selector = el.id ? `#${CSS.escape(el.id)}` : undefined;
    if (!selector) return;
    setHint({
      id: `fh_${Date.now()}`,
      label,
      selector,
      top: rect.top + window.scrollY - 8,
      left: rect.right + window.scrollX - 120,
    });
    bumpFriction(pathname);
  }, [pathname]);

  useEffect(() => {
    const onInvalid = (ev: Event) => {
      const t = ev.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) {
        attachHint(t);
      }
    };
    document.addEventListener('invalid', onInvalid, true);
    return () => document.removeEventListener('invalid', onInvalid, true);
  }, [attachHint]);

  const fixField = useCallback(() => {
    if (!hint) return;
    const t = pushTrace(`Evaluating field: ${hint.label}`);
    dispatchUiMutate({
      selector: hint.selector,
      highlightMs: 4000,
      scrollIntoView: true,
    });
    completeTrace(t);
    setHint(null);
  }, [hint]);

  if (!hint) return null;

  return (
    <button
      type="button"
      className="overlord-field-token"
      style={{ top: hint.top, left: Math.max(8, hint.left) }}
      onClick={fixField}
      title={`THEE_MICHAEL: fix ${hint.label}`}
    >
      🛡️ Fix
    </button>
  );
}