import type { ReactNode } from 'react';
import { Logo } from './Logo';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: subtitle ? '0.25rem' : 0 }}>{title}</h1>
          {subtitle && <p className="page-sub" style={{ margin: 0 }}>{subtitle}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {actions}
          <Logo size="sm" showText={false} />
        </div>
      </div>
    </div>
  );
}