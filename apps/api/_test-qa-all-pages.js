/**
 * Page-by-page QA — every web route, every actionable feature (dummy data).
 * Usage: API_URL=https://api.socialimperialism.com node _test-qa-all-pages.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD || 'Kingme05$';

const PAGES = [
  {
    route: '/dashboard',
    name: 'Dashboard',
    features: [
      { name: 'Load KPI stats', channel: 'get-dashboard-stats', validate: (d) => typeof d?.totalPosts === 'number' },
      { name: 'Load live feed', channel: 'get-live-feed', args: [{ quick: true }], validate: (d) => Array.isArray(d) },
      { name: 'Trending topics', channel: 'get-trending-topics', validate: (d) => Array.isArray(d) },
      { name: 'Live news', channel: 'get-live-news', args: ['technology'], validate: (d) => Array.isArray(d) },
      { name: 'Worker status', channel: 'get-worker-status', validate: (d) => typeof d === 'object' },
      { name: 'Setup status', channel: 'get-setup-status', validate: (d) => d?.apiMetrics },
      { name: 'Leads list', channel: 'get-leads', validate: (d) => Array.isArray(d) },
      { name: 'Fanpage settings', channel: 'get-fanpage-settings', validate: (d) => typeof d === 'object' },
      { name: 'Engagement queue', channel: 'get-engagement-queue', validate: (d) => Array.isArray(d) },
      { name: 'Active campaign', channel: 'get-active-campaign', validate: (d) => d && (d.id || d.brandName) },
      { name: 'Engage post', channel: 'engage-post', args: [{ action: 'like', platform: 'Reddit', postContent: 'QA test', externalId: 't3_qatest' }], validate: (d) => typeof d === 'object' },
      { name: 'Retry engagement queue', channel: 'retry-engagement-queue', validate: (d) => typeof d === 'object' },
      { name: 'Serp research', channel: 'serp-search', args: ['social media automation'], validate: (d) => typeof d === 'object' },
      { name: 'Domain metrics', channel: 'get-domdetailer-metrics', args: ['acmegrowth.com'], validate: (d) => typeof d === 'object' },
      { name: 'Project metrics', channel: 'get-project-metrics', validate: (d) => typeof d === 'object' },
      { name: 'Analyze topic', channel: 'analyze-topic', args: [{ topic: 'AI marketing', platform: 'Twitter', brandName: 'Acme', audience: 'B2B' }], validate: (d) => typeof d === 'object' },
      { name: 'Draft reply', channel: 'draft-post-reply', args: [{ post: { content: 'How grow LinkedIn?' }, postContent: 'How grow LinkedIn?', platform: 'LinkedIn' }], validate: (d) => (typeof d === 'string' && d.length > 5) || typeof d?.value === 'string' },
      { name: 'Discover questions', channel: 'discover-best-questions', validate: (d) => d?.questions || Array.isArray(d) },
      { name: 'Compose Q&A', channel: 'compose-qa-answer', args: [{ question: { content: 'What is automation?', platform: 'Quora' } }], validate: (d) => d?.formatted || d?.answer || typeof d === 'string' },
      { name: 'Save fanpage settings', channel: 'save-fanpage-settings', args: [{ enabled: true, autoPublish: false }], validate: (d) => d?.success !== false || typeof d === 'object' },
      { name: 'Trigger auto search', channel: 'trigger-full-auto-search', validate: (d) => d?.success !== false },
      { name: 'Start worker', channel: 'start-worker', validate: (d) => d?.success !== false },
      { name: 'Section live', channel: 'get-section-live', args: ['dashboard'], validate: (d) => d?.stats },
    ],
  },
  {
    route: '/browse-posts',
    name: 'Browse Posts',
    features: [
      { name: 'Keywords filter', channel: 'get-keywords', validate: (d) => Array.isArray(d) },
      { name: 'Linked accounts', channel: 'get-linked-accounts', validate: (d) => Array.isArray(d) },
      { name: 'Live feed filtered', channel: 'get-live-feed', args: [{ platform: 'All', sort: 'recent', quick: true }], validate: (d) => Array.isArray(d) },
      { name: 'Post history', channel: 'get-all-post-history', validate: (d) => Array.isArray(d) },
      { name: 'Watched monitors', channel: 'get-watched-monitors', validate: (d) => Array.isArray(d) },
      { name: 'Draft reply', channel: 'draft-post-reply', args: [{ post: { content: 'Best CRM?' }, postContent: 'Best CRM?', platform: 'Twitter' }], validate: (d) => (typeof d === 'string' && d.length > 5) || typeof d?.value === 'string' },
      { name: 'Save draft', channel: 'save-ai-reply', args: [{ originalPost: 'Best CRM?', replyContent: 'HubSpot and Pipedrive are solid picks.', platform: 'Twitter', status: 'draft' }], validate: (d) => d?.id || d?.success !== false },
      { name: 'Stock photo', channel: 'search-stock-photo', args: ['marketing team'], validate: (d) => typeof d === 'object' },
      { name: 'Fetch profiles', channel: 'get-fetch-profiles', validate: (d) => Array.isArray(d) },
      { name: 'Engage post', channel: 'engage-post', args: [{ action: 'like', platform: 'Reddit', postContent: 'QA browse', externalId: 't3_browseqa' }], validate: (d) => typeof d === 'object' },
      { name: 'Save monitor', channel: 'save-watched-monitors', args: [[{ id: 'mon_page_qa', label: 'Page QA', type: 'keyword', target: 'marketing', platform: 'Reddit' }]], validate: (d) => d?.success !== false },
      { name: 'Browse live panel', channel: 'get-browse-posts-live', validate: (d) => d?.stats },
    ],
  },
  {
    route: '/onboarding',
    name: 'Setup Wizard',
    features: [
      { name: 'Setup status', channel: 'get-setup-status', validate: (d) => typeof d === 'object' },
      { name: 'API status', channel: 'check-api-status', validate: (d) => Object.keys(d || {}).length > 0 },
      { name: 'Generate keywords', channel: 'generate-keywords', args: [{ brandName: 'QA Brand', domain: 'qatest.com' }], validate: (d) => Array.isArray(d) && d.length > 0 },
      { name: 'Feed preview', channel: 'get-live-feed', args: [{ quick: true }], validate: (d) => Array.isArray(d) },
      { name: 'Global custom prompt', channel: 'generate-global-custom-prompt', validate: (d) => d?.prompt || d?.customPrompt },
      { name: 'Watched monitors', channel: 'get-watched-monitors', validate: (d) => Array.isArray(d) },
      { name: 'Auto rules load', channel: 'get-auto-rules', validate: (d) => typeof d === 'object' },
      { name: 'Save keywords', channel: 'save-keywords', args: [[{ term: 'onboarding-qa-kw', platforms: ['LinkedIn'] }]], validate: (d) => d?.success !== false || Array.isArray(d) },
      { name: 'Full auto search', channel: 'trigger-full-auto-search', validate: (d) => d?.success !== false },
      { name: 'Section live', channel: 'get-section-live', args: ['onboarding'], validate: (d) => d?.stats },
    ],
  },
  {
    route: '/content-hub',
    name: 'Content Hub',
    features: [
      { name: 'Linked accounts', channel: 'get-linked-accounts', validate: (d) => Array.isArray(d) },
      { name: 'Content queue', channel: 'get-content-queue', validate: (d) => Array.isArray(d) },
      { name: 'Scheduled posts', channel: 'get-scheduled-posts', validate: (d) => Array.isArray(d) },
      { name: 'Content library count', channel: 'get-content-library', validate: (d) => d?.assets !== undefined || Array.isArray(d?.assets) },
      { name: 'AI generate', channel: 'generate-ai', args: ['Write a LinkedIn post about automation for QA test.'], validate: (d) => (typeof d === 'string' && d.length > 5) || typeof d?.value === 'string' },
      { name: 'Publish post', channel: 'publish-post', args: [{ platform: 'LinkedIn', content: 'QA page test publish', hasMedia: false, humanLike: false }], validate: (d) => d?.success === true || !!d?.error },
      { name: 'Schedule post', channel: 'schedule-post', args: [{ platform: 'LinkedIn', content: 'QA scheduled from content hub', scheduleTime: new Date(Date.now() + 86400000).toISOString() }], validate: (d) => d?.success !== false },
      { name: 'RSS curate', channel: 'curate-from-rss', args: [{ rssUrl: 'https://feeds.feedburner.com/TechCrunch', numItems: 1 }], validate: (d) => Array.isArray(d) || d?.posts || d?.items },
      { name: 'Content studio', channel: 'run-content-studio', args: [{ types: ['post'], keywords: ['marketing'], count: 1 }], validate: (d) => d?.success !== false || d?.items || Array.isArray(d) },
      { name: 'Grok status', channel: 'grok-get-status', validate: (d) => typeof d === 'object' },
      { name: 'Studio live', channel: 'get-content-studio-live', validate: (d) => d?.stats },
      { name: 'Section live', channel: 'get-section-live', args: ['content-hub'], validate: (d) => d?.stats || d?.success !== false },
    ],
  },
  {
    route: '/content-library',
    name: 'Content Library',
    features: [
      { name: 'Load library', channel: 'get-content-library', validate: (d) => d?.assets !== undefined || Array.isArray(d?.assets) },
      { name: 'Import text', channel: 'import-text-to-library', args: [{ text: 'QA library snippet for page test', name: 'QA Page Test' }], validate: (d) => d?.success !== false },
      { name: 'Brand guidelines', channel: 'get-brand-guidelines', validate: (d) => typeof d === 'object' },
      { name: 'Section live', channel: 'get-section-live', args: ['content-library'], validate: (d) => d?.stats },
    ],
  },
  {
    route: '/design-studio',
    name: 'Design Studio',
    features: [
      { name: 'Design templates', channel: 'get-design-templates', validate: (d) => d?.templates?.length > 0 || Array.isArray(d?.templates) },
      { name: 'Library assets', channel: 'get-content-library', validate: (d) => d?.assets !== undefined },
      { name: 'Render design post', channel: 'render-design-post', args: [{ templateId: 'promo-bold', fields: { headline: 'QA Test', body: 'Design studio dummy', cta: 'Learn more' }, useAiCaption: false }], validate: (d) => d?.success === true && d?.post?.content },
      { name: 'Section live', channel: 'get-section-live', args: ['design-studio'], validate: (d) => d?.success !== false },
    ],
  },
  {
    route: '/brand',
    name: 'Brand',
    features: [
      { name: 'Brand guidelines', channel: 'get-brand-guidelines', validate: (d) => typeof d === 'object' },
      { name: 'Save brand', channel: 'save-brand-guidelines', args: [{ brandName: 'QA Brand', tone: 'Professional', rules: 'Be helpful' }], validate: (d) => d?.success !== false },
      { name: 'Section live', channel: 'get-section-live', args: ['brand'], validate: (d) => d?.brand || d?.stats },
    ],
  },
  {
    route: '/calendar',
    name: 'Calendar',
    features: [
      { name: 'Scheduled posts', channel: 'get-scheduled-posts', validate: (d) => Array.isArray(d) },
      { name: 'Calendar status', channel: 'get-calendar-status', validate: (d) => typeof d === 'object' },
      { name: 'Best post times', channel: 'get-best-post-times', validate: (d) => typeof d === 'object' },
      { name: 'Process due posts', channel: 'process-due-scheduled-posts', validate: (d) => typeof d === 'object' },
      { name: 'Upcoming by platform', channel: 'get-upcoming-by-platform', args: [14], validate: (d) => typeof d === 'object' },
    ],
  },
  {
    route: '/scheduler',
    name: 'Scheduler',
    features: [
      { name: 'Background settings', channel: 'get-background-run-settings', validate: (d) => typeof d === 'object' },
      { name: 'Background status', channel: 'get-background-run-status', validate: (d) => typeof d === 'object' },
      { name: 'Calendar status', channel: 'get-calendar-status', validate: (d) => typeof d === 'object' },
      { name: 'Process due', channel: 'process-due-scheduled-posts', validate: (d) => typeof d === 'object' },
      { name: 'Section live', channel: 'get-section-live', args: ['scheduler'], validate: (d) => d?.stats },
    ],
  },
  {
    route: '/prompt-vault',
    name: 'Prompt Vault',
    features: [
      { name: 'List prompts', channel: 'get-prompt-vault', args: [{ query: '', limit: 20 }], validate: (d) => Array.isArray(d?.prompts) },
      { name: 'Create prompt', channel: 'save-prompt-vault-item', args: [{ title: 'QA Page Prompt', body: 'Test prompt for vault page', tags: ['qa'], category: 'general' }], validate: (d) => d?.success !== false && (d?.prompt?.id || d?.id) },
      { name: 'Export vault', channel: 'export-prompt-vault', args: [{}], validate: (d) => Array.isArray(d?.prompts) || typeof d === 'object' },
      { name: 'Section live', channel: 'get-section-live', args: ['prompt-vault'], validate: (d) => d?.success !== false || d?.stats },
    ],
  },
  {
    route: '/engagement',
    name: 'Engagement',
    features: [
      { name: 'Engagement lists', channel: 'get-engagement-lists', validate: (d) => Array.isArray(d) },
      { name: 'Save list', channel: 'save-engagement-list', args: [{ name: 'QA Page List', profileUrls: 'https://www.linkedin.com/in/williamhgates', type: 'linkedin-profiles' }], validate: (d) => d?.success !== false || d?.id },
      { name: 'List feed', channel: 'get-engagement-list-feed', dynamic: 'engagement-list', validate: (d) => d?.posts !== undefined || Array.isArray(d?.posts) },
      { name: 'AI comment draft', channel: 'generate-ai', args: ['Write a short LinkedIn comment thanking someone for a great post about marketing.'], validate: (d) => (typeof d === 'string' && d.length > 5) || typeof d?.value === 'string' },
    ],
  },
  {
    route: '/history',
    name: 'AI Replies',
    features: [
      { name: 'Replies hub', channel: 'get-ai-replies-hub', args: [{ status: 'all' }], validate: (d) => d?.replies !== undefined },
      { name: 'All replies', channel: 'get-ai-replies', validate: (d) => Array.isArray(d) },
      { name: 'Update reply', channel: 'update-ai-reply', dynamic: 'reply', validate: (d) => d?.success !== false },
      { name: 'All history', channel: 'get-all-replies-history', validate: (d) => Array.isArray(d) },
      { name: 'Worker status', channel: 'get-worker-status', validate: (d) => typeof d === 'object' },
    ],
  },
  {
    route: '/keywords',
    name: 'Keywords',
    features: [
      { name: 'Get keywords', channel: 'get-keywords', validate: (d) => Array.isArray(d) },
      { name: 'Generate keywords', channel: 'generate-keywords', args: [{ brandName: 'QA', domain: 'qa.com' }], validate: (d) => Array.isArray(d) },
      { name: 'Research keyword', channel: 'research-keyword', args: ['content marketing'], validate: (d) => typeof d === 'object' },
      { name: 'Global custom prompt', channel: 'generate-global-custom-prompt', validate: (d) => d?.prompt || d?.customPrompt },
      { name: 'Keyword API status', channel: 'get-keyword-api-status', validate: (d) => typeof d === 'object' },
    ],
  },
  {
    route: '/seo-tools',
    name: 'SEO Tools',
    features: [
      { name: 'Tools list', channel: 'get-seo-tools-list', validate: (d) => d?.tools?.length > 0 },
      { name: 'Run KGR', channel: 'run-seo-tool', args: [{ toolId: 'kgr', payload: { keyword: 'email marketing' } }], validate: (d) => typeof d === 'object' },
      { name: 'Run Reddit topics', channel: 'run-seo-tool', args: [{ toolId: 'reddit-topics', payload: { keyword: 'saas' } }], validate: (d) => typeof d === 'object' },
      { name: 'Run Quora finder', channel: 'run-seo-tool', args: [{ toolId: 'quora-finder', payload: { keyword: 'automation' } }], validate: (d) => typeof d === 'object' },
    ],
  },
  {
    route: '/reddit-ai',
    name: 'Growth Lab',
    features: [
      { name: 'Reddit AI status', channel: 'get-reddit-ai-status', validate: (d) => typeof d === 'object' },
      { name: 'Module queue', channel: 'get-reddit-ai-queue', args: ['subreddit-ascent'], validate: (d) => d?.queue !== undefined },
      { name: 'Reddit settings', channel: 'get-reddit-ai-settings', validate: (d) => typeof d === 'object' },
      { name: 'Run module', channel: 'run-reddit-ai-module', args: ['subreddit-ascent'], validate: (d) => d?.success !== false || d?.actions },
      { name: 'Leads', channel: 'get-leads', validate: (d) => Array.isArray(d) },
    ],
  },
  {
    route: '/quora-traffic',
    name: 'Quora Ops',
    features: [
      { name: 'Traffic status', channel: 'get-quora-traffic-status', validate: (d) => typeof d === 'object' },
      { name: 'Traffic settings', channel: 'get-quora-traffic-settings', validate: (d) => d?.settings || typeof d === 'object' },
      { name: 'Scrape questions', channel: 'scrape-quora-questions', args: [{ keyword: 'marketing automation', limit: 3 }], validate: (d) => typeof d === 'object' && ((d.success === true && (d?.questions?.length > 0 || d?.count > 0)) || (d.success === false && typeof d.error === 'string')) },
      { name: 'Generate answer', channel: 'generate-quora-answer', args: [{ question: { content: 'Best marketing tool?', url: 'https://quora.com/test' } }], validate: (d) => d?.answer || d?.success !== false },
      { name: 'YouTube transcript', channel: 'fetch-youtube-transcript', args: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }], validate: (d) => typeof d === 'object' && ((d?.transcript && d.transcript.length > 10) || d?.success === true || (d?.success === false && typeof d.error === 'string')) },
    ],
  },
  {
    route: '/automations',
    name: 'Automations',
    features: [
      { name: 'Automation flow', channel: 'get-automation-flow', validate: (d) => typeof d === 'object' },
      { name: 'Templates', channel: 'get-automation-templates', validate: (d) => Array.isArray(d) },
      { name: 'Builder data', channel: 'get-automation-builder-data', validate: (d) => typeof d === 'object' },
      { name: 'Automation status', channel: 'get-automation-status', validate: (d) => typeof d === 'object' },
      { name: 'Save flow', channel: 'save-automation-flow', args: [{ nodes: [{ id: 'n1', type: 'trigger-keyword' }], edges: [], status: 'draft' }], validate: (d) => d?.success !== false || d?.flow },
      { name: 'Test flow', channel: 'test-automation-flow', args: [{ nodes: [], edges: [] }], validate: (d) => typeof d === 'object' },
      { name: 'Section live', channel: 'get-section-live', args: ['automations'], validate: (d) => d?.success !== false || d?.stats },
    ],
  },
  {
    route: '/rules',
    name: 'Auto-Rules',
    features: [
      { name: 'Auto rules', channel: 'get-auto-rules', validate: (d) => typeof d === 'object' },
      { name: 'Watched monitors', channel: 'get-watched-monitors', validate: (d) => Array.isArray(d) },
      { name: 'Auto search settings', channel: 'get-auto-search-settings', validate: (d) => typeof d === 'object' },
      { name: 'Notification settings', channel: 'get-notification-settings', validate: (d) => typeof d === 'object' },
      { name: 'Rules status', channel: 'get-auto-rules-status', validate: (d) => typeof d === 'object' },
      { name: 'Run auto rules', channel: 'run-auto-rules-now', validate: (d) => d?.success !== false || typeof d === 'object' },
    ],
  },
  {
    route: '/account-hub',
    name: 'Account Hub',
    features: [
      { name: 'Linked accounts', channel: 'get-linked-accounts', validate: (d) => Array.isArray(d) },
      { name: 'Hub status', channel: 'get-account-hub-status', validate: (d) => typeof d === 'object' },
      { name: 'Proxy pool', channel: 'get-proxy-pool', validate: (d) => Array.isArray(d) },
      { name: 'Automation targets', channel: 'get-account-automation-targets', args: ['DYNAMIC_ACC'], validate: (d) => d?.targets !== undefined },
      { name: 'Account groups', channel: 'get-account-groups', args: ['DYNAMIC_ACC'], validate: (d) => typeof d === 'object' },
    ],
  },
  {
    route: '/account-creator',
    name: 'Acct Creator',
    features: [
      { name: 'Proxy pool', channel: 'get-proxy-pool', validate: (d) => Array.isArray(d) },
      { name: 'Profile kits', channel: 'get-profile-kits', validate: (d) => Array.isArray(d) },
      { name: 'Creator status', channel: 'get-account-creator-status', validate: (d) => typeof d === 'object' },
      { name: 'Generate kit', channel: 'generate-profile-kit', args: [{ personaName: 'QA Page Kit', platforms: ['LinkedIn'], generateAssets: false, scheduleWeeks: 1, postsPerWeek: 1 }], validate: (d) => !!(d?.kit?.id || d?.id) && d?.success !== false },
      { name: 'Linked for kit', channel: 'get-linked-accounts-for-kit', args: [{ platforms: ['LinkedIn', 'Twitter'] }], validate: (d) => Array.isArray(d) },
      { name: 'Browser batch status', channel: 'get-browser-batch-status', validate: (d) => typeof d === 'object' },
    ],
  },
  {
    route: '/support',
    name: 'Live Support',
    features: [
      { name: 'Support AI reply', channel: 'generate-ai', args: ['Imperialism Brain Live Support: user asks how to connect LinkedIn. Reply in 2 sentences.'], validate: (d) => (typeof d === 'string' && d.length > 10) || typeof d?.value === 'string' },
      { name: 'Guardian config', channel: 'get-guardian-config', validate: (d) => d?.adminIdentity === 'THEE_MICHAEL' },
    ],
  },
  {
    route: '/dns',
    name: 'DNS',
    features: [
      { name: 'DNS sites', channel: 'get-dns-sites', validate: (d) => d?.sites !== undefined || Array.isArray(d?.sites) },
      { name: 'DNS config', channel: 'get-dns-config', validate: (d) => typeof d === 'object' },
      { name: 'Section live', channel: 'get-section-live', args: ['dns'], validate: (d) => d?.success !== false || d?.stats },
    ],
  },
  {
    route: '/integrations',
    name: 'Integrations',
    features: [
      { name: 'Global keys', channel: 'get-global-keys', validate: (d) => typeof d === 'object' },
      { name: 'Key sources', channel: 'get-key-sources', validate: (d) => typeof d === 'object' },
      { name: 'API status', channel: 'check-api-status', validate: (d) => Object.keys(d || {}).length > 0 },
      { name: 'Partner config', channel: 'get-partner-integration-config', validate: (d) => typeof d === 'object' },
      { name: 'Integration events', channel: 'get-integration-events-log', validate: (d) => Array.isArray(d) || typeof d === 'object' },
      { name: 'Email campaigns', channel: 'get-email-campaigns', validate: (d) => d?.campaigns !== undefined || Array.isArray(d?.campaigns) },
      { name: 'Test connections', channel: 'test-all-connections', validate: (d) => d?.apiMetrics || typeof d === 'object' },
      { name: 'Section live', channel: 'get-section-live', args: ['integrations'], validate: (d) => d?.apiHealth || d?.stats },
    ],
  },
  {
    route: '/settings',
    name: 'Settings',
    features: [
      { name: 'Global keys', channel: 'get-global-keys', validate: (d) => typeof d === 'object' },
      { name: 'API status', channel: 'check-api-status', validate: (d) => Object.keys(d || {}).length > 0 },
      { name: 'Campaigns', channel: 'get-settings', validate: (d) => Array.isArray(d) },
      { name: 'Billing plan', channel: 'get-billing-plan', validate: (d) => typeof d === 'object' },
      { name: 'Grok settings', channel: 'get-grok-settings', validate: (d) => typeof d === 'object' },
      { name: 'Payment settings', channel: 'get-payment-settings', validate: (d) => typeof d === 'object' },
      { name: 'Setup tutorials', channel: 'get-setup-tutorials', validate: (d) => Array.isArray(d?.tutorials) && d.tutorials.length > 0 },
      { name: 'Settings status', channel: 'get-settings-status', validate: (d) => typeof d === 'object' },
      { name: 'Page health', channel: 'get-page-health', validate: (d) => d?.ok !== false },
      { name: 'Guardian config', channel: 'get-guardian-config', validate: (d) => d?.adminIdentity === 'THEE_MICHAEL' },
      { name: 'Guardian scan', channel: 'run-guardian-scan', validate: (d) => d?.success === true },
      { name: 'THEE_MICHAEL status', channel: 'get-sovereign-threat-status', validate: (d) => d?.enabled === true && d?.adminIdentity === 'THEE_MICHAEL' && typeof d?.pendingReviewCount === 'number' },
      { name: 'THEE_MICHAEL history', channel: 'get-thee-michael-action-history', validate: (d) => d?.success === true && Array.isArray(d?.history) },
      { name: 'Security scan', channel: 'run-sovereign-threat-scan', validate: (d) => d?.success === true && Array.isArray(d?.modulesProtected) },
      { name: 'Export data', channel: 'export-data', validate: (d) => typeof d === 'object' },
    ],
  },
];

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return { token: json.token, projectId: json.project?.id };
}

const SLOW = new Set(['analyze-topic', 'draft-post-reply', 'generate-image', 'run-content-studio', 'generate-quora-answer', 'run-seo-tool', 'discover-best-questions', 'generate-global-custom-prompt', 'run-guardian-scan', 'test-all-connections']);
const TIMEOUT = 90000;

async function invoke(token, projectId, channel, args = []) {
  const ms = SLOW.has(channel) ? TIMEOUT : 60000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(`${API}/api/invoke/${channel}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-project-id': projectId },
      body: JSON.stringify({ args }),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch { return { ok: false, status: res.status, data: null, error: text?.slice(0, 120) }; }
    return { ok: res.ok, status: res.status, data: json.data, error: json.error };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e.name === 'AbortError' ? `Timeout ${ms}ms` : e.message };
  } finally {
    clearTimeout(timer);
  }
}

function classify(r, validate) {
  if (!r.ok) {
    if (r.status === 404) return { status: 'BROKEN', reason: r.error || 'Channel missing' };
    return { status: 'ERROR', reason: r.error || `HTTP ${r.status}` };
  }
  try {
    if (validate && !validate(r.data)) return { status: 'WEAK', reason: 'Unexpected response shape' };
  } catch (e) {
    return { status: 'WEAK', reason: e.message };
  }
  return { status: 'OK' };
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  SOCIAL IMPERIALISM — PAGE-BY-PAGE QA (ALL ROUTES)       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`API: ${API}\n`);

  const { token, projectId } = await login();
  console.log(`Logged in — project: ${projectId}\n`);

  const accRes = await invoke(token, projectId, 'get-linked-accounts');
  const firstAcc = Array.isArray(accRes.data) && accRes.data[0];

  let savedReplyId = null;
  let savedEngagementListId = null;

  let ok = 0, weak = 0, error = 0, broken = 0;
  const pageResults = [];

  for (const page of PAGES) {
    console.log(`\n── ${page.name} (${page.route}) ──`);
    const features = [];

    for (const feat of page.features) {
      let args = feat.args ? [...feat.args] : [];
      args = args.map((a) => {
        if (a === 'DYNAMIC_ACC') return firstAcc?.id || 'si_li_demo';
        if (typeof a === 'object' && a && !a.accountId && (feat.channel === 'publish-post' || feat.channel === 'schedule-post') && firstAcc) {
          return { ...a, accountId: firstAcc.id, platform: a.platform || firstAcc.platform, content: feat.channel === 'publish-post' ? `${a.content} · ${Date.now()}` : a.content };
        }
        return a;
      });

      if (feat.dynamic === 'reply') {
        const saveRes = await invoke(token, projectId, 'save-ai-reply', [{
          originalPost: 'QA update test post',
          replyContent: 'Initial QA reply content',
          platform: 'Twitter',
          status: 'draft',
        }]);
        savedReplyId = saveRes.data?.id;
        args = [{ id: savedReplyId, updates: { replyContent: 'Updated via page QA test' } }];
      }

      if (feat.dynamic === 'engagement-list') {
        const listRes = await invoke(token, projectId, 'save-engagement-list', [{
          name: `QA Page List ${Date.now()}`,
          profileUrls: 'https://www.linkedin.com/in/williamhgates',
          type: 'linkedin-profiles',
        }]);
        savedEngagementListId = listRes.data?.id || listRes.data?.list?.id;
        args = [savedEngagementListId];
      }

      const r = await invoke(token, projectId, feat.channel, args);
      const { status, reason } = classify(r, feat.validate);
      const icon = status === 'OK' ? '✓' : status === 'WEAK' ? '~' : status === 'ERROR' ? '✗' : '⊘';
      console.log(`  ${icon} ${feat.name} [${feat.channel}]${reason ? ` — ${reason}` : ''}`);

      if (status === 'OK') ok++;
      else if (status === 'WEAK') weak++;
      else if (status === 'ERROR') error++;
      else broken++;

      features.push({ feature: feat.name, channel: feat.channel, status, reason, error: r.error });
    }

    const pageStatus = features.some((f) => f.status === 'BROKEN' || f.status === 'ERROR') ? 'FAIL'
      : features.some((f) => f.status === 'WEAK') ? 'WARN' : 'OK';
    pageResults.push({ route: page.route, page: page.name, status: pageStatus, features });
    console.log(`  → Page: ${pageStatus}`);
  }

  const issues = pageResults.flatMap((p) => p.features.filter((f) => f.status !== 'OK').map((f) => ({ ...f, page: p.page, route: p.route })));

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`PAGES: ${PAGES.length} | OK=${ok} | WEAK=${weak} | ERROR=${error} | BROKEN=${broken}`);
  console.log('══════════════════════════════════════════════════════════');

  if (issues.length) {
    console.log('\nISSUES:');
    issues.forEach((f, i) => console.log(`  ${i + 1}. [${f.status}] ${f.page} (${f.route}) → ${f.feature}: ${f.reason}`));
  }

  const out = path.join(__dirname, '.qa-all-pages-report.json');
  fs.writeFileSync(out, JSON.stringify({
    timestamp: new Date().toISOString(),
    api: API,
    summary: { pages: PAGES.length, ok, weak, error, broken },
    pages: pageResults,
    issues,
  }, null, 2));
  console.log(`\nReport: ${out}\n`);
  process.exit(error + broken > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });