'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { groupVisibleTabs, loadTabLayout, saveTabLayout } from '@/lib/manageableTabs';
import { useManageableTabs } from '@/hooks/useManageableTabs';
import type { TabCatalogItem } from '@/lib/manageableTabs';
import {
  SI_GUIDE_EXPAND_GROUPS,
  SI_GUIDE_RESTORE_TABS,
  SI_GUIDE_SELECT_TAB,
  applyGuideTabRestore,
} from '@/lib/guide_executor';

type Props = {
  pageId: string;
  catalog: TabCatalogItem[];
  active: string;
  onChange: (id: string) => void;
  grouped?: boolean;
  className?: string;
  focusTabIds?: string[];
  collapseGroups?: string[];
};

export function ManageableTabNav({
  pageId,
  catalog,
  active,
  onChange,
  grouped = false,
  className = '',
  focusTabIds,
  collapseGroups,
}: Props) {
  const focus = focusTabIds?.length ? { focusTabIds, collapseGroups } : undefined;
  const {
    visibleTabs,
    hiddenTabs,
    layout,
    closeTab,
    deleteTab,
    restoreTab,
    addCustomTab,
    reorderTab,
    toggleGroupCollapse,
    toggleNavCollapse,
    resetLayout,
    resolveActive,
    handleTabSelect,
    catalog: fullCatalog,
  } = useManageableTabs(pageId, catalog, undefined, focus);

  const [addOpen, setAddOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    resolveActive(active, onChange);
  }, [active, onChange, resolveActive, visibleTabs]);

  useEffect(() => {
    const onSelect = (ev: Event) => {
      const { pageId: evtPageId, tabId } = (ev as CustomEvent<{ pageId: string; tabId: string }>).detail || {};
      if (evtPageId !== pageId || !tabId) return;
      onChange(tabId);
    };
    const onRestore = (ev: Event) => {
      const { pageId: evtPageId, tabIds } = (ev as CustomEvent<{ pageId: string; tabIds?: string[] }>).detail || {};
      if (evtPageId !== pageId) return;
      const next = applyGuideTabRestore(pageId, catalog, tabIds);
      saveTabLayout(pageId, next);
      const target = tabIds?.[0] || catalog.find((t) => !next.hidden.includes(t.id))?.id;
      if (target) onChange(target);
      window.location.reload();
    };
    const onExpand = (ev: Event) => {
      const { pageId: evtPageId, expandAll } = (ev as CustomEvent<{ pageId?: string; expandAll?: boolean }>).detail || {};
      if (!expandAll && evtPageId !== pageId) return;
      const layout = loadTabLayout(pageId, catalog, focus);
      saveTabLayout(pageId, { ...layout, collapsedGroups: [], navCollapsed: false });
      window.location.reload();
    };
    window.addEventListener(SI_GUIDE_SELECT_TAB, onSelect);
    window.addEventListener(SI_GUIDE_RESTORE_TABS, onRestore);
    window.addEventListener(SI_GUIDE_EXPAND_GROUPS, onExpand);
    return () => {
      window.removeEventListener(SI_GUIDE_SELECT_TAB, onSelect);
      window.removeEventListener(SI_GUIDE_RESTORE_TABS, onRestore);
      window.removeEventListener(SI_GUIDE_EXPAND_GROUPS, onExpand);
    };
  }, [pageId, catalog, focus, onChange]);

  useEffect(() => {
    if (!addOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [addOpen]);

  const onSelect = useCallback((tab: typeof visibleTabs[number]) => {
    handleTabSelect(tab, onChange);
  }, [handleTabSelect, onChange]);

  const promptCustomTab = () => {
    const label = window.prompt('Tab name (shortcut label):');
    if (!label?.trim()) return;
    const target = window.prompt(
      `Link to existing tab id (optional).\nAvailable: ${fullCatalog.map((t) => t.id).join(', ')}`,
    );
    const id = addCustomTab(label, {
      targetTabId: target?.trim() || undefined,
      group: 'Shortcuts',
    });
    if (id) onChange(target?.trim() || id);
    setAddOpen(false);
  };

  const renderTab = (tab: typeof visibleTabs[number], group?: string) => {
    const locked = !tab.custom && fullCatalog.find((t) => t.id === tab.id)?.locked;
    return (
      <div
        key={tab.id}
        className={`mtab-chip ${active === tab.id || (tab.custom && tab.targetTabId === active) ? 'active' : ''} ${dragId === tab.id ? 'dragging' : ''}`}
        draggable
        onDragStart={() => setDragId(tab.id)}
        onDragEnd={() => setDragId(null)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          if (dragId) reorderTab(dragId, tab.id, group);
          setDragId(null);
        }}
      >
        <button
          type="button"
          className="mtab-chip-label"
          data-guide-tab={tab.id}
          onClick={() => onSelect(tab)}
          title={tab.custom ? 'Shortcut tab' : tab.label}
        >
          {tab.custom && <span className="mtab-shortcut">★</span>}
          {tab.label}
        </button>
        {!locked && (
          <button
            type="button"
            className="mtab-chip-close"
            title={tab.custom ? 'Delete shortcut' : 'Close tab'}
            onClick={(e) => {
              e.stopPropagation();
              if (tab.custom) deleteTab(tab.id);
              else closeTab(tab.id);
              if (active === tab.id) {
                const next = visibleTabs.find((t) => t.id !== tab.id);
                if (next) onChange(next.targetTabId || next.id);
              }
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  const groupedTabs = grouped ? groupVisibleTabs(visibleTabs) : [{ group: 'General', tabs: visibleTabs }];

  return (
    <div className={`mtab-nav ${grouped ? 'mtab-nav-grouped' : ''} ${className}`.trim()}>
      <div className="mtab-toolbar">
        {focusTabIds && focusTabIds.length > 0 && (
          <span className="mtab-focus-badge" title="Showing focus tabs first — use + Add tab to reveal more">
            Focus mode
          </span>
        )}
        <button type="button" className="mtab-tool" onClick={toggleNavCollapse} title={layout.navCollapsed ? 'Expand tabs' : 'Collapse tabs'}>
          {layout.navCollapsed ? '▸ Tabs' : '▾ Tabs'}
        </button>
        <div className="mtab-add-wrap" ref={addRef}>
          <button type="button" className="mtab-tool primary" onClick={() => setAddOpen((o) => !o)}>+ Add tab</button>
          {addOpen && (
            <div className="mtab-add-menu">
              {hiddenTabs.length > 0 && (
                <>
                  <p className="mtab-add-heading">Restore closed</p>
                  {hiddenTabs.map((t) => (
                    <button key={t.id} type="button" className="mtab-add-item" onClick={() => { restoreTab(t.id); onChange(t.id); setAddOpen(false); }}>
                      {t.label}
                    </button>
                  ))}
                </>
              )}
              <p className="mtab-add-heading">New shortcut</p>
              <button type="button" className="mtab-add-item" onClick={promptCustomTab}>Create named shortcut…</button>
              {hiddenTabs.length === 0 && (
                <p className="mtab-add-hint">All built-in tabs are visible. Add a shortcut or close tabs to restore later.</p>
              )}
            </div>
          )}
        </div>
        <button type="button" className="mtab-tool" onClick={resetLayout} title="Reset tab order and visibility">Reset layout</button>
      </div>

      {!layout.navCollapsed && (
        <div className={grouped ? 'ch-tab-nav' : 'tabs mtab-strip'}>
          {groupedTabs.map(({ group, tabs }) => (
            <div key={group} className={grouped ? 'ch-tab-group' : 'mtab-flat-group'}>
              {grouped && (
                <button type="button" className="ch-tab-group-label mtab-group-toggle" onClick={() => toggleGroupCollapse(group)}>
                  {layout.collapsedGroups.includes(group) ? '▸' : '▾'} {group}
                </button>
              )}
              {(!grouped || !layout.collapsedGroups.includes(group)) && (
                <div className={grouped ? 'ch-tab-group-items' : 'mtab-strip-items'}>
                  {tabs.map((t) => renderTab(t, group))}
                </div>
              )}
            </div>
          ))}
          {!visibleTabs.length && (
            <p className="mtab-empty">No tabs visible — use <strong>+ Add tab</strong> to restore.</p>
          )}
        </div>
      )}
    </div>
  );
}