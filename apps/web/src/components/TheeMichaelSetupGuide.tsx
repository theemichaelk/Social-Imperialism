'use client';

import Link from 'next/link';
import { TheeMichaelAvatar } from '@/components/TheeMichaelAvatar';
import { THEE_MICHAEL_PROFILE } from '@/lib/theeMichaelProfile';
import {
  groupModuleFlowBySection,
  type BrandResearchResult,
  type ModuleFlowItem,
} from '@/lib/onboardingIntelligence';

type Props = {
  step: number;
  loading?: boolean;
  research?: BrandResearchResult | null;
  onResearch?: () => void;
  domain?: string;
  canResearch?: boolean;
};

export function TheeMichaelSetupGuide({
  step,
  loading,
  research,
  onResearch,
  domain,
  canResearch,
}: Props) {
  const flow = research?.moduleFlow || [];
  const grouped = groupModuleFlowBySection(flow);
  const readyCount = flow.filter((m) => ['ready', 'live', 'wired', 'active'].includes(m.status)).length;
  const wiredModules = research?.propagation?.results?.filter((r) => r.ok).map((r) => r.module) || [];

  return (
    <div className="thee-michael-setup-guide">
      <div className="thee-michael-setup-guide-header">
        <TheeMichaelAvatar size="md" showRing />
        <div>
          <p className="thee-michael-setup-eyebrow">{THEE_MICHAEL_PROFILE.displayName} · Intelligent Setup</p>
          <p className="thee-michael-setup-title">
            Step {step} — I research your brand online, fill every field, and wire data to all {flow.length || 24} modules + Campaign Command.
            {readyCount > 0 && ` (${readyCount} ready)`}
          </p>
        </div>
        {canResearch && onResearch && (
          <button
            type="button"
            className="btn primary thee-michael-research-btn"
            onClick={onResearch}
            disabled={loading || !domain?.trim()}
          >
            {loading ? 'Researching…' : '✨ Research My Brand'}
          </button>
        )}
      </div>

      {research?.steps && research.steps.length > 0 && (
        <div className="thee-michael-setup-steps">
          {research.steps.map((s) => (
            <span key={s.step} className={`thee-michael-setup-step-pill ${s.ok ? 'ok' : 'warn'}`}>
              {s.ok ? '✓' : '·'} {s.step.replace(/-/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {wiredModules.length > 0 && (
        <p className="thee-michael-wired-summary">
          Persisted to: {wiredModules.join(' · ')}
        </p>
      )}

      {grouped.length > 0 && (
        <div className="thee-michael-module-flow">
          <p className="thee-michael-module-flow-label">Data flowing to modules by relevancy</p>
          {grouped.map(({ section, items }) => (
            <div key={section} className="thee-michael-module-section">
              <p className="thee-michael-module-section-label">{section}</p>
              <div className="thee-michael-module-flow-grid">
                {items.map((m: ModuleFlowItem) => (
                  <Link key={m.module} href={m.href} className={`thee-michael-module-chip status-${m.status}`} title={m.hint}>
                    <span className="thee-michael-module-name">{m.module}</span>
                    <span className="thee-michael-module-data">{m.data}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {research?.recommendations && research.recommendations.length > 0 && (
        <ul className="thee-michael-setup-recs">
          {research.recommendations.slice(0, 5).map((r, i) => (
            <li key={i}>
              <Link href={r.href}>{r.action}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}