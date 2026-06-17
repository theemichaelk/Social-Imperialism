/**
 * Shared sidebar navigation for all Social Imperialism app sections.
 * Usage in renderer (Electron):
 *   const { mountAppSidebar } = require('./sidebar-nav');
 *   mountAppSidebar(); // auto-detects active page from URL + hash
 *   mountAppSidebar('keywords', () => location.reload());
 */

const NAV_ITEMS = [
  { id: 'dashboard', href: 'dashboard.html', icon: 'fa-home', label: 'Dashboard' },
  { id: 'browse-posts', href: 'dashboard.html#browse-posts', icon: 'fa-compass', label: 'Browse Posts' },
  { id: 'onboarding', href: 'onboarding.html', icon: 'fa-rocket', label: 'Setup Wizard' },
  { id: 'content-hub', href: 'content-hub.html', icon: 'fa-edit', label: 'Content Hub' },
  { id: 'engagement', href: 'engagement.html', icon: 'fa-users', label: 'Engagement Lists' },
  { id: 'history', href: 'history.html', icon: 'fa-history', label: 'AI Replies' },
  { id: 'keywords', href: 'keywords.html', icon: 'fa-tags', label: 'Keywords' },
  { id: 'seo-tools', href: 'seo-tools.html', icon: 'fa-search-plus', label: 'SEO Research Tools' },
  { id: 'reddit-ai', href: 'reddit-ai-suite.html', icon: 'fa-brain', label: 'AI Growth Lab' },
  { id: 'quora-traffic', href: 'quora-traffic-ops.html', icon: 'fa-quora', label: 'Quora' },
  { id: 'automations', href: 'automations.html', icon: 'fa-project-diagram', label: 'Visual Builder' },
  { id: 'rules', href: 'rules.html', icon: 'fa-cogs', label: 'Auto-Rules' },
  { id: 'account-hub', href: 'account-hub.html', icon: 'fa-link', label: 'Linked Accounts' },
  { id: 'account-creator', href: 'account-creator.html', icon: 'fa-user-plus', label: 'Account Creator' },
  { id: 'calendar', href: 'calendar.html', icon: 'fa-calendar-alt', label: 'Content Calendar' },
  { id: 'settings', href: 'settings.html', icon: 'fa-sliders-h', label: 'Settings' },
];

/** Visual grouping — all 16 items remain navigable */
const NAV_SECTIONS = [
  { label: 'Mission Control', ids: ['dashboard', 'browse-posts'] },
  { label: 'Create & Publish', ids: ['onboarding', 'content-hub', 'calendar'] },
  { label: 'Discovery & Replies', ids: ['engagement', 'history', 'keywords', 'seo-tools'] },
  { label: 'Growth Labs', ids: ['reddit-ai', 'quora-traffic'] },
  { label: 'Automation', ids: ['automations', 'rules'] },
  { label: 'Accounts', ids: ['account-hub', 'account-creator'] },
  { label: 'System', ids: ['settings'] },
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
  calendar: 'calendar',
  settings: 'settings',
  scheduler: 'calendar',
};

let _hashListenerBound = false;

function detectActivePageId() {
  if (typeof window !== 'undefined' && window.location?.hash === '#browse-posts') {
    return 'browse-posts';
  }
  const path = (typeof window !== 'undefined' && window.location?.pathname) || '';
  const file = path.split('/').pop() || 'dashboard.html';
  const base = file.replace('.html', '');
  return FILE_TO_PAGE_ID[base] || 'dashboard';
}

function buildNavHtml(activeId) {
  const active = activeId || detectActivePageId();
  return NAV_SECTIONS.map((section) => {
    const links = section.ids
      .map((id) => NAV_BY_ID[id])
      .filter(Boolean)
      .map((item) => {
        const cls = item.id === active ? 'nav-link active' : 'nav-link';
        return `<a href="${item.href}" class="${cls}" data-nav-id="${item.id}"><i class="fas ${item.icon}"></i> <span>${item.label}</span></a>`;
      })
      .join('');
    if (!links) return '';
    return `<div class="nav-section"><div class="nav-section-label">${section.label}</div>${links}</div>`;
  }).join('');
}

function updateSidebarActiveState(activeId) {
  if (typeof document === 'undefined') return;
  const active = activeId || detectActivePageId();
  document.querySelectorAll('.sidebar-nav-links .nav-link').forEach((el) => {
    el.classList.toggle('active', el.dataset.navId === active);
  });
}

function bindSidebarNavLinks() {
  if (typeof document === 'undefined') return;
  const nav = document.querySelector('.sidebar-nav-links');
  if (!nav || nav.dataset.bound === '1') return;

  nav.addEventListener('click', (e) => {
    const link = e.target.closest('a.nav-link');
    if (!link) return;
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
    <div class="sidebar-title-container">
      <img src="logo.png" alt="Social Imperialism" class="sidebar-logo" onerror="this.style.display='none'">
      <h2 class="sidebar-title">Social<br>Imperialism</h2>
    </div>
    <div class="campaign-switcher-box">
      <select id="sidebarCampaignSwitcher" aria-label="Active campaign">
        <option value="">Loading Campaigns...</option>
      </select>
    </div>
    <nav class="sidebar-nav-links" aria-label="Main navigation">
      ${navHtml}
    </nav>
    <div class="sidebar-footer">
      <a href="settings.html" class="sidebar-footer-link" data-nav-id="settings"><i class="fas fa-circle" style="font-size:0.45rem;color:#10b981;"></i> Live</a>
    </div>`;

  bindSidebarNavLinks();
  bindHashActiveSync();
  return true;
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
      o.textContent = 'No campaigns — use Setup Wizard or Settings';
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
    initSidebarCampaignSwitcher(onChange);
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