'use client';

import type { ReactNode } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageFocusRail } from '@/components/PageFocusRail';
import type { FocusAction } from '@/lib/pageFocus';

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
  useFocusSubtitle?: boolean;
  focusStats?: Record<string, string | number>;
  onFocusAction?: (action: FocusAction) => void;
  onFocusTab?: (tab: string) => void;
  children?: ReactNode;
};

/** PageHeader + outcome-driven focus rail — use on every authenticated module page */
export function PageShell({
  title,
  subtitle,
  eyebrow,
  actions,
  useFocusSubtitle = true,
  focusStats,
  onFocusAction,
  onFocusTab,
  children,
}: Props) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        eyebrow={eyebrow}
        actions={actions}
        useFocusSubtitle={useFocusSubtitle}
      />
      <PageFocusRail stats={focusStats} onAction={onFocusAction} onTabAction={onFocusTab} />
      {children}
    </>
  );
}