/**
 * Neural Command Matrix — desktop parity with live SaaS dashboard.
 */
const DESKTOP_COMMAND_SECTIONS = [
  { label: 'Mission Control', items: [
    { id: 'dashboard', href: 'dashboard.html', icon: '🏠', label: 'Dashboard', desc: 'Real-time KPIs, live feed, worker status' },
    { id: 'browse-posts', href: 'dashboard.html#browse-posts', icon: '🧭', label: 'Browse Posts', desc: 'Discover posts — draft, engage, schedule' },
  ]},
  { label: 'Create & Publish', items: [
    { id: 'onboarding', href: 'onboarding.html', icon: '🚀', label: 'Setup Wizard', desc: 'Brand setup, keywords, go-live checklist' },
    { id: 'content-hub', href: 'content-hub.html', icon: '✏️', label: 'Create', desc: 'Imperial studio, publish wizard, RSS' },
    { id: 'content-library', href: 'content-library.html', icon: '📁', label: 'Library', desc: 'Central asset hub — images, video, copy' },
    { id: 'design-studio', href: 'design-studio.html', icon: '🎨', label: 'Design Studio', desc: 'Template visual post designer' },
    { id: 'brand', href: 'brand.html', icon: '🎯', label: 'Brand', desc: 'Voice and rules for all AI copy' },
    { id: 'calendar', href: 'calendar.html', icon: '📅', label: 'Calendar', desc: 'Schedule, edit, publish' },
    { id: 'scheduler', href: 'calendar.html#scheduler', icon: '⏱️', label: 'Scheduler', desc: 'Queue and background run windows' },
  ]},
  { label: 'Discovery & Replies', items: [
    { id: 'engagement', href: 'engagement.html', icon: '👥', label: 'Engagement', desc: 'CRM — LinkedIn lists, AI comments' },
    { id: 'history', href: 'history.html', icon: '📜', label: 'AI Replies', desc: 'Approval workflow and agency reports' },
    { id: 'keywords', href: 'keywords.html', icon: '🏷️', label: 'Keywords', desc: 'AI suggestions, Quantum Pages' },
    { id: 'seo-tools', href: 'seo-tools.html', icon: '🔍', label: 'SEO Tools', desc: 'KGR, scrapers, autocomplete' },
  ]},
  { label: 'Growth Labs', items: [
    { id: 'reddit-ai', href: 'reddit-ai-suite.html', icon: '🧠', label: 'Growth Lab', desc: 'Six Reddit growth modules' },
    { id: 'quora-traffic', href: 'quora-traffic-ops.html', icon: '❓', label: 'Quora Ops', desc: 'Research → Generate → Publish' },
  ]},
  { label: 'Automation', items: [
    { id: 'automations', href: 'automations.html', icon: '🔀', label: 'Automations', desc: 'Visual drag-drop builder' },
    { id: 'rules', href: 'rules.html', icon: '⚙️', label: 'Auto-Rules', desc: 'Worker, Be First, crisis moderation' },
  ]},
  { label: 'Accounts', items: [
    { id: 'account-hub', href: 'account-hub.html', icon: '🔗', label: 'Accounts', desc: 'Connect 16 platforms via OAuth' },
    { id: 'account-creator', href: 'account-creator.html', icon: '➕', label: 'Acct Creator', desc: 'Profile kit generator, proxies' },
  ]},
  { label: 'System', items: [
    { id: 'dns', href: 'dns.html', icon: '🌐', label: 'DNS', desc: 'Route53 registry, record CRUD' },
    { id: 'integrations', href: 'integrations.html', icon: '🔌', label: 'Integrations', desc: 'Live probes, email, webhooks' },
    { id: 'settings', href: 'settings.html', icon: '🎛️', label: 'Settings', desc: 'Campaigns, billing, Grok, health' },
  ]},
];

function renderDesktopCommandCenter(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const sectionsHtml = DESKTOP_COMMAND_SECTIONS.map((sec) => `
    <div class="command-section" style="margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;padding-bottom:0.35rem;border-bottom:1px solid rgba(56,189,248,0.12)">
        <span style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.1em;color:#38bdf8;font-weight:700">${sec.label}</span>
        <span style="font-size:0.68rem;color:#64748b">${sec.items.length} modules</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${sec.items.map((item) => `
          <a href="${item.href}" class="neo-card" style="text-decoration:none;color:inherit;margin:0;padding:0.85rem;display:flex;flex-direction:column;gap:4px">
            <span style="font-size:1.2rem">${item.icon}</span>
            <strong style="font-size:0.88rem;color:#e8f0fc">${item.label}</strong>
            <span style="font-size:0.72rem;color:#8ba3c7;line-height:1.4">${item.desc}</span>
            <span style="font-size:0.68rem;color:#38bdf8;margin-top:4px">Launch →</span>
          </a>
        `).join('')}
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="neo-page-header" style="margin-bottom:1rem">
      <p class="neo-eyebrow">Neural Command Matrix</p>
      <h2 class="neo-title" style="font-size:1.2rem">Full Platform Capability Grid</h2>
      <p class="neo-subtitle" style="font-size:0.82rem">22 modules — desktop parity with live SaaS at socialimperialism.com</p>
    </div>
    ${sectionsHtml}
  `;
}

if (typeof module !== 'undefined') {
  module.exports = { renderDesktopCommandCenter, DESKTOP_COMMAND_SECTIONS };
}