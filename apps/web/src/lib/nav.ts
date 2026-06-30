export type NavItem = {
  id: string;
  href: string;
  icon: string;
  label: string;
  hint?: string;
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  { id: 'mission', label: 'Mission Control', items: [
    { id: 'dashboard', href: '/dashboard', icon: '🏠', label: 'Dashboard', hint: 'Pulse & act now' },
    { id: 'browse-posts', href: '/browse-posts', icon: '🧭', label: 'Browse Posts', hint: 'Find conversations' },
  ]},
  { id: 'create', label: 'Create & Publish', items: [
    { id: 'onboarding', href: '/onboarding', icon: '🚀', label: 'Setup Wizard', hint: 'Go-live checklist' },
    { id: 'content-hub', href: '/content-hub', icon: '✏️', label: 'Create', hint: 'Draft & publish' },
    { id: 'content-library', href: '/content-library', icon: '📁', label: 'Library', hint: 'Reuse assets' },
    { id: 'design-studio', href: '/design-studio', icon: '🎨', label: 'Design Studio', hint: 'Visual posts' },
    { id: 'brand', href: '/brand', icon: '🎯', label: 'Brand', hint: 'Voice & rules' },
    { id: 'calendar', href: '/calendar', icon: '📅', label: 'Calendar', hint: 'Schedule runway' },
    { id: 'scheduler', href: '/scheduler', icon: '⏱️', label: 'Scheduler', hint: 'Background runs' },
  ]},
  { id: 'discovery', label: 'Discovery & Replies', items: [
    { id: 'prompt-vault', href: '/prompt-vault', icon: '🗄️', label: 'Prompt Vault', hint: 'Saved prompts' },
    { id: 'engagement', href: '/engagement', icon: '👥', label: 'Engagement', hint: 'Warm profiles' },
    { id: 'history', href: '/history', icon: '📜', label: 'AI Replies', hint: 'Approve drafts' },
    { id: 'keywords', href: '/keywords', icon: '🏷️', label: 'Keywords', hint: 'Monitor topics' },
    { id: 'seo-tools', href: '/seo-tools', icon: '🔍', label: 'SEO Tools', hint: 'Research wins' },
  ]},
  { id: 'labs', label: 'Growth Labs', items: [
    { id: 'reddit-ai', href: '/reddit-ai', icon: '🧠', label: 'Growth Lab', hint: 'Reddit modules' },
    { id: 'quora-traffic', href: '/quora-traffic', icon: '❓', label: 'Quora Ops', hint: 'Answer & traffic' },
  ]},
  { id: 'automation', label: 'Automation', items: [
    { id: 'automations', href: '/automations', icon: '🔀', label: 'Automations', hint: 'Visual flows' },
    { id: 'rules', href: '/rules', icon: '⚙️', label: 'Auto-Rules', hint: 'Keyword triggers' },
  ]},
  { id: 'accounts', label: 'Accounts', items: [
    { id: 'account-hub', href: '/account-hub', icon: '🔗', label: 'Accounts', hint: 'Connect & health' },
    { id: 'account-creator', href: '/account-creator', icon: '➕', label: 'Acct Creator', hint: 'New profiles' },
  ]},
  { id: 'system', label: 'System', items: [
    { id: 'dashboard-issues', href: '/dashboard/issues', icon: '🛠️', label: 'Issue Control', hint: 'THEE_MICHAEL GitOps repairs' },
    { id: 'campaign-manager', href: '/campaign-manager', icon: '📋', label: 'Campaign Command', hint: 'Campaigns, schedules & verified nodes' },
    { id: 'support', href: '/support', icon: '💬', label: 'Imperialism Brain', hint: 'Live support' },
    { id: 'dns', href: '/dns', icon: '🌐', label: 'DNS', hint: 'Domain routing' },
    { id: 'integrations', href: '/integrations', icon: '🔌', label: 'Integrations', hint: 'APIs & OAuth' },
    { id: 'settings', href: '/settings', icon: '🎛️', label: 'Settings', hint: 'API keys & billing' },
  ]},
];