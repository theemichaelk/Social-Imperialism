'use client';

import { LiveSupportPanel } from '@/components/LiveSupportPanel';
import { PageHeader } from '@/components/PageHeader';
import { NAV_SECTIONS } from '@/lib/nav';
import { resolveSearchRoute } from '@/lib/liveSupportAgent';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const HELP_TOPICS = [
  { title: 'Connect platforms', desc: 'OAuth, API keys, expired tokens', href: '/integrations', icon: '🔌' },
  { title: 'Schedule posts', desc: 'Calendar, time zones, publishing permissions', href: '/calendar', icon: '📅' },
  { title: 'AI replies', desc: 'Draft, approve, regenerate, brand voice', href: '/history', icon: '💬' },
  { title: 'Discovery', desc: 'Keywords, browse posts, engagement queue', href: '/browse-posts', icon: '🧭' },
  { title: 'Setup Wizard', desc: 'Brand, tone, keywords, go-live checklist', href: '/onboarding', icon: '🚀' },
  { title: 'Ask THEE_MICHAEL', desc: 'Admin approval for sensitive changes', href: '/support', icon: '🛡️' },
];

export default function SupportPage() {
  const [search, setSearch] = useState('');
  const route = useMemo(() => resolveSearchRoute(search), [search]);

  const moduleResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return NAV_SECTIONS.flatMap((s) => s.items)
      .filter((i) => i.label.toLowerCase().includes(q) || q.includes('thee_michael') || q.includes('admin'))
      .slice(0, 6);
  }, [search]);

  return (
    <div className="page support-page">
      <PageHeader
        title="Live Support"
        subtitle="Growth agent for setup, troubleshooting, and campaign optimization"
      />

      <div className="support-layout">
        <div className="support-sidebar-col">
          <div className="card support-search-card">
            <label className="support-search-label" htmlFor="support-search">Search help</label>
            <input
              id="support-search"
              type="search"
              className="support-search-input"
              placeholder="THEE_MICHAEL approval, connect platform, fix reply…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {route && (
              <Link href={route.href} className="support-route-pill">
                {route.label} →
              </Link>
            )}
            {moduleResults.length > 0 && (
              <ul className="support-module-list">
                {moduleResults.map((m) => (
                  <li key={m.id}>
                    <Link href={m.href}>{m.icon} {m.label}</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="support-topics-grid">
            {HELP_TOPICS.map((t) => (
              <Link key={t.title} href={t.href} className="support-topic-card neo-card">
                <span className="support-topic-icon">{t.icon}</span>
                <h4>{t.title}</h4>
                <p>{t.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="support-chat-col">
          <LiveSupportPanel embedded />
        </div>
      </div>
    </div>
  );
}