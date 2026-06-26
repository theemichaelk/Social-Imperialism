'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CustomTabItem,
  TabCatalogItem,
  TabLayoutStorage,
  defaultLayout,
  loadTabLayout,
  resolveVisibleTabs,
  saveTabLayout,
} from '@/lib/manageableTabs';

export function useManageableTabs(pageId: string, catalog: TabCatalogItem[], initialActive?: string) {
  const [layout, setLayout] = useState<TabLayoutStorage>(() => defaultLayout(catalog));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLayout(loadTabLayout(pageId, catalog));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  useEffect(() => {
    if (hydrated) saveTabLayout(pageId, layout);
  }, [pageId, layout, hydrated]);

  const visibleTabs = useMemo(() => resolveVisibleTabs(catalog, layout), [catalog, layout]);

  const persist = useCallback((patch: Partial<TabLayoutStorage> | ((prev: TabLayoutStorage) => TabLayoutStorage)) => {
    setLayout((prev) => (typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }));
  }, []);

  const closeTab = useCallback((id: string) => {
    const item = catalog.find((t) => t.id === id);
    if (item?.locked) return;
    persist((prev) => ({
      ...prev,
      hidden: prev.hidden.includes(id) ? prev.hidden : [...prev.hidden, id],
      order: prev.order.filter((x) => x !== id),
    }));
  }, [catalog, persist]);

  const deleteTab = useCallback((id: string) => {
    if (id.startsWith('custom_')) {
      persist((prev) => ({
        ...prev,
        customTabs: prev.customTabs.filter((t) => t.id !== id),
        order: prev.order.filter((x) => x !== id),
      }));
      return;
    }
    closeTab(id);
  }, [closeTab, persist]);

  const restoreTab = useCallback((id: string) => {
    persist((prev) => ({
      ...prev,
      hidden: prev.hidden.filter((x) => x !== id),
      order: prev.order.includes(id) ? prev.order : [...prev.order, id],
    }));
  }, [persist]);

  const addCustomTab = useCallback((label: string, opts?: { group?: string; targetTabId?: string; href?: string }) => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    const id = `custom_${Date.now()}`;
    const custom: CustomTabItem = {
      id,
      label: trimmed,
      group: opts?.group || 'Shortcuts',
      targetTabId: opts?.targetTabId,
      href: opts?.href,
    };
    persist((prev) => ({
      ...prev,
      customTabs: [...prev.customTabs, custom],
      order: [...prev.order, id],
    }));
    return id;
  }, [persist]);

  const reorderTab = useCallback((dragId: string, dropId: string, dropGroup?: string) => {
    if (dragId === dropId) return;
    persist((prev) => {
      const order = [...prev.order];
      const from = order.indexOf(dragId);
      const to = order.indexOf(dropId);
      if (from < 0 || to < 0) return prev;
      order.splice(from, 1);
      order.splice(to, 0, dragId);
      const groupOverrides = { ...prev.groupOverrides };
      if (dropGroup) groupOverrides[dragId] = dropGroup;
      return { ...prev, order, groupOverrides };
    });
  }, [persist]);

  const toggleGroupCollapse = useCallback((group: string) => {
    persist((prev) => ({
      ...prev,
      collapsedGroups: prev.collapsedGroups.includes(group)
        ? prev.collapsedGroups.filter((g) => g !== group)
        : [...prev.collapsedGroups, group],
    }));
  }, [persist]);

  const toggleNavCollapse = useCallback(() => {
    persist((prev) => ({ ...prev, navCollapsed: !prev.navCollapsed }));
  }, [persist]);

  const resetLayout = useCallback(() => {
    setLayout(defaultLayout(catalog));
  }, [catalog]);

  const hiddenTabs = useMemo(
    () => catalog.filter((t) => layout.hidden.includes(t.id)),
    [catalog, layout.hidden],
  );

  const resolveActive = useCallback((active: string, setActive: (id: string) => void) => {
    const ids = visibleTabs.map((t) => t.id);
    if (!ids.includes(active) && ids.length) {
      const fallback = ids[0];
      setActive(fallback);
      return fallback;
    }
    return active;
  }, [visibleTabs]);

  const handleTabSelect = useCallback((
    tab: { id: string; custom?: boolean; targetTabId?: string; href?: string },
    setActive: (id: string) => void,
  ) => {
    if (tab.href) {
      window.location.assign(tab.href);
      return;
    }
    if (tab.custom && tab.targetTabId) {
      setActive(tab.targetTabId);
      return;
    }
    setActive(tab.id);
  }, []);

  return {
    visibleTabs,
    hiddenTabs,
    layout,
    hydrated,
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
    catalog,
  };
}