'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  SI_OVERLORD_INTERVENTION,
  type OverlordIntervention,
} from '@/lib/theeMichaelOverlord';
import { executeLiveSupportAction } from '@/lib/liveSupportActions';
import {
  SI_NOTIFICATION_CHANGED,
  getNotificationHistory,
  interventionDismissKey,
  isNotificationSuppressed,
  recordInterventionResolution,
} from '@/lib/theeMichaelNotificationLedger';

function kindLabel(int: OverlordIntervention): string {
  if (int.kind === 'health') return 'Imperialism Brain';
  return int.kind.replace('_', ' ');
}

function statusLabel(status: string): string {
  if (status === 'acted') return 'Troubleshooting started';
  if (status === 'auto_resolved') return 'Resolved on visit';
  if (status === 'dismissed') return 'Dismissed';
  if (status === 'approved') return 'Approved';
  if (status === 'denied') return 'Denied';
  if (status === 'routed') return 'Routed for review';
  return status;
}

export function OverlordInterventionBanner() {
  const [current, setCurrent] = useState<OverlordIntervention | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(() => getNotificationHistory(12));

  const refreshHistory = useCallback(() => {
    setHistory(getNotificationHistory(12));
  }, []);

  useEffect(() => {
    const onIntervention = (ev: Event) => {
      const detail = (ev as CustomEvent<OverlordIntervention>).detail;
      if (!detail?.id) return;
      const dismissKey = interventionDismissKey(detail);
      if (isNotificationSuppressed(dismissKey)) return;
      setCurrent((prev) => (!prev || detail.priority >= prev.priority ? detail : prev));
    };
    const onChanged = () => {
      refreshHistory();
      if (current && isNotificationSuppressed(interventionDismissKey(current))) {
        setCurrent(null);
      }
    };
    window.addEventListener(SI_OVERLORD_INTERVENTION, onIntervention);
    window.addEventListener(SI_NOTIFICATION_CHANGED, onChanged);
    return () => {
      window.removeEventListener(SI_OVERLORD_INTERVENTION, onIntervention);
      window.removeEventListener(SI_NOTIFICATION_CHANGED, onChanged);
    };
  }, [current, refreshHistory]);

  const dismiss = useCallback(() => {
    if (!current) return;
    recordInterventionResolution(current, 'dismissed', 'Dismissed by user');
    setCurrent(null);
    refreshHistory();
  }, [current, refreshHistory]);

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
    recordInterventionResolution(current, 'acted', current.actionLabel || 'User started troubleshoot');
    window.dispatchEvent(new CustomEvent('si-brain-refresh-health'));
    setCurrent(null);
    refreshHistory();
  }, [current, refreshHistory]);

  const resume = useCallback((href: string, action?: OverlordIntervention['action']) => {
    if (action) executeLiveSupportAction(action);
    else {
      executeLiveSupportAction({
        type: 'navigate',
        label: 'Resume',
        href,
        autoExecute: true,
      });
    }
  }, []);

  const resumable = history.filter((e) => e.canResume && e.resumeHref);

  if (!current && history.length === 0) return null;

  return (
    <div className="overlord-notification-stack">
      {current && (
        <div className="overlord-intervention" role="dialog" aria-label="Imperialism Brain proactive guidance">
          <div className="overlord-intervention-inner">
            <p className="overlord-intervention-kind">{kindLabel(current)}</p>
            <strong className="overlord-intervention-title">{current.title}</strong>
            <p className="overlord-intervention-body">{current.body}</p>
            <div className="overlord-intervention-actions">
              {current.actionLabel && (
                <button type="button" className="btn primary" onClick={act}>{current.actionLabel}</button>
              )}
              <button type="button" className="btn" onClick={dismiss}>Dismiss</button>
              {history.length > 0 && (
                <button type="button" className="btn" onClick={() => setShowHistory((s) => !s)}>
                  {showHistory ? 'Hide history' : 'History'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!current && history.length > 0 && !showHistory && (
        <button
          type="button"
          className="thee-michael-notification-history-collapsed btn"
          onClick={() => setShowHistory(true)}
        >
          {resumable.length > 0
            ? `${resumable.length} action(s) ready to continue · View history`
            : `View ${history.length} notification(s) in history`}
        </button>
      )}

      {showHistory && history.length > 0 && (
        <div className="thee-michael-notification-history card">
          <div className="thee-michael-notification-history-head">
            <strong>THEE_MICHAEL notification history</strong>
            <button type="button" className="btn" onClick={() => setShowHistory(false)}>Hide</button>
          </div>
          <ul className="thee-michael-notification-history-list">
            {history.map((entry) => (
              <li key={entry.id} className={`thee-michael-notification-history-item is-${entry.status}`}>
                <div className="thee-michael-notification-history-meta">
                  <span className="thee-michael-notification-history-status">{statusLabel(entry.status)}</span>
                  <time dateTime={entry.resolvedAt}>
                    {new Date(entry.resolvedAt).toLocaleString()}
                  </time>
                </div>
                <p className="thee-michael-notification-history-title">{entry.title}</p>
                {entry.resolutionNote && (
                  <p className="thee-michael-notification-history-note">{entry.resolutionNote}</p>
                )}
                {entry.canResume && entry.resumeHref && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => resume(entry.resumeHref!, entry.resumeAction)}
                  >
                    Continue action →
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}