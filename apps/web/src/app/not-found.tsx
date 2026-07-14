'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { LiveSupportPanel } from '@/components/LiveSupportPanel';
import { resolveNavigationIntent } from '@/lib/liveSupportActions';
import { getAllModuleFeatures } from '@/lib/siteBlueprint';
import { NAV_SECTIONS } from '@/lib/nav';

const QUICK_DESTINATIONS = [
  { href: '/dashboard', label: 'Mission Control', icon: '🏠' },
  { href: '/browse-posts', label: 'Browse Posts', icon: '🧭' },
  { href: '/onboarding', label: 'Setup Wizard', icon: '🚀' },
  { href: '/integrations', label: 'Integrations', icon: '🔌' },
  { href: '/rules', label: 'Auto-Rules', icon: '⚙️' },
  { href: '/support', label: 'Imperialism Brain', icon: '💬' },
];

export default function NotFound() {
  const [search, setSearch] = useState('');
  const modules = getAllModuleFeatures();

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return modules
      .filter(
        (m) =>
          m.label.toLowerCase().includes(q)
          || m.section.toLowerCase().includes(q)
          || m.href.toLowerCase().includes(q.replace(/\s+/g, '-')),
      )
      .slice(0, 8);
  }, [search, modules]);

  const navHint = useMemo(
    () => (search.trim() ? resolveNavigationIntent(search, { preferExecute: false }) : null),
    [search],
  );

  return (
    <div className="page not-found-page">
      <section className="not-found-hero card">
        <p className="not-found-eyebrow">404 · Page not found</p>
        <h1 className="not-found-title">Let&apos;s get you where you need to go</h1>
        <p className="not-found-lead">
          That URL isn&apos;t in Social Imperialism — search a module below or ask{' '}
          <strong>THEE_MICHAEL</strong> what you&apos;re trying to do.
        </p>

        <label className="ac-label" htmlFor="not-found-search">Find a module</label>
        <input
          id="not-found-search"
          className="input not-found-search"
          type="search"
          placeholder="e.g. calendar, keywords, video studio, Be-First…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {navHint && (
          <Link href={navHint.href} className="not-found-route-pill">
            {navHint.label} →
          </Link>
        )}

        {results.length > 0 && (
          <ul className="not-found-results">
            {results.map((m) => (
              <li key={m.id}>
                <Link href={m.href}>
                  <span>{m.icon}</span>
                  <span>
                    <strong>{m.label}</strong>
                    <small>{m.section}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="not-found-quick">
          <p className="not-found-quick-label">Popular destinations</p>
          <div className="not-found-quick-grid">
            {QUICK_DESTINATIONS.map((d) => (
              <Link key={d.href} href={d.href} className="not-found-quick-card">
                <span>{d.icon}</span>
                {d.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="not-found-sections">
          {NAV_SECTIONS.map((section) => (
            <div key={section.id} className="not-found-section-block">
              <h3>{section.label}</h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href}>{item.icon} {item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="not-found-assistant card">
        <div className="not-found-assistant-head">
          <p className="not-found-assistant-eyebrow">THEE_MICHAEL · Imperialism Brain</p>
          <h2>What can I help you find?</h2>
          <p className="not-found-assistant-sub">
            Describe your goal — connect a platform, fix scheduling, discover keywords, Be-First monitors — and I&apos;ll route you to the right module.
          </p>
        </div>
        <LiveSupportPanel embedded initContext="404" />
      </section>
    </div>
  );
}