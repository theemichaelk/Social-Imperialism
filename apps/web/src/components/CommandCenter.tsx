'use client';

import Link from 'next/link';
import { NAV_SECTIONS } from '@/lib/nav';

type CommandCenterProps = {
  stats?: Record<string, unknown>;
  apiMetrics?: Record<string, string>;
};

const MODULE_COPY: Record<string, { desc: string; tag?: string }> = {
  dashboard: { desc: 'Real-time KPIs, live feed, worker status, and mission analytics', tag: 'Live' },
  'browse-posts': { desc: 'Discover posts across platforms — draft, engage, and schedule', tag: 'Discovery' },
  onboarding: { desc: 'Brand setup, keywords, platform linking, and go-live checklist', tag: 'Setup' },
  'content-hub': { desc: 'Imperial studio, publish wizard, RSS, batch queue, and media', tag: 'Create' },
  'content-library': { desc: 'Central asset hub — images, video, copy, imports, and RSS', tag: 'Assets' },
  'design-studio': { desc: 'Template-based visual post designer with AI captions', tag: 'Design' },
  brand: { desc: 'Voice, rules, and samples injected into all AI copy', tag: 'Brand' },
  calendar: { desc: 'Content calendar — schedule, edit, publish, best times', tag: 'Schedule' },
  scheduler: { desc: 'Queue management, due-post processing, background windows', tag: 'Queue' },
  engagement: { desc: 'Engagement CRM — LinkedIn lists, AI comments, quick like', tag: 'CRM' },
  history: { desc: 'AI reply approval workflow, filters, charts, agency reports', tag: 'Replies' },
  keywords: { desc: 'AI keyword suggestions, per-platform targeting, Quantum Pages', tag: 'SEO' },
  'seo-tools': { desc: 'KGR, scrapers, autocomplete, indexing, Reddit/Quora discovery', tag: 'Research' },
  'reddit-ai': { desc: 'Six Reddit growth modules — configure, enable, run, approve', tag: 'Reddit' },
  'quora-traffic': { desc: 'Research → Generate → Publish with traffic data', tag: 'Quora' },
  automations: { desc: 'Visual drag-drop automation builder with triggers and actions', tag: 'Flows' },
  rules: { desc: 'Worker control, Be First monitors, crisis moderation', tag: 'Auto' },
  'account-hub': { desc: 'Connect 16 platforms — OAuth, credentials, sub-accounts', tag: 'OAuth' },
  'account-creator': { desc: 'Multi-platform profile kit generator, proxies, headless batch', tag: 'Profiles' },
  dns: { desc: 'Route53 site registry, record CRUD, propagation verify, apply', tag: 'DNS' },
  integrations: { desc: 'Connections, live probes, Partner API, webhooks, connectors', tag: 'API' },
  settings: { desc: 'Campaigns, billing, Grok, tutorials, system health, rankings', tag: 'System' },
};

export function CommandCenter({ stats = {}, apiMetrics = {} }: CommandCenterProps) {
  const connected = Object.values(apiMetrics).filter((v) => v === 'Connected').length;
  const totalApis = Object.keys(apiMetrics).length;

  return (
    <div className="command-center">
      <div className="command-center-header">
        <div>
          <p className="command-eyebrow">Neural Command Matrix</p>
          <h2 className="command-title">Full Platform Capability Grid</h2>
          <p className="command-sub">
            {NAV_SECTIONS.reduce((n, s) => n + s.items.length, 0)} modules ·
            {' '}{String(stats.linkedAccounts ?? 0)} accounts ·
            {' '}{String(stats.activeKeywords ?? 0)} keywords ·
            {' '}{connected}/{totalApis || '—'} APIs live
          </p>
        </div>
        <div className="command-status-strip">
          <span className={`command-status-chip ${stats.autoRulesEnabled ? 'on' : ''}`}>
            Auto-Rules {stats.autoRulesEnabled ? 'ON' : 'OFF'}
          </span>
          <span className={`command-status-chip ${(stats.linkedAccounts as number) > 0 ? 'on' : ''}`}>
            Accounts {(stats.linkedAccounts as number) > 0 ? 'Linked' : 'Pending'}
          </span>
          <span className="command-status-chip on">SaaS Parity</span>
        </div>
      </div>

      {NAV_SECTIONS.map((section) => (
        <div key={section.id} className="command-section">
          <div className="command-section-head">
            <span className="command-section-label">{section.label}</span>
            <span className="command-section-count">{section.items.length} modules</span>
          </div>
          <div className="command-grid">
            {section.items.map((item) => {
              const copy = MODULE_COPY[item.id] || { desc: item.label };
              const metric = apiMetrics[item.label] || apiMetrics[copy.tag || ''];
              const status = metric === 'Connected' ? 'ok' : metric ? 'warn' : undefined;
              return (
                <Link key={item.id} href={item.href} className="command-card neo-card">
                  <div className="command-card-glow" aria-hidden />
                  <div className="command-card-top">
                    <span className="command-card-icon">{item.icon}</span>
                    {copy.tag && <span className="command-card-tag">{copy.tag}</span>}
                    {status && <span className={`command-card-status ${status}`} />}
                  </div>
                  <h3 className="command-card-title">{item.label}</h3>
                  <p className="command-card-desc">{copy.desc}</p>
                  <span className="command-card-cta">Launch →</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

}