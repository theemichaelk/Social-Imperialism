export type PlaybookStep = {
  n: number;
  title: string;
  action: string;
  channel?: string;
};

export type SitePlaybook = {
  id: string;
  icon: string;
  title: string;
  color: string;
  summary: string;
  steps: PlaybookStep[];
};

export const SITE_PLAYBOOKS: SitePlaybook[] = [
  {
    id: 'blog',
    icon: '📝',
    title: 'Blog / Content Site',
    color: '#38bdf8',
    summary: 'Keyword clusters, RSS syndication, and social amplification for editorial brands.',
    steps: [
      { n: 1, title: 'Keyword Foundation', action: 'Seed {keywords} into Keywords page and run SerpAPI research for content gaps.', channel: 'research-keyword' },
      { n: 2, title: 'Brand Context', action: 'Apply description "{description}" as tone anchor in Content Hub AI prompts and reply drafts.' },
      { n: 3, title: 'RSS Discovery', action: 'Run site RSS router for competitor feeds related to {keywords}.', channel: 'discover-site-rss' },
      { n: 4, title: 'Content Calendar', action: 'Schedule 3 posts/week targeting long-tail variants of {keywords}.' },
      { n: 5, title: 'Social Amplification', action: 'Cross-post to Twitter, LinkedIn, and Reddit with UTM tracking from active campaign.' },
      { n: 6, title: 'Engagement Loop', action: 'Enable auto-rules for mentions containing {keywords} — review drafts in AI Replies.' },
    ],
  },
  {
    id: 'ecommerce',
    icon: '🛒',
    title: 'E-Commerce Store',
    color: '#f59e0b',
    summary: 'Product-led keywords, affiliate angles, and conversion-focused social outreach.',
    steps: [
      { n: 1, title: 'Product Keywords', action: 'Map {keywords} to buyer-intent clusters — run KGR and PAA in SEO Tools.' },
      { n: 2, title: 'Store Positioning', action: 'Embed "{description}" in product reply templates and Quora answer angles.' },
      { n: 3, title: 'Reddit Prospector', action: 'Scan subreddits for purchase-intent threads matching {keywords}.' },
      { n: 4, title: 'Stock Media', action: 'Pull product lifestyle images via Unsplash/Pexels for {keywords} campaigns.' },
      { n: 5, title: 'TinyURL Tracking', action: 'Shorten product links with UTM params for social posts.' },
      { n: 6, title: 'Conversion Monitor', action: 'Track DomDetailer DA growth and Serp rankings for {keywords} weekly.' },
    ],
  },
  {
    id: 'saas',
    icon: '☁️',
    title: 'SaaS / Software',
    color: '#a855f7',
    summary: 'Feature-led content, demo funnels, and B2B social proof on LinkedIn & Twitter.',
    steps: [
      { n: 1, title: 'ICP Keywords', action: 'Define {keywords} as problem/solution pairs — research in SEO Tools.' },
      { n: 2, title: 'Value Prop', action: 'Use "{description}" in LinkedIn carousel copy and demo CTA replies.' },
      { n: 3, title: 'NewsAPI Monitoring', action: 'Track industry news for {keywords} — draft timely commentary posts.' },
      { n: 4, title: 'Quora Authority', action: 'Answer high-traffic questions about {keywords} with product context.' },
      { n: 5, title: 'Visual Automations', action: 'Build webhook flow: new signup → Slack alert → auto welcome tweet.' },
      { n: 6, title: 'Analytics Review', action: 'Check dashboard Growth tab for engagement on {keywords} content.' },
    ],
  },
  {
    id: 'agency',
    icon: '🏢',
    title: 'Agency / Multi-Brand',
    color: '#22c55e',
    summary: 'Per-client campaigns, isolated credentials, and white-label reporting.',
    steps: [
      { n: 1, title: 'Campaign Isolation', action: 'Create separate campaign per client — set domain and {keywords} per brand.' },
      { n: 2, title: 'Client Brief', action: 'Store "{description}" in campaign description field for AI context.' },
      { n: 3, title: 'Account Linking', action: 'Connect client OAuth accounts in Account Hub per campaign.' },
      { n: 4, title: 'Keyword Sets', action: 'Tag {keywords} with campaignId — worker scans per active brand.' },
      { n: 5, title: 'Health Audit', action: 'Run Per-Site Traffic check for each client domain in Settings.' },
      { n: 6, title: 'Export Reports', action: 'Export data snapshot and share DomDetailer metrics with clients.' },
    ],
  },
  {
    id: 'local',
    icon: '📍',
    title: 'Local Business',
    color: '#f472b6',
    summary: 'Geo-targeted keywords, Google presence, and community engagement.',
    steps: [
      { n: 1, title: 'Local Keywords', action: 'Combine {keywords} with city/region modifiers in Keywords page.' },
      { n: 2, title: 'Business Profile', action: 'Set "{description}" as local brand voice in reply templates.' },
      { n: 3, title: 'Serp Local Pack', action: 'Research {keywords} in SerpAPI for map pack competitors.' },
      { n: 4, title: 'Meta / Instagram', action: 'Post local events and offers to connected Meta accounts.' },
      { n: 5, title: 'Review Responses', action: 'Enable mention auto-replies for {keywords} on Facebook and Google.' },
      { n: 6, title: 'Domain Health', action: 'Monitor local domain DA/PA — target TF > 10 for local authority.' },
    ],
  },
  {
    id: 'media',
    icon: '📰',
    title: 'News / Media Publisher',
    color: '#fb923c',
    summary: 'Breaking news feeds, rapid publishing, and multi-platform distribution.',
    steps: [
      { n: 1, title: 'Topic Watch', action: 'Configure NewsAPI alerts for {keywords} — auto-draft headlines.' },
      { n: 2, title: 'Editorial Voice', action: 'Apply "{description}" as editorial guidelines in Content Hub.' },
      { n: 3, title: 'RSS Ingestion', action: 'Aggregate category RSS for {keywords} via Content Hub router.' },
      { n: 4, title: 'Rapid Publish', action: 'Queue breaking posts across Twitter, LinkedIn, and Telegram.' },
      { n: 5, title: 'DeepL Translation', action: 'Translate top stories for international {keywords} audiences.' },
      { n: 6, title: 'Trending Sync', action: 'Cross-reference dashboard trending with {keywords} for timely posts.' },
    ],
  },
];

export function personalizeStep(text: string, keywords: string, description: string): string {
  const kw = keywords.trim() || 'your target keywords';
  const desc = description.trim() || 'your brand description';
  return text.replace(/\{keywords\}/g, kw).replace(/\{description\}/g, desc);
}