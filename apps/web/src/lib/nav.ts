export type NavItem = {
  id: string;
  href: string;
  icon: string;
  label: string;
  /** Short module description for RSS / discovery feeds */
  hint?: string;
  /** Visible only to platform administrators (THEE_MICHAEL) */
  adminOnly?: boolean;
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

export type NavActiveContext = {
  pathname: string;
  tab?: string | null;
};

/** Legacy paths that map to a canonical sidebar item id */
const NAV_PATH_ALIASES: Record<string, string> = {
  '/verified-nodes': 'campaign-manager',
};

const DASHBOARD_SILOED_TABS = new Set(['users', 'admin']);

export function isNavItemActive(item: NavItem, ctx: NavActiveContext): boolean {
  const { pathname, tab } = ctx;
  const aliasId = NAV_PATH_ALIASES[pathname];
  if (aliasId && item.id === aliasId) return true;

  if (item.id === 'dashboard-users' && pathname === '/dashboard/users') return true;
  if (item.id === 'dashboard-admin' && pathname === '/dashboard/admin') return true;
  if (item.id === 'dashboard-issues' && pathname === '/dashboard/issues') return true;

  if (item.href !== pathname) return false;

  if (pathname === '/dashboard' && item.id === 'dashboard') {
    return !tab || !DASHBOARD_SILOED_TABS.has(tab);
  }

  return true;
}

export function findActiveNavSectionId(ctx: NavActiveContext): string | undefined {
  return NAV_SECTIONS.find((section) => section.items.some((item) => isNavItemActive(item, ctx)))?.id;
}

export const NAV_SECTIONS: NavSection[] = [
  { id: 'mission', label: 'Mission Control', items: [
    { id: 'dashboard', href: '/dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'browse-posts', href: '/browse-posts', icon: '🧭', label: 'Browse Posts' },
  ]},
  { id: 'create', label: 'Create & Publish', items: [
    { id: 'onboarding', href: '/onboarding', icon: '🚀', label: 'Setup Wizard' },
    { id: 'content-hub', href: '/content-hub', icon: '✏️', label: 'Create' },
    { id: 'content-library', href: '/content-library', icon: '📁', label: 'Library' },
    { id: 'design-studio', href: '/design-studio', icon: '🎨', label: 'Design Studio' },
    { id: 'video-studio', href: '/video-studio', icon: '🎬', label: 'Video Studio' },
    { id: 'brand', href: '/brand', icon: '🎯', label: 'Brand' },
    { id: 'calendar', href: '/calendar', icon: '📅', label: 'Calendar' },
    { id: 'scheduler', href: '/scheduler', icon: '⏱️', label: 'Scheduler' },
  ]},
  { id: 'discovery', label: 'Discovery & Replies', items: [
    { id: 'prompt-vault', href: '/prompt-vault', icon: '🗄️', label: 'Prompt Vault' },
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
    { id: 'automations', href: '/automations', icon: '🔀', label: 'Automations' },
    { id: 'rules', href: '/rules', icon: '⚙️', label: 'Auto-Rules' },
  ]},
  { id: 'accounts', label: 'Accounts', items: [
    { id: 'account-hub', href: '/account-hub', icon: '🔗', label: 'Accounts' },
    { id: 'account-creator', href: '/account-creator', icon: '➕', label: 'Acct Creator' },
  ]},
  { id: 'system', label: 'System', items: [
    { id: 'dashboard-users', href: '/dashboard/users', icon: '👤', label: 'My Account' },
    { id: 'dashboard-admin', href: '/dashboard/admin', icon: '🛡️', label: 'Admin', adminOnly: true },
    { id: 'dashboard-issues', href: '/dashboard/issues', icon: '🛠️', label: 'Issue Control', adminOnly: true },
    { id: 'campaign-manager', href: '/campaign-manager', icon: '📋', label: 'Campaign Command' },
    { id: 'support', href: '/support', icon: '💬', label: 'Imperialism Brain' },
    { id: 'dns', href: '/dns', icon: '🌐', label: 'DNS' },
    { id: 'integrations', href: '/integrations', icon: '🔌', label: 'Integrations' },
    { id: 'settings', href: '/settings', icon: '🎛️', label: 'Settings' },
  ]},
];