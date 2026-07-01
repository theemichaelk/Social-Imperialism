/**
 * Per-page focus metadata — outcomes, flows, and primary actions.
 * Drives PageFocusRail, sidebar hints, and default tab visibility.
 */

export type FocusAction = {
  label: string;
  href?: string;
  tab?: string;
  primary?: boolean;
};

export type PageFocusConfig = {
  id: string;
  title: string;
  outcome: string;
  subtitle: string;
  flow: string[];
  focusTabIds?: string[];
  collapseGroups?: string[];
  actions: FocusAction[];
  related: Array<{ label: string; href: string }>;
};

export const GLOBAL_FOCUS_PATH = [
  { label: 'Scan', href: '/dashboard' },
  { label: 'Discover', href: '/browse-posts' },
  { label: 'Reply', href: '/history' },
  { label: 'Publish', href: '/content-hub?tab=studio' },
  { label: 'Schedule', href: '/calendar' },
];

export const PAGE_FOCUS: Record<string, PageFocusConfig> = {
  '/dashboard': {
    id: 'dashboard',
    title: 'Mission Control',
    outcome: 'See what is happening right now and act on the highest-value opportunities.',
    subtitle: 'Real-time pulse — feed, worker, leads, and campaign health in one view.',
    flow: ['Overview', 'Live Feed', 'Draft & Engage', 'Worker', 'Analytics'],
    focusTabIds: ['overview', 'feed', 'growth'],
    collapseGroups: ['Analytics'],
    actions: [
      { label: 'Full Scan', primary: true },
      { label: 'Browse Posts', href: '/browse-posts' },
      { label: 'AI Replies', href: '/history' },
    ],
    related: [
      { label: 'Keywords', href: '/keywords' },
      { label: 'Calendar', href: '/calendar' },
    ],
  },
  '/browse-posts': {
    id: 'browse-posts',
    title: 'Browse Posts',
    outcome: 'Find high-intent conversations worth a reply, like, or follow-up today.',
    subtitle: 'Keyword and account discovery — filter fast, draft once, ship everywhere.',
    flow: ['Filter', 'Scan Feed', 'Draft Reply', 'Queue'],
    focusTabIds: ['discover', 'engage', 'monitors'],
    actions: [
      { label: 'Full Scan', primary: true },
      { label: 'Keywords', href: '/keywords' },
      { label: 'Review Drafts', href: '/history' },
    ],
    related: [
      { label: 'Engagement CRM', href: '/engagement' },
      { label: 'Auto-Rules', href: '/rules' },
    ],
  },
  '/onboarding': {
    id: 'onboarding',
    title: 'Setup Wizard',
    outcome: 'Finish brand, keywords, and connections so automation can run on day one.',
    subtitle: 'Step-by-step go-live checklist — skip nothing that blocks growth.',
    flow: ['Brand', 'Keywords', 'Integrations', 'Go Live'],
    actions: [
      { label: 'Integrations', href: '/integrations', primary: true },
      { label: 'Brand Voice', href: '/brand' },
    ],
    related: [
      { label: 'Keywords', href: '/keywords' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
  '/content-hub': {
    id: 'content-hub',
    title: 'Create',
    outcome: 'Draft, review, and publish content that moves people to act.',
    subtitle: 'Generate → queue → publish — one pipeline, no tab hunting.',
    flow: ['Generate', 'Review Queue', 'Publish', 'Schedule'],
    focusTabIds: ['studio', 'queue', 'compose'],
    collapseGroups: ['Advanced', 'Pipeline'],
    actions: [
      { label: 'Generate', tab: 'studio', primary: true },
      { label: 'Review Queue', tab: 'queue' },
      { label: 'Calendar', href: '/calendar' },
    ],
    related: [
      { label: 'Library', href: '/content-library' },
      { label: 'Design Studio', href: '/design-studio' },
    ],
  },
  '/content-library': {
    id: 'content-library',
    title: 'Library',
    outcome: 'Reuse proven assets instead of starting from a blank page every time.',
    subtitle: 'Import, organize, and pull snippets into Create and Design Studio.',
    flow: ['Import', 'Organize', 'Reuse in Create'],
    actions: [
      { label: 'Open Create', href: '/content-hub?tab=studio', primary: true },
      { label: 'Design Studio', href: '/design-studio' },
    ],
    related: [{ label: 'Brand', href: '/brand' }],
  },
  '/design-studio': {
    id: 'design-studio',
    title: 'Design Studio',
    outcome: 'Ship scroll-stopping visuals without opening another design tool.',
    subtitle: 'Templates + library assets → branded posts in minutes.',
    flow: ['Pick Template', 'Customize', 'Export to Create'],
    actions: [
      { label: 'Create Post', href: '/content-hub?tab=studio', primary: true },
      { label: 'Library', href: '/content-library' },
    ],
    related: [{ label: 'Brand', href: '/brand' }],
  },
  '/brand': {
    id: 'brand',
    title: 'Brand',
    outcome: 'Lock voice, tone, and rules so every AI draft sounds like you.',
    subtitle: 'Brand profile powers replies, posts, and automation consistency.',
    flow: ['Guidelines', 'Tone', 'Apply Everywhere'],
    actions: [
      { label: 'Setup Wizard', href: '/onboarding', primary: true },
      { label: 'AI Replies', href: '/history' },
    ],
    related: [{ label: 'Prompt Vault', href: '/prompt-vault' }],
  },
  '/calendar': {
    id: 'calendar',
    title: 'Calendar',
    outcome: 'Schedule posts for peak windows so publishing happens without you.',
    subtitle: 'Drag, drop, and confirm — see the full publishing runway.',
    flow: ['Review Queue', 'Schedule', 'Confirm Times', 'Publish'],
    actions: [
      { label: 'Create Content', href: '/content-hub?tab=studio', primary: true },
      { label: 'Scheduler', href: '/scheduler' },
    ],
    related: [{ label: 'Content Hub Queue', href: '/content-hub?tab=queue' }],
  },
  '/scheduler': {
    id: 'scheduler',
    title: 'Scheduler',
    outcome: 'Let background runs publish and process while you focus on strategy.',
    subtitle: 'Automation clock — due posts, background status, and calendar sync.',
    flow: ['Check Due', 'Process Queue', 'Verify Calendar'],
    actions: [
      { label: 'Calendar', href: '/calendar', primary: true },
      { label: 'Auto-Rules', href: '/rules' },
    ],
    related: [{ label: 'Automations', href: '/automations' }],
  },
  '/prompt-vault': {
    id: 'prompt-vault',
    title: 'Prompt Vault',
    outcome: 'Save winning prompts once — reuse them across every module.',
    subtitle: 'Searchable prompt library for Create, replies, and Imperialism Brain.',
    flow: ['Save', 'Tag', 'Inject into Workflow'],
    actions: [
      { label: 'Create with Prompt', href: '/content-hub?tab=studio', primary: true },
      { label: 'Keywords', href: '/keywords' },
    ],
    related: [{ label: 'Brand', href: '/brand' }],
  },
  '/engagement': {
    id: 'engagement',
    title: 'Engagement',
    outcome: 'Warm up relationships with targeted comments on the right profiles.',
    subtitle: 'Lists → feed → AI comment → like — CRM for social touchpoints.',
    flow: ['Build List', 'Scan Feed', 'Comment', 'Track'],
    actions: [
      { label: 'Browse Posts', href: '/browse-posts', primary: true },
      { label: 'AI Replies', href: '/history' },
    ],
    related: [{ label: 'Growth Lab', href: '/reddit-ai' }],
  },
  '/history': {
    id: 'history',
    title: 'AI Replies',
    outcome: 'Clear your approval queue — publish drafts that already match your voice.',
    subtitle: 'Pending first: review, edit, approve, export.',
    flow: ['Pending', 'Edit', 'Approve', 'Published'],
    focusTabIds: ['pending', 'published', 'archive'],
    actions: [
      { label: 'Pending Review', tab: 'pending', primary: true },
      { label: 'Browse Posts', href: '/browse-posts' },
      { label: 'Auto-Rules', href: '/rules' },
    ],
    related: [
      { label: 'Keywords', href: '/keywords' },
      { label: 'Engagement', href: '/engagement' },
    ],
  },
  '/keywords': {
    id: 'keywords',
    title: 'Keywords',
    outcome: 'Monitor topics your audience cares about before competitors show up.',
    subtitle: 'Generate, research, and wire keywords into feeds and auto-rules.',
    flow: ['Generate', 'Research', 'Monitor', 'Auto-Rule'],
    actions: [
      { label: 'Browse Posts', href: '/browse-posts', primary: true },
      { label: 'Auto-Rules', href: '/rules' },
    ],
    related: [{ label: 'SEO Tools', href: '/seo-tools' }],
  },
  '/seo-tools': {
    id: 'seo-tools',
    title: 'SEO Tools',
    outcome: 'Find low-competition opportunities you can own this week.',
    subtitle: 'KGR, Reddit topics, Quora finder — research before you create.',
    flow: ['Pick Tool', 'Run Research', 'Add Keywords', 'Create'],
    actions: [
      { label: 'Add Keywords', href: '/keywords', primary: true },
      { label: 'Quora Ops', href: '/quora-traffic' },
    ],
    related: [{ label: 'Browse Posts', href: '/browse-posts' }],
  },
  '/reddit-ai': {
    id: 'reddit-ai',
    title: 'Growth Lab',
    outcome: 'Run Reddit growth modules on autopilot with human approval gates.',
    subtitle: 'Configure modules, review queue, approve actions.',
    flow: ['Configure', 'Enable', 'Run', 'Approve'],
    actions: [
      { label: 'Leads', href: '/dashboard', primary: true },
      { label: 'Keywords', href: '/keywords' },
    ],
    related: [{ label: 'Automations', href: '/automations' }],
  },
  '/quora-traffic': {
    id: 'quora-traffic',
    title: 'Quora Ops',
    outcome: 'Answer questions that send qualified traffic to your offer.',
    subtitle: 'Discover → draft answer → publish — Quora as a growth channel.',
    flow: ['Discover', 'Draft', 'Review', 'Publish'],
    actions: [
      { label: 'SEO Research', href: '/seo-tools', primary: true },
      { label: 'Create Post', href: '/content-hub?tab=qa' },
    ],
    related: [{ label: 'Keywords', href: '/keywords' }],
  },
  '/automations': {
    id: 'automations',
    title: 'Automations',
    outcome: 'Build workflows that discover, draft, and queue while you sleep.',
    subtitle: 'Visual builder — triggers, actions, test before go-live.',
    flow: ['Design', 'Test', 'Enable', 'Monitor'],
    actions: [
      { label: 'Auto-Rules', href: '/rules', primary: true },
      { label: 'AI Replies', href: '/history' },
    ],
    related: [{ label: 'Keywords', href: '/keywords' }],
  },
  '/rules': {
    id: 'rules',
    title: 'Auto-Rules',
    outcome: 'Never miss a keyword match — auto-draft replies on your terms.',
    subtitle: 'Monitors, notifications, and rule runs in one control panel.',
    flow: ['Set Monitors', 'Tune Rules', 'Run Now', 'Review Replies'],
    actions: [
      { label: 'AI Replies', href: '/history', primary: true },
      { label: 'Keywords', href: '/keywords' },
    ],
    related: [{ label: 'Browse Posts', href: '/browse-posts' }],
  },
  '/account-hub': {
    id: 'account-hub',
    title: 'Accounts',
    outcome: 'Every platform connected, healthy, and ready to publish.',
    subtitle: 'OAuth status, proxies, groups, and automation targets.',
    flow: ['Connect', 'Verify', 'Group', 'Automate'],
    actions: [
      { label: 'Integrations', href: '/integrations', primary: true },
      { label: 'Create', href: '/content-hub?tab=studio' },
    ],
    related: [{ label: 'Acct Creator', href: '/account-creator' }],
  },
  '/campaign-manager': {
    id: 'campaign-manager',
    title: 'Campaign Command',
    outcome: 'Manage campaigns, schedules, verified nodes, and kill-switch controls in one place.',
    subtitle: 'Campaigns tab for brand ops — Verified Nodes tab for 15-platform proof tree.',
    flow: ['Select Campaign', 'Edit / Pause', 'Bind Verified Nodes', 'Schedule'],
    actions: [
      { label: 'Verified Nodes', href: '/campaign-manager?tab=nodes', primary: true },
      { label: 'Calendar', href: '/calendar' },
      { label: 'Settings', href: '/settings' },
    ],
    related: [
      { label: 'Accounts', href: '/account-hub' },
      { label: 'Keywords', href: '/keywords' },
    ],
  },
  '/account-creator': {
    id: 'account-creator',
    title: 'Acct Creator',
    outcome: 'Spin up new profiles with AI kits and a publishing schedule.',
    subtitle: 'Profile kits, proxies, and browser batch status.',
    flow: ['Kit', 'Assets', 'Schedule', 'Connect'],
    actions: [
      { label: 'Accounts', href: '/account-hub', primary: true },
      { label: 'Integrations', href: '/integrations' },
    ],
    related: [{ label: 'Calendar', href: '/calendar' }],
  },
  '/support': {
    id: 'support',
    title: 'Live Support',
    outcome: 'Get unstuck fast — Imperialism Brain routes you to the right fix.',
    subtitle: 'Setup, troubleshooting, and THEE_MICHAEL approvals.',
    flow: ['Ask', 'Diagnose', 'Route', 'Resolve'],
    actions: [
      { label: 'Integrations', href: '/integrations', primary: true },
      { label: 'Settings', href: '/settings' },
    ],
    related: [{ label: 'Guardian', href: '/settings?tab=guardian-api' }],
  },
  '/dns': {
    id: 'dns',
    title: 'DNS',
    outcome: 'Point domains for tracking, landing pages, and branded links.',
    subtitle: 'Sites, records, and config — keep traffic attributable.',
    flow: ['Add Site', 'Configure', 'Verify', 'Track'],
    actions: [
      { label: 'Integrations', href: '/integrations', primary: true },
      { label: 'Settings', href: '/settings' },
    ],
    related: [{ label: 'Site Health', href: '/settings?tab=site-health' }],
  },
  '/integrations': {
    id: 'integrations',
    title: 'Integrations',
    outcome: 'Connect every API and platform so the rest of the product can run.',
    subtitle: 'Connections first — probes, email, partner API when you need them.',
    flow: ['Connect', 'Test', 'Enable Modules', 'Monitor'],
    focusTabIds: ['connections', 'probes', 'email-campaigns'],
    collapseGroups: ['Partner'],
    actions: [
      { label: 'Test Connections', primary: true },
      { label: 'Accounts', href: '/account-hub' },
      { label: 'API Keys', href: '/settings?tab=api-keys' },
    ],
    related: [{ label: 'Setup Wizard', href: '/onboarding' }],
  },
  '/dashboard/users': {
    id: 'dashboard-users',
    title: 'My Account',
    outcome: 'See your profile, organization, campaigns, and public sitemap/feed links.',
    subtitle: 'Tenant-scoped details — only your org and projects appear here.',
    flow: ['Profile', 'Campaigns', 'Sitemap', 'Feed'],
    actions: [
      { label: 'Settings', href: '/settings', primary: true },
      { label: 'Account Hub', href: '/account-hub' },
    ],
    related: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'sitemap.html', href: '/sitemap.html' },
      { label: 'feed.xml', href: '/feed.xml' },
    ],
  },
  '/dashboard/admin': {
    id: 'dashboard-admin',
    title: 'Admin Directory',
    outcome: 'Platform administrators see every user, organization, and campaign.',
    subtitle: 'Omni-access directory — filter, refresh, and audit tenant health.',
    flow: ['Summary', 'Users', 'Organizations', 'Feeds'],
    actions: [
      { label: 'My Account', href: '/dashboard/users', primary: true },
      { label: 'Issue Control', href: '/dashboard/issues' },
    ],
    related: [
      { label: 'sitemap.html', href: '/sitemap.html' },
      { label: 'feed.xml', href: '/feed.xml' },
    ],
  },
  '/dashboard/issues': {
    id: 'dashboard-issues',
    title: 'Issue Control Plane',
    outcome: 'Review, approve, and ship runtime repair tickets with THEE_MICHAEL GitOps controls.',
    subtitle: 'Web-augmented repairs — active issues, ledger history, and patch approval.',
    flow: ['Scan', 'Review', 'Edit Patch', 'Approve'],
    actions: [
      { label: 'Dashboard', href: '/dashboard', primary: true },
      { label: 'Settings', href: '/settings' },
    ],
    related: [{ label: 'Guardian', href: '/settings?tab=guardian-api' }],
  },
  '/settings': {
    id: 'settings',
    title: 'Settings',
    outcome: 'Campaign, billing, keys, and system health — configured once, stable always.',
    subtitle: 'Start with Overview — drill into keys, Guardian, or billing only when needed.',
    flow: ['Overview', 'Campaign', 'Keys', 'Health'],
    focusTabIds: ['overview', 'campaigns', 'api-keys', 'guardian-api'],
    collapseGroups: ['Advanced'],
    actions: [
      { label: 'Integrations', href: '/integrations', primary: true },
      { label: 'Guardian', tab: 'guardian-api' },
    ],
    related: [
      { label: 'Live Support', href: '/support' },
      { label: 'Billing', href: '/settings?tab=billing' },
    ],
  },
};

/** Re-export consolidated tab catalogs — see smartTabs.ts */
export { BROWSE_VIEW_TABS, HISTORY_VIEW_TABS } from '@/lib/smartTabs';

export function getPageFocus(pathname: string): PageFocusConfig | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return PAGE_FOCUS[normalized] || null;
}

export function getNavHint(href: string): string | undefined {
  return PAGE_FOCUS[href]?.outcome.split('.')[0];
}