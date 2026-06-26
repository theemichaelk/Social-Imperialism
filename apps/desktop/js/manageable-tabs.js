/**
 * Manageable tabs — collapse, drag-reorder, close, restore, custom shortcuts.
 * Persists layout to localStorage per pageId.
 */
(function (global) {
  const PREFIX = 'si-tab-layout:';

  function defaultLayout(catalog) {
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

  function loadLayout(pageId, catalog) {
    try {
      const raw = localStorage.getItem(PREFIX + pageId);
      if (!raw) return defaultLayout(catalog);
      const parsed = JSON.parse(raw);
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

  function saveLayout(pageId, layout) {
    localStorage.setItem(PREFIX + pageId, JSON.stringify(layout));
  }

  function visibleTabs(catalog, layout) {
    const map = new Map(catalog.map((t) => [t.id, t]));
    const customMap = new Map((layout.customTabs || []).map((t) => [t.id, t]));
    return layout.order
      .filter((id) => customMap.has(id) || (map.has(id) && !layout.hidden.includes(id)))
      .map((id) => {
        const c = customMap.get(id);
        if (c) return { id: c.id, label: c.label, group: c.group || 'Shortcuts', custom: true, targetTabId: c.targetTabId, locked: false };
        const b = map.get(id);
        return { ...b, group: layout.groupOverrides[id] || b.group };
      });
  }

  function mount(root, options) {
    const { pageId, catalog, grouped, onSelect, getActive, setActive } = options;
    let layout = loadLayout(pageId, catalog);
    let dragId = null;

    function persist() {
      saveLayout(pageId, layout);
      render();
    }

    function render() {
      const vis = visibleTabs(catalog, layout);
      const active = getActive();
      if (!vis.some((t) => t.id === active) && vis.length) {
        const fb = vis[0];
        setActive(fb.targetTabId || fb.id);
      }

      root.innerHTML = '';
      const toolbar = document.createElement('div');
      toolbar.className = 'mtab-toolbar';
      toolbar.innerHTML = `
        <button type="button" class="mtab-tool" data-act="toggle-nav">${layout.navCollapsed ? '▸ Tabs' : '▾ Tabs'}</button>
        <button type="button" class="mtab-tool primary" data-act="add">+ Add tab</button>
        <button type="button" class="mtab-tool" data-act="reset">Reset layout</button>
      `;
      root.appendChild(toolbar);

      toolbar.querySelector('[data-act="toggle-nav"]').onclick = () => {
        layout.navCollapsed = !layout.navCollapsed;
        persist();
      };
      toolbar.querySelector('[data-act="reset"]').onclick = () => {
        if (confirm('Reset tab layout to defaults?')) {
          layout = defaultLayout(catalog);
          persist();
        }
      };
      toolbar.querySelector('[data-act="add"]').onclick = () => {
        const hidden = catalog.filter((t) => layout.hidden.includes(t.id));
        if (hidden.length) {
          const pick = prompt('Restore tab id:\n' + hidden.map((t) => t.id).join(', '));
          if (pick && layout.hidden.includes(pick)) {
            layout.hidden = layout.hidden.filter((x) => x !== pick);
            layout.order.push(pick);
            setActive(pick);
            persist();
          }
        } else {
          const label = prompt('Shortcut tab name:');
          if (!label) return;
          const target = prompt('Target tab id (optional):');
          const id = 'custom_' + Date.now();
          layout.customTabs.push({ id, label, group: 'Shortcuts', targetTabId: target || undefined });
          layout.order.push(id);
          persist();
          if (target) setActive(target);
        }
      };

      if (layout.navCollapsed) return;

      const strip = document.createElement('div');
      strip.className = grouped ? 'ch-tab-groups' : 'tabs mtab-strip';
      root.appendChild(strip);

      const groups = grouped
        ? [...new Set(vis.map((t) => t.group || 'General'))]
        : ['General'];

      groups.forEach((group) => {
        const gTabs = vis.filter((t) => (t.group || 'General') === group);
        if (!gTabs.length) return;
        const gEl = document.createElement('div');
        gEl.className = grouped ? 'ch-tab-group' : 'mtab-flat-group';
        if (grouped) {
          const lbl = document.createElement('button');
          lbl.type = 'button';
          lbl.className = 'ch-tab-group-label mtab-group-toggle';
          const collapsed = layout.collapsedGroups.includes(group);
          lbl.textContent = (collapsed ? '▸ ' : '▾ ') + group;
          lbl.onclick = () => {
            if (collapsed) layout.collapsedGroups = layout.collapsedGroups.filter((g) => g !== group);
            else layout.collapsedGroups.push(group);
            persist();
          };
          gEl.appendChild(lbl);
          if (collapsed) {
            strip.appendChild(gEl);
            return;
          }
        }
        const items = document.createElement('div');
        items.className = grouped ? 'ch-tab-group-items tabs' : 'mtab-strip-items';
        gTabs.forEach((tab) => {
          const chip = document.createElement('div');
          const tabKey = tab.targetTabId || tab.id;
          chip.className = 'mtab-chip tab' + (active === tabKey ? ' active' : '');
          chip.draggable = true;
          chip.dataset.tabId = tab.id;
          chip.dataset.tab = tabKey;
          chip.innerHTML = `<span class="mtab-chip-label">${tab.custom ? '★ ' : ''}${tab.label}</span>`;
          if (!tab.locked) {
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'mtab-chip-close';
            close.textContent = '×';
            close.onclick = (e) => {
              e.stopPropagation();
              if (tab.custom) {
                layout.customTabs = layout.customTabs.filter((t) => t.id !== tab.id);
                layout.order = layout.order.filter((x) => x !== tab.id);
              } else {
                layout.hidden.push(tab.id);
                layout.order = layout.order.filter((x) => x !== tab.id);
              }
              if (getActive() === tab.id) {
                const next = visibleTabs(catalog, layout)[0];
                if (next) setActive(next.targetTabId || next.id);
              }
              persist();
            };
            chip.appendChild(close);
          }
          chip.ondragstart = () => { dragId = tab.id; };
          chip.ondragend = () => { dragId = null; };
          chip.ondragover = (e) => e.preventDefault();
          chip.ondrop = (e) => {
            e.preventDefault();
            if (!dragId || dragId === tab.id) return;
            const order = [...layout.order];
            const from = order.indexOf(dragId);
            const to = order.indexOf(tab.id);
            if (from < 0 || to < 0) return;
            order.splice(from, 1);
            order.splice(to, 0, dragId);
            layout.order = order;
            if (grouped) layout.groupOverrides[dragId] = group;
            persist();
          };
          chip.querySelector('.mtab-chip-label').onclick = () => {
            const id = tab.targetTabId || tab.id;
            setActive(id);
            if (onSelect) onSelect(id, tab);
          };
          items.appendChild(chip);
        });
        gEl.appendChild(items);
        strip.appendChild(gEl);
      });
    }

    render();
    return { refresh: render, getLayout: () => layout };
  }

  global.SiManageableTabs = { mount, loadLayout, saveLayout };
})(typeof window !== 'undefined' ? window : globalThis);