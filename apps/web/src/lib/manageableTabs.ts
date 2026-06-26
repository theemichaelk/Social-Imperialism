export type TabCatalogItem = {
  id: string;
  label: string;
  group?: string;
  locked?: boolean;
};

export type CustomTabItem = {
  id: string;
  label: string;
  group?: string;
  /** When clicked, switch to this built-in tab id */
  targetTabId?: string;
  href?: string;
};

export type TabLayoutStorage = {
  version: 1;
  order: string[];
  hidden: string[];
  collapsedGroups: string[];
  navCollapsed: boolean;
  groupOverrides: Record<string, string>;
  customTabs: CustomTabItem[];
};

const STORAGE_PREFIX = 'si-tab-layout:';

export function defaultLayout(catalog: TabCatalogItem[]): TabLayoutStorage {
  return {
    version: 1,
    order: catalog.map((t) => t.id),
    hidden: [],
    collapsedGroups: [],
    navCollapsed: false,
    groupOverrides: {},
    customTabs: [],
  };
}

export function loadTabLayout(pageId: string, catalog: TabCatalogItem[]): TabLayoutStorage {
  if (typeof window === 'undefined') return defaultLayout(catalog);
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${pageId}`);
    if (!raw) return defaultLayout(catalog);
    const parsed = JSON.parse(raw) as TabLayoutStorage;
    const catalogIds = new Set(catalog.map((t) => t.id));
    const customIds = new Set((parsed.customTabs || []).map((t) => t.id));
    const allIds = new Set([...catalogIds, ...customIds]);
    const order = (parsed.order || []).filter((id) => allIds.has(id));
    catalog.forEach((t) => {
      if (!order.includes(t.id) && !(parsed.hidden || []).includes(t.id)) order.push(t.id);
    });
    (parsed.customTabs || []).forEach((t) => {
      if (!order.includes(t.id)) order.push(t.id);
    });
    return {
      version: 1,
      order,
      hidden: (parsed.hidden || []).filter((id) => catalogIds.has(id)),
      collapsedGroups: parsed.collapsedGroups || [],
      navCollapsed: !!parsed.navCollapsed,
      groupOverrides: parsed.groupOverrides || {},
      customTabs: parsed.customTabs || [],
    };
  } catch {
    return defaultLayout(catalog);
  }
}

export function saveTabLayout(pageId: string, layout: TabLayoutStorage) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${STORAGE_PREFIX}${pageId}`, JSON.stringify(layout));
}

export function resolveVisibleTabs(
  catalog: TabCatalogItem[],
  layout: TabLayoutStorage,
): Array<TabCatalogItem & { custom?: boolean; targetTabId?: string; href?: string }> {
  const catalogMap = new Map(catalog.map((t) => [t.id, t]));
  const customMap = new Map((layout.customTabs || []).map((t) => [t.id, t]));
  const visibleIds = layout.order.filter((id) => {
    if (customMap.has(id)) return true;
    return catalogMap.has(id) && !layout.hidden.includes(id);
  });
  return visibleIds.map((id) => {
    const custom = customMap.get(id);
    if (custom) {
      return {
        id: custom.id,
        label: custom.label,
        group: custom.group || 'Shortcuts',
        custom: true,
        targetTabId: custom.targetTabId,
        href: custom.href,
      };
    }
    const base = catalogMap.get(id)!;
    return {
      ...base,
      group: layout.groupOverrides[id] || base.group,
    };
  }).filter(Boolean);
}

export function groupVisibleTabs<T extends { id: string; group?: string }>(tabs: T[]): { group: string; tabs: T[] }[] {
  const groups: string[] = [];
  tabs.forEach((t) => {
    const g = t.group || 'General';
    if (!groups.includes(g)) groups.push(g);
  });
  return groups.map((group) => ({
    group,
    tabs: tabs.filter((t) => (t.group || 'General') === group),
  }));
}