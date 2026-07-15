'use client';

type DetailLine = { key: string; value: string };
type TargetPreview = {
  id: string;
  name: string;
  type?: string;
  platform?: string;
  source?: string;
  subreddit?: string | null;
  privacy?: string | null;
  linked?: boolean;
  automationEnabled?: boolean;
};

type AccountDetails = {
  id: string;
  platform: string;
  handle?: string;
  username?: string;
  type?: string;
  loginEmail?: string;
  status?: string;
  linkedAt?: string;
  displayName?: string;
  health?: { status: string; label: string };
  counts?: {
    automationTargets?: number;
    accountTargets?: number;
    groupTargets?: number;
    storedGroups?: number;
    childAccounts?: number;
    enabledTargets?: number;
  };
  detailLines?: DetailLine[];
  targetsPreview?: TargetPreview[];
  groupsPreview?: Array<{ id: string; name: string; type?: string; memberCount?: number | null }>;
  childrenPreview?: Array<{ id: string; platform: string; handle?: string; type?: string }>;
};

const HEALTH_CLASS: Record<string, string> = {
  ok: 'status-ok',
  warn: 'status-warn',
  relink: 'status-warn',
  partial: '',
  unknown: '',
};

export function AccountConnectionDetails({ account }: { account: AccountDetails }) {
  const lines = account.detailLines || [];
  const counts = account.counts || {};
  const health = account.health;

  return (
    <div className="account-details-panel">
      {health && (
        <p className={`account-health ${HEALTH_CLASS[health.status] || ''}`} style={{ fontSize: '0.85rem', marginBottom: 10 }}>
          <strong>Health:</strong> {health.label}
        </p>
      )}

      <div className="grid grid-4" style={{ marginBottom: 12, gap: 8 }}>
        <div className="card kpi" style={{ padding: '0.65rem' }}>
          <div className="kpi-val" style={{ fontSize: '1.1rem' }}>{counts.automationTargets ?? 0}</div>
          <div className="kpi-label">Targets</div>
        </div>
        <div className="card kpi" style={{ padding: '0.65rem' }}>
          <div className="kpi-val" style={{ fontSize: '1.1rem' }}>{counts.storedGroups ?? 0}</div>
          <div className="kpi-label">Groups</div>
        </div>
        <div className="card kpi" style={{ padding: '0.65rem' }}>
          <div className="kpi-val" style={{ fontSize: '1.1rem' }}>{counts.childAccounts ?? 0}</div>
          <div className="kpi-label">Sub-accounts</div>
        </div>
        <div className="card kpi" style={{ padding: '0.65rem' }}>
          <div className="kpi-val" style={{ fontSize: '1.1rem' }}>{counts.enabledTargets ?? 0}</div>
          <div className="kpi-label">Enabled</div>
        </div>
      </div>

      {lines.length > 0 && (
        <div className="account-detail-lines" style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: 12 }}>
          {(() => {
            // Dedupe keys client-side (e.g. multiple Login rows from older payloads)
            const seen = new Set<string>();
            return lines.filter((line) => {
              const k = String(line.key || '').toLowerCase();
              if (!k || seen.has(k)) return false;
              seen.add(k);
              return true;
            }).map((line) => (
              <div key={line.key} style={{ marginBottom: 4 }}>
                <strong style={{ color: '#cbd5e1' }}>{line.key}:</strong> {line.value}
              </div>
            ));
          })()}
        </div>
      )}

      {account.targetsPreview && account.targetsPreview.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '0.9rem' }}>Discovered targets</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {account.targetsPreview.map((t) => (
              <div key={`${t.source}-${t.id}`} className="post-card" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div style={{ color: '#64748b' }}>
                  {[t.platform, t.type, t.source, t.subreddit ? `r/${t.subreddit}` : null, t.privacy].filter(Boolean).join(' · ')}
                  {t.linked === false ? ' · not linked' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {account.groupsPreview && account.groupsPreview.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '0.9rem' }}>Groups / communities</h4>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            {account.groupsPreview.map((g) => (
              <div key={g.id}>{g.name} {g.memberCount != null ? `(${g.memberCount} members)` : ''}</div>
            ))}
          </div>
        </div>
      )}

      {account.childrenPreview && account.childrenPreview.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 6px', fontSize: '0.9rem' }}>Linked sub-accounts</h4>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            {account.childrenPreview.map((c) => (
              <div key={c.id}>{c.platform} · {c.handle || c.id} {c.type ? `(${c.type})` : ''}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}