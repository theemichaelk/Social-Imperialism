'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findActiveNavSectionId, isNavItemActive, NAV_SECTIONS } from '@/lib/nav';
import { executeLiveSupportAction, resolveNavigationIntent } from '@/lib/liveSupportActions';
import { SI_GUIDE_EXPAND_SIDEBAR } from '@/lib/guide_executor';
import { Logo } from '@/components/Logo';
import { invoke, logout } from '@/lib/api';
import { checkPlatformAdmin } from '@/lib/adminAccess';

const COLLAPSE_KEY = 'siWebNavCollapsed';
const SECTION_COLLAPSE_KEY = 'siWebSectionCollapsed';

/** Browser autofill often drops login emails into the nav filter — never treat as a module search. */
function isNavFilterNoise(q: string): boolean {
  const t = q.trim();
  if (!t) return false;
  if (t.includes('@')) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return true;
  return false;
}

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab');
  const navActiveCtx = useMemo(
    () => ({ pathname, tab: activeTab }),
    [pathname, activeTab],
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [searchReady, setSearchReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>({});
  const [health, setHealth] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
      const raw = localStorage.getItem(SECTION_COLLAPSE_KEY);
      if (raw) setSectionCollapsed(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    checkPlatformAdmin().then(setIsAdmin).catch(() => setIsAdmin(false));
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

  const persistSections = useCallback((next: Record<string, boolean>) => {
    try { localStorage.setItem(SECTION_COLLAPSE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const toggleSection = useCallback((id: string) => {
    setSectionCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      persistSections(next);
      return next;
    });
  }, [persistSections]);

  const searchNav = useMemo(() => resolveNavigationIntent(search, { pathname, preferExecute: true }), [search, pathname]);

  const activeSection = useMemo(
    () => findActiveNavSectionId(navActiveCtx),
    [navActiveCtx],
  );

  const collapseAllSections = useCallback(() => {
    const next = Object.fromEntries(NAV_SECTIONS.map((s) => [s.id, true]));
    if (activeSection) next[activeSection] = false;
    setSectionCollapsed(next);
    persistSections(next);
  }, [activeSection, persistSections]);

  const expandAllSections = useCallback(() => {
    setSectionCollapsed({});
    persistSections({});
  }, [persistSections]);

  const visibleSections = useMemo(() => {
    if (isAdmin) return NAV_SECTIONS;
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.adminOnly),
    })).filter((s) => s.items.length > 0);
  }, [isAdmin]);

  useEffect(() => {
    const el = searchRef.current;
    if (!el) return;
    const autofilled = el.value.trim();
    if (autofilled && isNavFilterNoise(autofilled)) {
      el.value = '';
      setSearch('');
    }
  }, []);

  useEffect(() => {
    if (isNavFilterNoise(search)) setSearch('');
  }, [search]);

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || isNavFilterNoise(q)) return visibleSections;
    const extraMatch = (label: string) =>
      (q.includes('thee') && label.toLowerCase().includes('support'))
      || (q.includes('admin') && label.toLowerCase().includes('support'))
      || (q.includes('help') && label.toLowerCase().includes('support'));
    return visibleSections.map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.label.toLowerCase().includes(q)
        || section.label.toLowerCase().includes(q)
        || extraMatch(item.label),
      ),
    })).filter((s) => s.items.length > 0);
  }, [search, visibleSections]);

  useEffect(() => {
    const stripLegacyGuide = () => {
      document.querySelectorAll('.nav-link-features, .nav-link-hint').forEach((el) => el.remove());
    };
    stripLegacyGuide();
    const t = window.setTimeout(stripLegacyGuide, 0);
    return () => window.clearTimeout(t);
  }, [pathname, filteredSections]);

  useEffect(() => {
    if (!activeSection) return;
    setSectionCollapsed((prev) => {
      if (!prev[activeSection]) return prev;
      const next = { ...prev, [activeSection]: false };
      persistSections(next);
      return next;
    });
  }, [pathname, activeSection, persistSections]);

  useEffect(() => {
    const onExpandSidebar = (ev: Event) => {
      const { sectionId, expandAll } = (ev as CustomEvent<{ sectionId?: string; expandAll?: boolean }>).detail || {};
      if (expandAll) {
        expandAllSections();
        return;
      }
      if (sectionId) {
        setSectionCollapsed((prev) => {
          const next = { ...prev, [sectionId]: false };
          persistSections(next);
          return next;
        });
      }
    };
    window.addEventListener(SI_GUIDE_EXPAND_SIDEBAR, onExpandSidebar);
    return () => window.removeEventListener(SI_GUIDE_EXPAND_SIDEBAR, onExpandSidebar);
  }, [expandAllSections, persistSections]);

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
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
          <div className="sidebar-search-row">
            <input
              ref={searchRef}
              type="text"
              name="si-module-filter"
              role="searchbox"
              aria-label="Filter sidebar modules"
              placeholder="Search modules, Imperialism Brain, admin…"
              value={search}
              readOnly={!searchReady}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              onFocus={() => setSearchReady(true)}
              onChange={(e) => {
                const next = e.target.value;
                if (isNavFilterNoise(next)) {
                  setSearch('');
                  return;
                }
                setSearch(next);
              }}
              className="sidebar-search-input"
            />
            {search && (
              <button
                type="button"
                className="sidebar-search-clear"
                onClick={() => {
                  setSearch('');
                  searchRef.current?.focus();
                }}
                title="Clear search"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          {searchNav && (
            <button
              type="button"
              className="sidebar-search-route"
              onClick={() => { executeLiveSupportAction(searchNav); onMobileClose?.(); }}
            >
              {searchNav.label} → take me there
            </button>
          )}
          <div className="sidebar-section-controls">
            <button type="button" className="sidebar-section-ctrl" onClick={expandAllSections} title="Expand all sections">
              Expand all
            </button>
            <button type="button" className="sidebar-section-ctrl" onClick={collapseAllSections} title="Collapse all sections">
              Collapse all
            </button>
          </div>
        </div>
      )}

      <div className="sidebar-nav-scroll">
        {filteredSections.map((section) => {
          const isSecCollapsed = sectionCollapsed[section.id] && section.id !== activeSection && !search;
          return (
            <div key={section.id} data-nav-section={section.id} className={`nav-section ${isSecCollapsed ? 'nav-section-collapsed' : ''}`}>
              {!collapsed && (
                <button
                  type="button"
                  className="nav-section-toggle"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={!isSecCollapsed}
                  title={isSecCollapsed ? `Expand ${section.label}` : `Collapse ${section.label}`}
                >
                  <span className="nav-section-label">{section.label}</span>
                  <span className={`nav-section-chevron ${isSecCollapsed ? 'is-collapsed' : ''}`} aria-hidden>▾</span>
                </button>
              )}
              <div className={`nav-section-items ${isSecCollapsed && !collapsed ? 'is-collapsed' : ''}`}>
                  {section.items.map((item) => {
                    const isActive = isNavItemActive(item, navActiveCtx);
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        data-nav-id={item.id}
                        className={`nav-link ${isActive ? 'active' : ''}`}
                        title={item.label}
                        onClick={() => onMobileClose?.()}
                      >
                        <span className="nav-link-icon">{item.icon}</span>
                        {!collapsed && <span className="nav-link-label">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
            </div>
          );
        })}
        {!collapsed && search && filteredSections.length === 0 && (
          <p className="sidebar-no-results">No modules match &ldquo;{search}&rdquo;</p>
        )}
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-sign-out-btn"
          onClick={() => logout()}
          title="Sign out"
        >
          {collapsed ? '⎋' : 'Sign Out'}
        </button>
        <span className={`sidebar-health ${health === 'Healthy' ? 'ok' : health === 'Offline' ? 'err' : 'warn'}`}>
          <span className="live-pulse-dot" /> {collapsed ? '' : health || 'Checking…'}
        </span>
      </div>
    </aside>
  );
}