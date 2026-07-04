/**
 * Shared sidebar navigation for all Social Imperialism app sections.
 */
const NAV_ITEMS = [
  { id: 'dashboard', href: 'dashboard.html', icon: 'fa-home', label: 'Dashboard' },
  { id: 'browse-posts', href: 'dashboard.html#browse-posts', icon: 'fa-compass', label: 'Browse Posts' },
  { id: 'onboarding', href: 'onboarding.html', icon: 'fa-rocket', label: 'Setup Wizard' },
  { id: 'content-hub', href: 'content-hub.html', icon: 'fa-edit', label: 'Create' },
  { id: 'content-library', href: 'content-library.html', icon: 'fa-folder-open', label: 'Library' },
  { id: 'design-studio', href: 'design-studio.html', icon: 'fa-palette', label: 'Design Studio' },
  { id: 'brand', href: 'brand.html', icon: 'fa-bullseye', label: 'Brand' },
  { id: 'calendar', href: 'calendar.html', icon: 'fa-calendar-alt', label: 'Calendar' },
  { id: 'scheduler', href: 'calendar.html#scheduler', icon: 'fa-clock', label: 'Scheduler' },
  { id: 'prompt-vault', href: '#', icon: 'fa-archive', label: 'Prompt Vault', saasPath: '/prompt-vault' },
  { id: 'engagement', href: 'engagement.html', icon: 'fa-users', label: 'Engagement' },
  { id: 'history', href: 'history.html', icon: 'fa-history', label: 'AI Replies' },
  { id: 'keywords', href: 'keywords.html', icon: 'fa-tags', label: 'Keywords' },
  { id: 'seo-tools', href: 'seo-tools.html', icon: 'fa-search-plus', label: 'SEO Tools' },
  { id: 'reddit-ai', href: 'reddit-ai-suite.html', icon: 'fa-brain', label: 'Growth Lab' },
  { id: 'quora-traffic', href: 'quora-traffic-ops.html', icon: 'fa-quora', label: 'Quora Ops' },
  { id: 'automations', href: 'automations.html', icon: 'fa-project-diagram', label: 'Automations' },
  { id: 'rules', href: 'rules.html', icon: 'fa-cogs', label: 'Auto-Rules' },
  { id: 'account-hub', href: 'account-hub.html', icon: 'fa-link', label: 'Accounts' },
  { id: 'account-creator', href: 'account-creator.html', icon: 'fa-user-plus', label: 'Acct Creator' },
  { id: 'dns', href: 'dns.html', icon: 'fa-globe', label: 'DNS' },
  { id: 'integrations', href: 'integrations.html', icon: 'fa-plug', label: 'Integrations' },
  { id: 'settings', href: 'settings.html', icon: 'fa-sliders-h', label: 'Settings' },
  { id: 'support', href: '#', icon: 'fa-comments', label: 'Imperialism Brain', saasPath: '/support' },
  { id: 'campaign-manager', href: '#', icon: 'fa-clipboard-list', label: 'Campaign Command', saasPath: '/campaign-manager' },
];

const NAV_SECTIONS = [
  { id: 'mission', label: 'Mission Control', ids: ['dashboard', 'browse-posts'] },
  { id: 'create', label: 'Create & Publish', ids: ['onboarding', 'content-hub', 'content-library', 'design-studio', 'brand', 'calendar', 'scheduler'] },
  { id: 'discovery', label: 'Discovery & Replies', ids: ['prompt-vault', 'engagement', 'history', 'keywords', 'seo-tools'] },
  { id: 'labs', label: 'Growth Labs', ids: ['reddit-ai', 'quora-traffic'] },
  { id: 'automation', label: 'Automation', ids: ['automations', 'rules'] },
  { id: 'accounts', label: 'Accounts', ids: ['account-hub', 'account-creator'] },
  { id: 'system', label: 'System', ids: ['dns', 'integrations', 'settings', 'support', 'campaign-manager'] },
];

const NAV_BY_ID = Object.fromEntries(NAV_ITEMS.map((item) => [item.id, item]));

const FILE_TO_PAGE_ID = {
  dashboard: 'dashboard',
  onboarding: 'onboarding',
  engagement: 'engagement',
  history: 'history',
  keywords: 'keywords',
  'seo-tools': 'seo-tools',
  'reddit-ai-suite': 'reddit-ai',
  'quora-traffic-ops': 'quora-traffic',
  automations: 'automations',
  rules: 'rules',
  'account-hub': 'account-hub',
  'account-creator': 'account-creator',
  'content-hub': 'content-hub',
  'content-library': 'content-library',
  'design-studio': 'design-studio',
  brand: 'brand',
  calendar: 'calendar',
  settings: 'settings',
  scheduler: 'scheduler',
  dns: 'dns',
  integrations: 'integrations',
};

const COLLAPSE_KEY = 'siNavCollapsedSections';
const SIDEBAR_COLLAPSED_KEY = 'siSidebarCollapsed';

let _hashListenerBound = false;

function detectActivePageId() {
  if (typeof window !== 'undefined') {
    if (window.location?.hash === '#browse-posts') return 'browse-posts';
    if (window.location?.hash === '#scheduler') return 'scheduler';
  }
  const path = (typeof window !== 'undefined' && window.location?.pathname) || '';
  const file = path.split('/').pop() || 'dashboard.html';
  const base = file.replace('.html', '');
  return FILE_TO_PAGE_ID[base] || 'dashboard';
}

function getCollapsedSections() {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveCollapsedSections(map) {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(map));
  } catch (e) { /* ignore */ }
}

async function openSaasModule(path) {
  try {
    const { ipcRenderer } = require('electron');
    const base = await ipcRenderer.invoke('get-saas-web-url');
    const url = `${String(base || 'https://www.socialimperialism.com').replace(/\/$/, '')}${path}`;
    await ipcRenderer.invoke('open-external-url', url);
  } catch (e) {
    console.warn('SaaS nav open failed:', e.message);
  }
}

function sectionForPageId(pageId) {
  const sec = NAV_SECTIONS.find((s) => s.ids.includes(pageId));
  return sec?.id || null;
}

function buildNavHtml(activeId) {
  const active = activeId || detectActivePageId();
  const collapsed = getCollapsedSections();
  const activeSection = sectionForPageId(active);

  return NAV_SECTIONS.map((section) => {
    const links = section.ids
      .map((id) => NAV_BY_ID[id])
      .filter(Boolean)
      .map((item) => {
        const cls = item.id === active ? 'nav-link active' : 'nav-link';
        const saasAttr = item.saasPath ? ` data-saas-path="${item.saasPath}"` : '';
        return `<a href="${item.href}" class="${cls}" data-nav-id="${item.id}" data-nav-label="${item.label.toLowerCase()}"${saasAttr}><i class="fas ${item.icon}"></i><span>${item.label}</span></a>`;
      })
      .join('');
    if (!links) return '';

    const isCollapsed = collapsed[section.id] === true && section.id !== activeSection;
    const collapsedCls = isCollapsed ? ' collapsed' : '';

    return `<div class="nav-section${collapsedCls}" data-section-id="${section.id}">
      <button type="button" class="nav-section-toggle" aria-expanded="${!isCollapsed}" title="${isCollapsed ? 'Expand' : 'Collapse'} ${section.label}">
        <span class="nav-section-label">${section.label}</span>
        <i class="fas fa-chevron-down nav-section-chevron"></i>
      </button>
      <div class="nav-section-items">${links}</div>
    </div>`;
  }).join('');
}

function updateSidebarActiveState(activeId) {
  if (typeof document === 'undefined') return;
  const active = activeId || detectActivePageId();
  document.querySelectorAll('.sidebar-nav-links .nav-link').forEach((el) => {
    el.classList.toggle('active', el.dataset.navId === active);
  });

  const secId = sectionForPageId(active);
  if (secId) {
    const collapsed = getCollapsedSections();
    if (collapsed[secId]) {
      collapsed[secId] = false;
      saveCollapsedSections(collapsed);
      const sec = document.querySelector(`.nav-section[data-section-id="${secId}"]`);
      if (sec) {
        sec.classList.remove('collapsed');
        sec.querySelector('.nav-section-toggle')?.setAttribute('aria-expanded', 'true');
      }
    }
  }
}

function bindSectionToggles() {
  document.querySelectorAll('.nav-section-toggle').forEach((btn) => {
    if (btn.dataset.bound === '1') return;
    btn.addEventListener('click', () => {
      const section = btn.closest('.nav-section');
      if (!section) return;
      const id = section.dataset.sectionId;
      const collapsed = getCollapsedSections();
      const willCollapse = !section.classList.contains('collapsed');
      collapsed[id] = willCollapse;
      saveCollapsedSections(collapsed);
      section.classList.toggle('collapsed', willCollapse);
      btn.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
    });
    btn.dataset.bound = '1';
  });
}

function applyAllSectionCollapse(map) {
  saveCollapsedSections(map);
  document.querySelectorAll('.nav-section').forEach((sec) => {
    const id = sec.dataset.sectionId;
    const isCollapsed = map[id] === true;
    sec.classList.toggle('collapsed', isCollapsed);
    sec.querySelector('.nav-section-toggle')?.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
  });
}

function collapseAllSections() {
  const active = sectionForPageId(detectActivePageId());
  const map = Object.fromEntries(NAV_SECTIONS.map((s) => [s.id, true]));
  if (active) map[active] = false;
  applyAllSectionCollapse(map);
}

function expandAllSections() {
  applyAllSectionCollapse({});
}

function bindSectionBulkControls() {
  document.getElementById('siExpandAllSections')?.addEventListener('click', expandAllSections);
  document.getElementById('siCollapseAllSections')?.addEventListener('click', collapseAllSections);
}

function bindNavSearch() {
  const input = document.getElementById('siNavSearch');
  if (!input || input.dataset.bound === '1') return;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('.sidebar-nav-links .nav-link').forEach((link) => {
      const label = link.dataset.navLabel || link.textContent.toLowerCase();
      const show = !q || label.includes(q);
      link.classList.toggle('nav-hidden', !show);
      if (show) visible += 1;
    });

    document.querySelectorAll('.nav-section').forEach((sec) => {
      const anyVisible = !!sec.querySelector('.nav-link:not(.nav-hidden)');
      sec.style.display = anyVisible ? '' : 'none';
      if (q && anyVisible) {
        sec.classList.remove('collapsed');
      }
    });

    const empty = document.getElementById('siNavNoResults');
    if (empty) empty.classList.toggle('visible', q.length > 0 && visible === 0);
  });

  input.dataset.bound = '1';
}

function bindSidebarCollapse() {
  const btn = document.getElementById('siSidebarCollapseBtn');
  if (!btn || btn.dataset.bound === '1') return;

  const apply = (collapsed) => {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = collapsed ? 'fas fa-angle-double-right' : 'fas fa-angle-double-left';
    }
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch (e) { /* ignore */ }
  };

  let collapsed = false;
  try {
    collapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch (e) { /* ignore */ }
  apply(collapsed);

  btn.addEventListener('click', () => {
    collapsed = !document.body.classList.contains('sidebar-collapsed');
    apply(collapsed);
  });
  btn.dataset.bound = '1';
}

function bindSidebarNavLinks() {
  if (typeof document === 'undefined') return;
  const nav = document.querySelector('.sidebar-nav-links');
  if (!nav || nav.dataset.bound === '1') return;

  nav.addEventListener('click', (e) => {
    const link = e.target.closest('a.nav-link');
    if (!link) return;
    const saasPath = link.dataset.saasPath;
    if (saasPath) {
      e.preventDefault();
      openSaasModule(saasPath);
      return;
    }
    const href = link.getAttribute('href') || '';
    if (!href.includes('#')) return;

    const currentFile = location.pathname.split('/').pop() || 'dashboard.html';
    const [pathPart, hashPart] = href.split('#');
    const targetFile = pathPart || currentFile;
    if ((targetFile === currentFile || !pathPart) && hashPart) {
      const nextHash = `#${hashPart}`;
      if (location.hash !== nextHash) {
        e.preventDefault();
        location.hash = nextHash;
        updateSidebarActiveState(link.dataset.navId);
        window.dispatchEvent(new CustomEvent('si-nav-hash', { detail: { id: link.dataset.navId, hash: nextHash } }));
      }
    }
  });
  nav.dataset.bound = '1';
}

function bindHashActiveSync() {
  if (typeof window === 'undefined' || _hashListenerBound) return;
  window.addEventListener('hashchange', () => {
    updateSidebarActiveState(detectActivePageId());
    window.dispatchEvent(new CustomEvent('si-nav-hash', { detail: { id: detectActivePageId(), hash: location.hash } }));
  });
  _hashListenerBound = true;
}

function renderAppSidebar(activeId) {
  if (typeof document === 'undefined') return false;
  const el = document.getElementById('app-sidebar');
  if (!el) return false;

  const navHtml = buildNavHtml(activeId);

  el.className = 'sidebar app-sidebar';
  el.innerHTML = `
    <div class="si-sidebar-header">
      <div class="sidebar-title-container">
        <img src="logo.png" alt="Social Imperialism" class="sidebar-logo" onerror="this.style.display='none'">
        <h2 class="sidebar-title">Social<br>Imperialism</h2>
      </div>
      <div class="si-sidebar-search">
        <i class="fas fa-search"></i>
        <input type="search" id="siNavSearch" placeholder="Filter menu…" autocomplete="off" aria-label="Filter navigation">
      </div>
      <div class="si-sidebar-section-controls">
        <button type="button" class="si-section-ctrl" id="siExpandAllSections" title="Expand all sections">Expand all</button>
        <button type="button" class="si-section-ctrl" id="siCollapseAllSections" title="Collapse all sections">Collapse all</button>
      </div>
      <div class="campaign-switcher-box">
        <select id="sidebarCampaignSwitcher" aria-label="Active campaign">
          <option value="">Loading campaigns…</option>
        </select>
      </div>
    </div>
    <nav class="sidebar-nav-links" aria-label="Main navigation">
      ${navHtml}
      <div class="nav-no-results" id="siNavNoResults">No menu items match your search.</div>
    </nav>
    <div class="si-sidebar-footer">
      <button type="button" class="si-collapse-btn" id="siSidebarCollapseBtn" title="Collapse sidebar">
        <i class="fas fa-angle-double-left"></i><span>Collapse</span>
      </button>
      <button type="button" class="si-sign-out-btn" id="siSignOutBtn" title="Sign out">
        <i class="fas fa-sign-out-alt"></i><span>Sign Out</span>
      </button>
      <a href="settings.html#system-health" class="sidebar-footer-link" id="siHealthLink" data-nav-id="settings" title="System health — open Campaign Manager">
        <i class="fas fa-circle si-health-dot" id="siHealthDot" style="font-size:0.45rem;color:#10b981;"></i>
        <span id="siHealthLabel">Checking…</span>
      </a>
      <div class="si-version-label" id="siAppVersion"></div>
    </div>`;

  try {
    const ver = require('./package.json').version;
    const verEl = document.getElementById('siAppVersion');
    if (verEl) verEl.textContent = `v${ver}`;
  } catch (e) { /* ignore */ }

  bindSidebarNavLinks();
  bindHashActiveSync();
  bindSectionToggles();
  bindSectionBulkControls();
  bindNavSearch();
  bindSidebarCollapse();
  return true;
}

async function initSidebarHealthBadge() {
  if (typeof document === 'undefined') return;
  const dot = document.getElementById('siHealthDot');
  const label = document.getElementById('siHealthLabel');
  if (!dot || !label) return;

  let ipcRenderer;
  try {
    ({ ipcRenderer } = require('electron'));
  } catch (e) {
    label.textContent = 'Live';
    return;
  }

  try {
    const report = await ipcRenderer.invoke('get-page-health');
    const s = report?.summary || {};
    const broken = s.broken || 0;
    const warn = s.warn || 0;
    if (broken > 0) {
      dot.style.color = '#f87171';
      label.textContent = `${broken} broken`;
    } else if (warn > 0) {
      dot.style.color = '#fbbf24';
      label.textContent = `${warn} need setup`;
    } else {
      dot.style.color = '#10b981';
      label.textContent = `${s.ok || 0} pages ready`;
    }
  } catch (e) {
    dot.style.color = '#94a3b8';
    label.textContent = 'Live';
  }
}

async function initSidebarCampaignSwitcher(onChange) {
  if (typeof document === 'undefined') return;
  const sel = document.getElementById('sidebarCampaignSwitcher');
  if (!sel) return;

  let ipcRenderer;
  try {
    ({ ipcRenderer } = require('electron'));
  } catch (e) {
    return;
  }

  try {
    const camps = await ipcRenderer.invoke('get-settings') || [];
    sel.innerHTML = '';
    if (!camps.length) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'No campaigns — Setup Wizard';
      sel.appendChild(o);
    } else {
      camps.forEach((c) => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.brandName || c.id;
        sel.appendChild(o);
      });
    }
    const active = await ipcRenderer.invoke('get-active-campaign').catch(() => null);
    if (active?.id) sel.value = active.id;
  } catch (e) {
    console.warn('Campaign switcher load failed:', e.message);
  }

  if (sel.dataset.bound !== '1') {
    sel.onchange = async () => {
      try {
        if (sel.value) await ipcRenderer.invoke('set-active-campaign', sel.value);
        if (typeof onChange === 'function') onChange(sel.value);
      } catch (e) {
        console.warn('Campaign switch failed:', e.message);
      }
    };
    sel.dataset.bound = '1';
  }
}

function integratePageGrokAssist(activeId) {
  if (typeof document === 'undefined') return;
  const pageId = activeId || detectActivePageId();

  const run = () => {
    try {
      const { integrateGrokForPage } = require('./grok-integrate');
      integrateGrokForPage(pageId);
    } catch (e) {
      console.warn('Grok integrate:', e.message);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    requestAnimationFrame(run);
  }
}

function mountAppSidebar(activeId, onChange) {
  if (typeof document === 'undefined') return;

  try {
    const { getIpcRenderer } = require('./renderer-ipc');
    const ipc = getIpcRenderer();
    if (ipc && typeof window !== 'undefined') window.__siIpcRenderer = ipc;
  } catch (e) { /* optional */ }

  const resolvedActive = activeId || detectActivePageId();

  const boot = () => {
    document.body.classList.add('app-shell');
    if (!renderAppSidebar(resolvedActive)) return;
    try {
      const authSession = require('./js/auth-session');
      authSession.initAuthSession().then(() => authSession.bindLogoutButton());
    } catch (e) {
      console.warn('Auth guard:', e.message);
    }
    initSidebarCampaignSwitcher(onChange);
    initSidebarHealthBadge();
    integratePageGrokAssist(resolvedActive);
    updateSidebarActiveState(resolvedActive);
  };

  if (document.getElementById('app-sidebar')) {
    boot();
    return;
  }

  const onReady = () => boot();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady, { once: true });
  } else {
    onReady();
  }
}

module.exports = {
  NAV_ITEMS,
  NAV_SECTIONS,
  detectActivePageId,
  renderAppSidebar,
  updateSidebarActiveState,
  initSidebarCampaignSwitcher,
  mountAppSidebar,
  integratePageGrokAssist,
  bindSidebarNavLinks,
};