'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getPageFocus, GLOBAL_FOCUS_PATH, type FocusAction, type PageFocusConfig } from '@/lib/pageFocus';

type Props = {
  pageId?: string;
  config?: Partial<PageFocusConfig>;
  onAction?: (action: FocusAction) => void;
  onTabAction?: (tab: string) => void;
  stats?: Record<string, string | number>;
  className?: string;
};

export function PageFocusRail({
  pageId,
  config: override,
  onAction,
  onTabAction,
  stats,
  className = '',
}: Props) {
  const pathname = usePathname();
  const base = getPageFocus(pageId || pathname);
  if (!base && !override) return null;

  const cfg: PageFocusConfig = {
    id: base?.id || 'page',
    title: base?.title || 'Page',
    outcome: override?.outcome || base?.outcome || '',
    subtitle: override?.subtitle || base?.subtitle || '',
    flow: override?.flow || base?.flow || [],
    focusTabIds: override?.focusTabIds || base?.focusTabIds,
    collapseGroups: override?.collapseGroups || base?.collapseGroups,
    actions: override?.actions || base?.actions || [],
    related: override?.related || base?.related || [],
  };

  const pathStep = GLOBAL_FOCUS_PATH.findIndex((p) => pathname === p.href || pathname.startsWith(p.href.split('?')[0]));
  const onPath = pathStep >= 0;

  const renderAction = (action: FocusAction) => {
    if (action.tab && onTabAction) {
      return (
        <button
          key={action.label}
          type="button"
          className={`pfr-action ${action.primary ? 'primary' : ''}`}
          onClick={() => onTabAction(action.tab!)}
        >
          {action.label}
        </button>
      );
    }
    if (action.href) {
      return (
        <Link key={action.label} href={action.href} className={`pfr-action ${action.primary ? 'primary' : ''}`}>
          {action.label}
        </Link>
      );
    }
    return (
      <button
        key={action.label}
        type="button"
        className={`pfr-action ${action.primary ? 'primary' : ''}`}
        onClick={() => onAction?.(action)}
      >
        {action.label}
      </button>
    );
  };

  return (
    <section className={`page-focus-rail ${className}`.trim()} aria-label="Page focus">
      <div className="pfr-main">
        <div className="pfr-outcome-block">
          <span className="pfr-eyebrow">Today&apos;s outcome</span>
          <p className="pfr-outcome">{cfg.outcome}</p>
          {cfg.flow.length > 0 && (
            <div className="pfr-flow" aria-label="Workflow steps">
              {cfg.flow.map((step, i) => (
                <span key={step} className="pfr-flow-step">
                  {i > 0 && <span className="pfr-flow-arrow">→</span>}
                  <span>{step}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="pfr-actions-col">
          <div className="pfr-actions">{cfg.actions.map(renderAction)}</div>
          {stats && Object.keys(stats).length > 0 && (
            <div className="pfr-stats">
              {Object.entries(stats).map(([k, v]) => (
                <span key={k} className="pfr-stat">
                  <strong>{v}</strong> {k}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pfr-bottom">
        <div className="pfr-global-path" aria-label="Growth path">
          <span className="pfr-path-label">Growth path</span>
          {GLOBAL_FOCUS_PATH.map((step, i) => {
            const active = pathname === step.href || pathname.startsWith(step.href.split('?')[0]);
            return (
              <Link
                key={step.href}
                href={step.href}
                className={`pfr-path-step ${active ? 'active' : ''} ${onPath && i === pathStep ? 'current' : ''}`}
              >
                {step.label}
              </Link>
            );
          })}
        </div>
        {cfg.related.length > 0 && (
          <div className="pfr-related">
            <span className="pfr-related-label">Next</span>
            {cfg.related.map((r) => (
              <Link key={r.href} href={r.href} className="pfr-related-link">
                {r.label} →
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}