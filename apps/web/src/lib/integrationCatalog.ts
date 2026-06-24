export type IntegrationField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'password' | 'text' | 'email' | 'url' | 'textarea';
  hint?: string;
  metric?: string;
};

export type IntegrationGroup = {
  id: string;
  title: string;
  icon: string;
  color: string;
  fields: IntegrationField[];
};

export const INTEGRATION_GROUPS: IntegrationGroup[] = [
  {
    id: 'ai',
    title: 'AI Engine',
    icon: '🧠',
    color: '#38bdf8',
    fields: [
      { key: 'gemini', label: 'Google Gemini API Key', placeholder: 'AIzaSy...', type: 'password', metric: 'Gemini AI' },
      { key: 'openai', label: 'OpenAI API Key (optional)', placeholder: 'sk-...', type: 'password' },
      { key: 'openrouter', label: 'OpenRouter API Key', placeholder: 'sk-or-...', type: 'password', metric: 'OpenRouter', hint: '100+ models through one key' },
      { key: 'advancedWorkflowKey', label: 'Advanced AI Workflow Key', placeholder: 'Workflow key', type: 'password', metric: 'AI Workflows' },
      { key: 'falKey', label: 'FAL AI Key (image gen)', placeholder: 'FAL key', type: 'password', metric: 'FAL' },
      { key: 'contentStudioApiKey', label: 'ContentStudio API Key', placeholder: 'ContentStudio key', type: 'password', metric: 'Content Studio' },
    ],
  },
  {
    id: 'social',
    title: 'Social OAuth & Tokens',
    icon: '🌐',
    color: '#34d399',
    fields: [
      { key: 'linkedinAccessToken', label: 'LinkedIn Access Token', type: 'password', metric: 'LinkedIn' },
      { key: 'twId', label: 'Twitter / X Client ID', type: 'text', metric: 'Twitter / X' },
      { key: 'twSecret', label: 'Twitter / X Client Secret', type: 'password', metric: 'Twitter / X' },
      { key: 'twBearer', label: 'Twitter Bearer Token', type: 'password', metric: 'Twitter / X' },
      { key: 'twAccess', label: 'Twitter Access Token', type: 'password', metric: 'Twitter / X' },
      { key: 'twAccessSecret', label: 'Twitter Access Secret', type: 'password', metric: 'Twitter / X' },
      { key: 'rdId', label: 'Reddit Client ID', type: 'text', metric: 'Reddit OAuth' },
      { key: 'rdSecret', label: 'Reddit Client Secret', type: 'password', metric: 'Reddit OAuth' },
      { key: 'fbId', label: 'Meta App ID', type: 'text', metric: 'Meta / Facebook' },
      { key: 'fbSecret', label: 'Meta App Secret', type: 'password', metric: 'Meta / Facebook' },
      { key: 'metaAccess', label: 'Meta Access Token', type: 'password', metric: 'Meta / Facebook' },
      { key: 'ytId', label: 'YouTube Client ID', type: 'text', metric: 'YouTube' },
      { key: 'ytSecret', label: 'YouTube Client Secret', type: 'password', metric: 'YouTube' },
      { key: 'youtubeApiKey', label: 'YouTube API Key', type: 'password', metric: 'YouTube' },
      { key: 'tkId', label: 'TikTok Client Key', type: 'text', metric: 'TikTok' },
      { key: 'tkSecret', label: 'TikTok Client Secret', type: 'password', metric: 'TikTok' },
      { key: 'pinterestAppId', label: 'Pinterest App ID', type: 'text' },
      { key: 'pinterestSecret', label: 'Pinterest App Secret', type: 'password' },
      { key: 'snapchatClientId', label: 'Snapchat Client ID', type: 'text' },
      { key: 'snapchatClientSecret', label: 'Snapchat Client Secret', type: 'password' },
      { key: 'discordClientId', label: 'Discord Client ID', type: 'text', metric: 'Discord' },
      { key: 'discordBotToken', label: 'Discord Bot Token', type: 'password', metric: 'Discord' },
      { key: 'telegramBotToken', label: 'Telegram Bot Token', type: 'password' },
      { key: 'whatsappPhoneNumberId', label: 'WhatsApp Phone Number ID', type: 'text' },
      { key: 'whatsappAccessToken', label: 'WhatsApp Access Token', type: 'password' },
      { key: 'twitchClientId', label: 'Twitch Client ID', type: 'text', metric: 'Twitch' },
      { key: 'twitchClientSecret', label: 'Twitch Client Secret', type: 'password', metric: 'Twitch' },
      { key: 'twitchStreamKey', label: 'Twitch Stream Key', type: 'password', metric: 'Twitch' },
    ],
  },
  {
    id: 'data',
    title: 'Data & Research',
    icon: '📊',
    color: '#f59e0b',
    fields: [
      { key: 'newsApiKey', label: 'NewsAPI Key', type: 'password', metric: 'NewsAPI' },
      { key: 'serpApiKey', label: 'SerpAPI Key', type: 'password', metric: 'SerpAPI' },
      { key: 'domDetailer', label: 'DomDetailer API Key', type: 'password', metric: 'DomDetailer' },
      { key: 'mozAccessId', label: 'MOZ Access ID', type: 'text', metric: 'MOZ' },
      { key: 'mozSecret', label: 'MOZ Secret', type: 'password', metric: 'MOZ' },
      { key: 'deeplKey', label: 'DeepL API Key', type: 'password', metric: 'DeepL' },
      { key: 'tinyurlApiKey', label: 'TinyURL API Key', type: 'password', metric: 'TinyURL' },
    ],
  },
  {
    id: 'media',
    title: 'Stock Media & CMS',
    icon: '📸',
    color: '#a855f7',
    fields: [
      { key: 'unsplashAccessKey', label: 'Unsplash Access Key', type: 'password', metric: 'Unsplash' },
      { key: 'unsplashAppId', label: 'Unsplash Application ID', type: 'text' },
      { key: 'pexelsKey', label: 'Pexels API Key', type: 'password', metric: 'Stock Media' },
      { key: 'pixabayKey', label: 'Pixabay API Key', type: 'password', metric: 'Stock Media' },
      { key: 'flickrKey', label: 'Flickr API Key', type: 'password', metric: 'Stock Media' },
      { key: 'flickrSecret', label: 'Flickr Secret', type: 'password', metric: 'Stock Media' },
      { key: 'contentfulSpaceId', label: 'Contentful Space ID', type: 'text', metric: 'Contentful' },
      { key: 'contentfulAccessToken', label: 'Contentful Access Token', type: 'password', metric: 'Contentful' },
      { key: 'playhtUserId', label: 'Play.ht User ID', type: 'text', metric: 'PlayHT' },
      { key: 'playhtSecretKey', label: 'Play.ht Secret Key', type: 'password', metric: 'PlayHT' },
    ],
  },
  {
    id: 'email',
    title: 'Email Marketing & SMTP',
    icon: '📧',
    color: '#22d3ee',
    fields: [
      { key: 'vboutApiKey', label: 'VBout API Key', type: 'password', metric: 'VBout' },
      { key: 'mailchimpApiKey', label: 'MailChimp API Key', type: 'password', metric: 'MailChimp', hint: 'Format: key-dc (e.g. …-us3)' },
      { key: 'smtpHost', label: 'Amazon SES SMTP Host', type: 'text', metric: 'Amazon SES', placeholder: 'email-smtp.us-east-1.amazonaws.com' },
      { key: 'smtpPort', label: 'SMTP Port', type: 'text', metric: 'Amazon SES', placeholder: '587' },
      { key: 'smtpUser', label: 'SMTP Username', type: 'password', metric: 'Amazon SES' },
      { key: 'smtpPass', label: 'SMTP Password', type: 'password', metric: 'Amazon SES' },
      { key: 'smtpFrom', label: 'From Email (SES verified)', type: 'email', metric: 'Amazon SES' },
      { key: 'smtpFromName', label: 'From Name', type: 'text', placeholder: 'Social Imperialism' },
      { key: 'acumbamailHost', label: 'Acumbamail SMTP Server', type: 'text', metric: 'Acumbamail', placeholder: 'smtp.acumbamail.com' },
      { key: 'acumbamailPort', label: 'Acumbamail SMTP Port', type: 'text', metric: 'Acumbamail', placeholder: '587' },
      { key: 'acumbamailUser', label: 'Acumbamail Username', type: 'email', metric: 'Acumbamail' },
      { key: 'acumbamailPass', label: 'Acumbamail Password / Auth Token', type: 'password', metric: 'Acumbamail' },
      { key: 'acumbamailFrom', label: 'Acumbamail From Email', type: 'email', metric: 'Acumbamail' },
    ],
  },
  {
    id: 'notify',
    title: 'Notifications & Streaming',
    icon: '🔔',
    color: '#f472b6',
    fields: [
      { key: 'slackWebhook', label: 'Slack Webhook URL', type: 'url' },
      { key: 'discordWebhook', label: 'Discord Webhook URL', type: 'url' },
      { key: 'alertEmail', label: 'Alert Email', type: 'email' },
      { key: 'streamingKeys', label: 'Live Streaming Keys (RTMP bundle)', type: 'textarea', hint: 'YT/FB RTMP keys for automations' },
      { key: 'instagramSessions', label: 'Instagram Sessions', type: 'textarea' },
      { key: 'twitterKeys', label: 'Twitter Multi-Account Bundle', type: 'textarea' },
      { key: 'googleClients', label: 'Google Clients Bundle', type: 'textarea' },
    ],
  },
];

export type LiveIntegrationTest = {
  id: string;
  label: string;
  channel: string;
  args?: unknown[];
  metric?: string;
  category: 'feed' | 'media' | 'seo' | 'ai' | 'social' | 'utility';
};

export const LIVE_INTEGRATION_TESTS: LiveIntegrationTest[] = [
  { id: 'status', label: 'Full API Scan', channel: 'test-all-connections', category: 'utility', metric: 'All' },
  { id: 'news', label: 'NewsAPI Headlines', channel: 'get-live-news', args: ['technology'], category: 'feed', metric: 'NewsAPI' },
  { id: 'trending', label: 'Trending Topics', channel: 'get-trending-topics', category: 'feed' },
  { id: 'stock', label: 'Stock Photo Search', channel: 'search-stock-photo', args: ['business technology'], category: 'media', metric: 'Unsplash' },
  { id: 'serp', label: 'SerpAPI Research', channel: 'serp-search', args: ['social media automation'], category: 'seo', metric: 'SerpAPI' },
  { id: 'domain', label: 'DomDetailer Metrics', channel: 'get-domain-metrics', args: ['google.com'], category: 'seo', metric: 'DomDetailer' },
  { id: 'youtube', label: 'YouTube Channels', channel: 'get-youtube-channels', category: 'social', metric: 'YouTube' },
  { id: 'tinyurl', label: 'TinyURL Shorten', channel: 'shorten-url', args: ['https://example.com/test'], category: 'utility', metric: 'TinyURL' },
  { id: 'email', label: 'Email Providers (SES/VBout/MailChimp)', channel: 'test-email-connections', category: 'utility', metric: 'Amazon SES' },
  { id: 'email-send', label: 'Send Test Email', channel: 'send-email', args: [{ to: 'theesaintmichael@gmail.com', subject: 'Social Imperialism — Live Email Test', html: '<p>Your email integrations are live.</p>', shortenLinks: false }], category: 'utility' },
  { id: 'deepl', label: 'DeepL Translate', channel: 'deepl-translate', args: ['Hello world', 'ES'], category: 'utility', metric: 'DeepL' },
  { id: 'contentful', label: 'Contentful CMS', channel: 'contentful-fetch', category: 'media', metric: 'Contentful' },
  { id: 'keyword', label: 'Keyword Research', channel: 'research-keyword', args: ['content marketing'], category: 'seo', metric: 'SerpAPI' },
  { id: 'streaming', label: 'Streaming Keys', channel: 'get-streaming-keys', category: 'social' },
  { id: 'payment', label: 'Payment Gateways', channel: 'test-payment-connections', category: 'utility' },
  { id: 'grok', label: 'Grok Session', channel: 'grok-get-status', category: 'ai' },
];

export const ALL_FIELD_KEYS = INTEGRATION_GROUPS.flatMap((g) => g.fields.map((f) => f.key));