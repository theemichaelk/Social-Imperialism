export const NAV_SECTIONS = [
  { id: 'mission', label: 'Mission Control', items: [
    { id: 'dashboard', href: '/dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'browse-posts', href: '/browse-posts', icon: '🧭', label: 'Browse Posts' },
  ]},
  { id: 'create', label: 'Create & Publish', items: [
    { id: 'onboarding', href: '/onboarding', icon: '🚀', label: 'Setup Wizard' },
    { id: 'content-hub', href: '/content-hub', icon: '✏️', label: 'Content Hub' },
    { id: 'calendar', href: '/calendar', icon: '📅', label: 'Calendar' },
  ]},
  { id: 'discovery', label: 'Discovery & Replies', items: [
    { id: 'engagement', href: '/engagement', icon: '👥', label: 'Engagement' },
    { id: 'history', href: '/history', icon: '📜', label: 'AI Replies' },
    { id: 'keywords', href: '/keywords', icon: '🏷️', label: 'Keywords' },
    { id: 'seo-tools', href: '/seo-tools', icon: '🔍', label: 'SEO Tools' },
  ]},
  { id: 'labs', label: 'Growth Labs', items: [
    { id: 'reddit-ai', href: '/reddit-ai', icon: '🧠', label: 'Growth Lab' },
    { id: 'quora-traffic', href: '/quora-traffic', icon: '❓', label: 'Quora Ops' },
  ]},
  { id: 'automation', label: 'Automation', items: [
    { id: 'automations', href: '/automations', icon: '🔀', label: 'Visual Builder' },
    { id: 'rules', href: '/rules', icon: '⚙️', label: 'Auto-Rules' },
  ]},
  { id: 'accounts', label: 'Accounts', items: [
    { id: 'account-hub', href: '/account-hub', icon: '🔗', label: 'Accounts' },
    { id: 'account-creator', href: '/account-creator', icon: '➕', label: 'Acct Creator' },
  ]},
  { id: 'system', label: 'System', items: [
    { id: 'integrations', href: '/integrations', icon: '🔌', label: 'Integrations' },
    { id: 'settings', href: '/settings', icon: '🎛️', label: 'Settings' },
  ]},
];