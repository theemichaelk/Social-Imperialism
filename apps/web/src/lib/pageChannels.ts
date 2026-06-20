/** Desktop IPC channels per page — used for parity checks and feature panels */
export const PAGE_CHANNELS = {
  dashboard: [
    'get-dashboard-stats', 'get-live-feed', 'get-trending-topics', 'get-live-news', 'get-setup-status',
    'get-domain-metrics', 'get-domdetailer-metrics', 'get-project-metrics', 'analyze-topic',
    'discover-best-questions', 'get-unanswered-questions', 'get-qa-settings', 'get-qa-sources',
    'compose-qa-answer', 'publish-qa-answer', 'get-leads', 'scan-reddit-now', 'get-watched-monitors',
    'get-worker-status', 'get-worker-tasks', 'start-worker', 'stop-worker', 'trigger-full-auto-search',
    'get-fanpage-settings', 'get-fanpage-metrics', 'save-fanpage-settings', 'run-fan-acquisition-now',
    'run-fanpage-hands-free-now', 'engage-post', 'draft-post-reply', 'save-ai-reply', 'export-data',
    'curate-from-rss', 'search-stock-photo', 'generate-image', 'schedule-post', 'publish-post',
  ],
  contentHub: [
    'publish-post', 'schedule-post', 'generate-ai', 'generate-image', 'search-stock-photo',
    'curate-from-rss', 'run-content-studio', 'generate-content-batch', 'get-content-studio-config',
    'generate-viral-thumbnail', 'generate-viral-thumbnail-batch', 'get-thumbnail-studio-config',
    'grok-ask-text', 'grok-imagine', 'grok-generate-infographic', 'grok-get-status',
    'compose-qa-answer', 'publish-qa-answer', 'get-content-queue', 'remove-content-queue-item',
    'get-auto-content-settings', 'save-auto-content-settings', 'run-content-scheduler-now',
    'discover-site-rss', 'get-site-rss-sources', 'save-site-rss-source', 'run-category-rss-router',
    'get-ai-replies', 'publish-ai-reply', 'update-ai-reply', 'delete-ai-reply',
    'serp-search', 'shorten-url', 'deepl-translate', 'play-tts', 'contentful-fetch',
    'get-streaming-keys', 'get-youtube-channels', 'generate-carousel-fal', 'research-keyword',
    'run-auto-rules-now', 'get-post-history', 'get-dashboard-stats',
  ],
  accountCreator: [
    'get-proxy-pool', 'save-proxy', 'delete-proxy', 'test-proxy', 'get-profile-kits',
    'generate-profile-kit', 'generate-bulk-profile-kits', 'delete-profile-kit', 'export-profile-kit',
    'push-kit-schedule-to-calendar', 'apply-kit-browser-automation', 'upload-kit-to-linked-accounts',
    'schedule-browser-batch', 'get-browser-batch-status', 'run-browser-batch-now', 'cancel-browser-batch',
  ],
} as const;