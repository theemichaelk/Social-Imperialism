'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { NAV_SECTIONS } from '@/lib/nav';
import { getPageFocus } from '@/lib/pageFocus';
import { LivePulse } from './DashboardViz';

function navEyebrow(pathname: string): string {
  for (const section of NAV_SECTIONS) {
    if (section.items.some((item) => item.href === pathname)) return section.label;
  }
  return 'Dashboard';
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  useFocusSubtitle = true,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: string;
  /** When true and no subtitle passed, use pageFocus subtitle */
  useFocusSubtitle?: boolean;
}) {
  const pathname = usePathname();
  const focus = getPageFocus(pathname);
  const sectionLabel = eyebrow || navEyebrow(pathname);
  const resolvedSubtitle = subtitle ?? (useFocusSubtitle ? focus?.subtitle : undefined);

  return (
    <header className="page-header dash-page-header">
      <div className="dash-page-header-inner">
        <span className="fi-corner tl" aria-hidden />
        <span className="fi-corner tr" aria-hidden />
        <span className="fi-corner bl" aria-hidden />
        <span className="fi-corner br" aria-hidden />
        <div className="dash-page-header-scan" aria-hidden />
        <div className="dash-page-header-content">
          <span className="home-section-eyebrow">{sectionLabel}</span>
          <div className="dash-page-header-row">
            <div>
              <h1 className="page-title dash-gradient-title">{title}</h1>
              {resolvedSubtitle && <p className="page-sub">{resolvedSubtitle}</p>}
            </div>
            <div className="dash-page-header-actions">
              {actions}
              <LivePulse label="ONLINE" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}