'use client';

import { LiveSupportPanel } from '@/components/LiveSupportPanel';
import { PageShell } from '@/components/PageShell';
import { NAV_SECTIONS } from '@/lib/nav';
import { executeLiveSupportAction, resolveNavigationIntent } from '@/lib/liveSupportActions';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const HELP_TOPICS = [
  { title: 'Connect platforms', desc: 'OAuth, API keys, expired tokens', href: '/integrations', icon: '🔌' },
  { title: 'Schedule posts', desc: 'Calendar, time zones, publishing permissions', href: '/calendar', icon: '📅' },
  { title: 'AI replies', desc: 'Draft, approve, regenerate, brand voice', href: '/history', icon: '💬' },
  { title: 'Discovery', desc: 'Keywords, browse posts, engagement queue', href: '/browse-posts', icon: '🧭' },
  { title: 'Setup Wizard', desc: 'Brand, tone, keywords, go-live checklist', href: '/onboarding', icon: '🚀' },
  { title: 'Desktop app', desc: 'Download Windows installer & install steps', href: '/download', icon: '💻' },
  { title: 'Admin approvals', desc: 'Sensitive changes require platform admin sign-off', href: '/settings?tab=guardian-api', icon: '🛡️' },
];

export default function SupportPage() {
  const [search, setSearch] = useState('');
  const navAction = useMemo(() => resolveNavigationIntent(search, { preferExecute: true }), [search]);

  const moduleResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return NAV_SECTIONS.flatMap((s) => s.items)
      .filter((i) => i.label.toLowerCase().includes(q) || q.includes('thee_michael') || q.includes('admin'))
      .slice(0, 6);
  }, [search]);

  return (
    <div className="page support-page">
      <PageShell
        title="Imperialism Brain"
        subtitle="Setup, troubleshooting, SEO intelligence, and growth guidance"
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
            {navAction && (
              <button
                type="button"
                className="support-route-pill"
                onClick={() => executeLiveSupportAction(navAction)}
              >
                {navAction.label} → take me there
              </button>
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