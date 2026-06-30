/**
 * Shared bootstrap for SaaS-parity desktop pages.
 */
function mountNeoPage({ pageId, title, subtitle, eyebrow, onCampaignSwitch }) {
  try {
    const { mountAppSidebar } = require('./sidebar-nav');
    mountAppSidebar(pageId, onCampaignSwitch);
  } catch (e) {
    if (typeof renderAppSidebar === 'function') {
      renderAppSidebar(pageId);
      if (typeof updateSidebarActiveState === 'function') updateSidebarActiveState(pageId);
    }
  }
  const header = document.getElementById('neoPageHeader');
  if (header) {
    header.innerHTML = `
      <p class="neo-eyebrow">${eyebrow || 'Social Imperialism'}</p>
      <h1 class="neo-title">${title}</h1>
      ${subtitle ? `<p class="neo-subtitle">${subtitle}</p>` : ''}
    `;
  }
}

function showToast(msg, elId = 'neoToast') {
  const el = document.getElementById(elId);
  if (el) {
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}