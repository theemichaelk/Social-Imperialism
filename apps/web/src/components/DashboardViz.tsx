'use client';

type BarItem = { label: string; value: number; color?: string };

export function LivePulse({ label = 'LIVE' }: { label?: string }) {
  return (
    <span className="live-pulse">
      <span className="live-pulse-dot" />
      {label}
    </span>
  );
}

export function MetricTile({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="metric-tile" style={accent ? { borderColor: accent } : undefined}>
      <div className="metric-tile-val" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="metric-tile-label">{label}</div>
      {sub && <div className="metric-tile-sub">{sub}</div>}
    </div>
  );
}

export function BarChart({ items, maxHeight = 120 }: { items: BarItem[]; maxHeight?: number }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="bar-chart" style={{ height: maxHeight }}>
      {items.map((item) => (
        <div key={item.label} className="bar-chart-col" title={`${item.label}: ${item.value}`}>
          <div
            className="bar-chart-bar"
            style={{
              height: `${Math.max(8, (item.value / max) * 100)}%`,
              background: item.color || 'linear-gradient(180deg, #38bdf8, #6366f1)',
            }}
          />
          <span className="bar-chart-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function RingChart({ percent, label, color = '#38bdf8' }: { percent: number; label: string; color?: string }) {
  const p = Math.min(100, Math.max(0, percent));
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;
  return (
    <div className="ring-chart">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="48" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="700">{Math.round(p)}%</text>
      </svg>
      <span className="ring-chart-label">{label}</span>
    </div>
  );
}

export function SparkRow({ items }: { items: { label: string; value: string | number; status?: 'ok' | 'warn' | 'off' }[] }) {
  return (
    <div className="spark-row">
      {items.map((item) => (
        <div key={item.label} className={`spark-chip spark-${item.status || 'ok'}`}>
          <span className="spark-chip-val">{item.value}</span>
          <span className="spark-chip-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function DataPanel({ title, live, children, action, className }: {
  title: string; live?: boolean; children: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={`card dash-panel${className ? ` ${className}` : ''}`}>
      <div className="dash-panel-head">
        <h3>{title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {live && <LivePulse />}
          {action}
        </div>
      </div>
      {children}
    </div>
  );
}

export function platformBreakdown(posts: Array<{ platform?: string }>): BarItem[] {
  const counts: Record<string, number> = {};
  posts.forEach((p) => {
    const k = p.platform || 'Other';
    counts[k] = (counts[k] || 0) + 1;
  });
  const colors = ['#38bdf8', '#a855f7', '#22c55e', '#f59e0b', '#f472b6', '#94a3b8'];
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value], i) => ({ label: label.slice(0, 8), value, color: colors[i % colors.length] }));
}