'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { NAV_SECTIONS } from '@/lib/nav';
import { Logo } from '@/components/Logo';
import { invoke } from '@/lib/api';

const COLLAPSE_KEY = 'siWebNavCollapsed';
const SECTION_COLLAPSE_KEY = 'siWebSectionCollapsed';

export function Sidebar() {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>({});
  const [health, setHealth] = useState('');

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
      const raw = localStorage.getItem(SECTION_COLLAPSE_KEY);
      if (raw) setSectionCollapsed(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    invoke<{ summary?: { ok?: number; warn?: number; broken?: number }; ok?: boolean }>('get-page-health')
      .then((h) => {
        const s = h?.summary;
        if (s) {
          setHealth(s.broken ? 'Degraded' : s.warn ? `${s.ok}/${s.ok + s.warn} OK` : 'Healthy');
        } else {
          setHealth(h?.ok !== false ? 'Healthy' : 'Degraded');
        }
      })
      .catch(() => setHealth('Offline'));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggleSection = useCallback((id: string) => {
    setSectionCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(SECTION_COLLAPSE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return NAV_SECTIONS;
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.label.toLowerCase().includes(q) || section.label.toLowerCase().includes(q),
      ),
    })).filter((s) => s.items.length > 0);
  }, [search]);

  const activeSection = NAV_SECTIONS.find((s) => s.items.some((i) => i.href === pathname))?.id;

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-brand">
        <Link href="/" style={{ textDecoration: 'none' }} title="Home">
          <Logo size="sm" showText={!collapsed} />
        </Link>
        <button type="button" className="sidebar-collapse-btn" onClick={toggleCollapsed} title="Toggle sidebar">
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {!collapsed && (
        <div className="sidebar-search">
          <input
            type="search"
            placeholder="Search modules…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sidebar-search-input"
          />
        </div>
      )}

      <div className="sidebar-nav-scroll">
        {filteredSections.map((section) => {
          const isSecCollapsed = sectionCollapsed[section.id] && section.id !== activeSection && !search;
          return (
            <div key={section.id} className={`nav-section ${isSecCollapsed ? 'nav-section-collapsed' : ''}`}>
              {!collapsed && (
                <button
                  type="button"
                  className="nav-section-toggle"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={!isSecCollapsed}
                >
                  <span className="nav-section-label">{section.label}</span>
                  <span className="nav-section-chevron">{isSecCollapsed ? '▸' : '▾'}</span>
                </button>
              )}
              {(!isSecCollapsed || collapsed) && (
                <div className="nav-section-items">
                  {section.items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`nav-link ${pathname === item.href ? 'active' : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="nav-link-icon">{item.icon}</span>
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!collapsed && search && filteredSections.length === 0 && (
          <p className="sidebar-no-results">No modules match &ldquo;{search}&rdquo;</p>
        )}
      </div>

      <div className="sidebar-footer">
        <span className={`sidebar-health ${health === 'Healthy' ? 'ok' : health === 'Offline' ? 'err' : 'warn'}`}>
          <span className="live-pulse-dot" /> {collapsed ? '' : health || 'Checking…'}
        </span>
      </div>
    </aside>
  );
}