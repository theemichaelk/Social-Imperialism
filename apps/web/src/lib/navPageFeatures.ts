/**
 * Sidebar feature guide — what each module page does (user-facing, not API channels).
 */
import { NAV_SECTIONS } from '@/lib/nav';

export type NavPageFeatureGuide = {
  summary: string;
  features: string[];
};

export const NAV_PAGE_FEATURES: Record<string, NavPageFeatureGuide> = {
  '/dashboard': {
    summary: 'Real-time mission control — pulse, feed, worker, and act now.',
    features: [
      'KPI rings: posts, engagement, APIs, worker health',
      'Live feed with quick or full scan',
      'Trending topics and live news panels',
      'Draft replies, engage posts, queue actions',
      'Leads, fanpage settings, project metrics',
      'Trigger auto-search and start background worker',
      'Serp research, topic analysis, Q&A compose',
    ],
  },
  '/browse-posts': {
    summary: 'Discover conversations worth a reply today.',
    features: [
      'Filter by keyword, platform, and sort order',
      'Live feed from connected APIs and monitors',
      'Be-First monitors — watch keywords and accounts',
      'AI draft reply, save to approval queue',
      'Like, engage, and stock photo lookup',
      'Post history and fetch profiles',
    ],
  },
  '/onboarding': {
    summary: 'Go-live checklist — brand to automation in five steps.',
    features: [
      'Brand profile research and save',
      'API connections with live probes',
      'AI keyword suggestions and platform pick',
      'Feed preview and full discovery scan',
      'Global reply voice and Be-First monitors',
      'Imperialism Brain intelligent setup guide',
    ],
  },
  '/content-hub': {
    summary: 'Generate, queue, publish, and schedule in one pipeline.',
    features: [
      'AI Studio — posts, threads, captions',
      'Review queue before anything goes live',
      'Compose & publish to linked accounts',
      'Media tab — Grok clips and library assets',
      'RSS curate and content studio batch',
      'Imperial content pipeline (18-step)',
      'Thumbnail studio and URL shortener',
    ],
  },
  '/content-library': {
    summary: 'Reuse copy, images, and imports across Create.',
    features: [
      'Save and tag text, image, and copy assets',
      'Import text snippets and RSS feeds',
      'Brand guidelines context for reuse',
      'Pull assets into Create and Design Studio',
      'Grok-assisted asset workflows',
    ],
  },
  '/design-studio': {
    summary: 'Templates and compositor — scroll-stopping visuals.',
    features: [
      'Template gallery with AI captions',
      '9:16 / 1:1 / 16:9 social layouts',
      'Library asset compose and Atelier layouts',
      'PII safety scan before export',
      'Export rendered posts to Create queue',
    ],
  },
  '/video-studio': {
    summary: '12 agentic video pipelines with approval gates.',
    features: [
      'Reference URL analysis — pacing and concepts',
      'Pick pipeline (explainer, promo, avatar, etc.)',
      'Run full AI pipeline or quick preview board',
      '7-stage production board with approval gates',
      'Queue composition → Create Media → publish',
      '52 tools · 620+ agent skills',
    ],
  },
  '/brand': {
    summary: 'Voice, tone, and rules for every AI draft.',
    features: [
      'Brand name, domain, description, audience',
      'Tone, disallowed topics, sample messages',
      'Seed profile from website URL',
      'Powers replies, Create, and automation',
      'Sync with active campaign',
    ],
  },
  '/calendar': {
    summary: 'Publishing runway — drag, schedule, confirm.',
    features: [
      'Month/week view of scheduled posts',
      'Best post times by platform',
      'Upcoming posts breakdown',
      'Process due posts on demand',
      'Calendar settings and linked accounts',
    ],
  },
  '/scheduler': {
    summary: 'Background clock for due posts and auto-runs.',
    features: [
      'Background run enable and frequency',
      'Process due scheduled posts',
      'Calendar sync status',
      'View all scheduled queue items',
    ],
  },
  '/prompt-vault': {
    summary: 'Saved prompts — inject anywhere in the stack.',
    features: [
      'Create, tag, and search prompt library',
      'Categories: content, SEO, Grok, support, video',
      'Export vault and create from keyword',
      'Inject into Create, replies, Imperialism Brain',
    ],
  },
  '/engagement': {
    summary: 'CRM for warming profiles with AI comments.',
    features: [
      'Build LinkedIn/profile URL lists',
      'Scan list feed for recent posts',
      'AI comment drafts and like actions',
      'Track touchpoints per profile',
    ],
  },
  '/history': {
    summary: 'Approve AI reply drafts before they ship.',
    features: [
      'Pending queue — review and edit first',
      'Approve, reject, or archive replies',
      'Published and full history tabs',
      'Worker status for auto-draft pipeline',
    ],
  },
  '/keywords': {
    summary: 'Monitor topics that drive discovery and rules.',
    features: [
      'AI generate keywords from brand',
      'Research keyword volume and intent',
      'Per-platform tracking toggles',
      'Global custom prompt for all replies',
      'Wire into Browse Posts and Auto-Rules',
    ],
  },
  '/seo-tools': {
    summary: 'Research wins before you create content.',
    features: [
      'KGR — keyword golden ratio checker',
      'Reddit topic discovery',
      'Quora question finder',
      'Keyword grouping and clustering',
      'Push findings into Keywords module',
    ],
  },
  '/reddit-ai': {
    summary: 'Reddit growth modules with approval gates.',
    features: [
      'Subreddit Ascent and module queue',
      'Enable/disable modules per campaign',
      'Run modules and review action queue',
      'Leads integration from Reddit signals',
      'Module settings persistence',
    ],
  },
  '/quora-traffic': {
    summary: 'Quora answers that send qualified traffic.',
    features: [
      'Scrape questions by keyword',
      'AI generate authoritative answers',
      'Traffic status and settings',
      'YouTube transcript for repurposing',
      'Publish via Create Q&A tab',
    ],
  },
  '/automations': {
    summary: 'Visual workflows — triggers to actions.',
    features: [
      'Drag-and-drop automation canvas',
      'Templates and builder data',
      'Test flow before enabling',
      'Keyword triggers, AI splits, publish nodes',
      'Automation status monitoring',
    ],
  },
  '/rules': {
    summary: 'Keyword monitors that auto-draft replies.',
    features: [
      'Be-First and auto-search monitors',
      'Notification and frequency settings',
      'Run rules now (quick or full)',
      'Rules status and match history',
      'Feeds AI Replies approval queue',
    ],
  },
  '/account-hub': {
    summary: 'Every platform connected and healthy.',
    features: [
      'OAuth and API-linked accounts',
      'Connection health and last sync',
      'Proxy pool assignment',
      'Account groups and automation targets',
      'Per-platform connection details',
    ],
  },
  '/account-creator': {
    summary: 'Spin up new profiles with AI kits.',
    features: [
      'Generate persona profile kits',
      'Schedule weeks of starter posts',
      'Proxy pool and browser batch status',
      'Link kits to platform accounts',
    ],
  },
  '/dashboard/users': {
    summary: 'Your profile, org, campaigns, and public feeds.',
    features: [
      'User profile and organization',
      'Active campaigns list',
      'Billing plan summary',
      'Public sitemap and RSS feed links',
    ],
  },
  '/dashboard/admin': {
    summary: 'Platform admin — all users and orgs (admin only).',
    features: [
      'User and organization directory',
      'Campaign audit across tenants',
      'Platform-wide feed and sitemap links',
      'Refresh and filter tenant health',
    ],
  },
  '/dashboard/issues': {
    summary: 'Issue control plane — GitOps repairs (admin only).',
    features: [
      'Scan for active runtime issues',
      'Review and edit repair patches',
      'Approve and ship fixes',
      'THEE_MICHAEL ledger history',
    ],
  },
  '/campaign-manager': {
    summary: 'Campaigns, schedules, and verified nodes.',
    features: [
      'Create, pause, and edit campaigns',
      'Campaign details and brand binding',
      'Verified Nodes — 15-platform proof tree',
      'Schedule binding and kill-switch',
    ],
  },
  '/support': {
    summary: 'Imperialism Brain live support and routing.',
    features: [
      'Ask setup, SEO, or navigation questions',
      'Auto-route to the right module',
      'Campaign Mastery A→Z walkthrough',
      'Admin approval tickets when required',
      'Ingest files and cognitive trace',
    ],
  },
  '/dns': {
    summary: 'Domain routing for tracking and landing pages.',
    features: [
      'Add and manage DNS sites',
      'Record configuration',
      'Verify domain propagation',
      'Attribution for campaigns',
    ],
  },
  '/integrations': {
    summary: 'Connect every API and OAuth platform.',
    features: [
      '26+ platform OAuth and API keys',
      'Live connection probes',
      'Email campaign integrations',
      'Partner API and event log',
      'Test all connections at once',
    ],
  },
  '/settings': {
    summary: 'Campaign, billing, keys, and system health.',
    features: [
      'Overview and active campaign',
      'API keys and key sources',
      'Guardian / THEE_MICHAEL security',
      'Billing and subscription',
      'Site health and background runs',
    ],
  },
};

export function getNavPageFeatures(href: string): NavPageFeatureGuide | null {
  return NAV_PAGE_FEATURES[href] || null;
}

/** Flat list of all modules with features — for search */
export function allNavFeatureEntries() {
  return NAV_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      section: section.label,
      ...item,
      guide: NAV_PAGE_FEATURES[item.href] || null,
    })),
  );
}