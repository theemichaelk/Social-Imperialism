/**
 * Generate 10 live + 25 weekly drip blog posts (1000+ words, AEO/GEO, silo links).
 * Run: node apps/web/scripts/generate-blog-content.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../src/content/blog');

const INTERNAL = [
  ['Mission Control Dashboard', '/dashboard'],
  ['Content Hub', '/content-hub'],
  ['Keywords module', '/keywords'],
  ['SEO Tools', '/seo-tools'],
  ['Growth Lab (Reddit AI)', '/reddit-ai'],
  ['Quora Ops', '/quora-traffic'],
  ['Visual Automations', '/automations'],
  ['Content Calendar', '/calendar'],
  ['Integrations Hub', '/integrations'],
  ['Video Studio', '/video-studio'],
  ['Prompt Vault', '/prompt-vault'],
  ['Campaign Manager', '/campaign-manager'],
  ['Imperialism Brain Support', '/support'],
  ['Account Hub', '/account-hub'],
  ['Setup Wizard', '/onboarding'],
  ['Design Studio', '/design-studio'],
  ['Browse Posts', '/browse-posts'],
  ['Scheduler', '/scheduler'],
];

const AUTHORITY = [
  ['Google Search Central — SEO Starter Guide', 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide'],
  ['Google Search Central — AI features & your website', 'https://developers.google.com/search/docs/appearance/ai-features'],
  ['Schema.org — BlogPosting', 'https://schema.org/BlogPosting'],
  ["Moz — Beginner's Guide to SEO", 'https://moz.com/beginners-guide-to-seo'],
  ['Ahrefs Blog', 'https://ahrefs.com/blog/'],
  ['Search Engine Journal', 'https://www.searchenginejournal.com/'],
  ['Search Engine Land', 'https://searchengineland.com/'],
  ['HubSpot — Social Media Marketing', 'https://blog.hubspot.com/marketing/social-media-marketing'],
  ['Buffer Resources', 'https://buffer.com/resources'],
  ['Hootsuite Blog', 'https://blog.hootsuite.com/'],
  ['Content Marketing Institute', 'https://contentmarketinginstitute.com/'],
  ['Nielsen Norman Group', 'https://www.nngroup.com/articles/'],
  ['Wikipedia — Search engine optimization', 'https://en.wikipedia.org/wiki/Search_engine_optimization'],
  ['Wikipedia — Answer engine', 'https://en.wikipedia.org/wiki/Answer_engine'],
  ['OAuth 2.0', 'https://oauth.net/2/'],
  ['W3C Web Accessibility', 'https://www.w3.org/WAI/'],
  ['Reddit for Business', 'https://www.business.reddit.com/'],
  ['Meta for Business', 'https://www.facebook.com/business'],
  ['LinkedIn Marketing Solutions', 'https://business.linkedin.com/marketing-solutions'],
  ['Think with Google', 'https://www.thinkwithgoogle.com/'],
];

const IMAGES = [
  ['/hero/slide-15.jpg', '/hero/slide-06.jpg', '/hero/slide-07.jpg', '/hero/slide-01.jpg'],
  ['/hero/slide-01.jpg', '/hero/slide-08.jpg', '/hero/slide-02.jpg', '/hero/slide-10.jpg'],
  ['/hero/slide-10.jpg', '/hero/slide-15.jpg', '/hero/slide-06.jpg', '/hero/slide-08.jpg'],
  ['/hero/slide-07.jpg', '/hero/slide-01.jpg', '/hero/slide-08.jpg', '/hero/slide-15.jpg'],
  ['/hero/slide-02.jpg', '/hero/slide-10.jpg', '/hero/slide-15.jpg', '/hero/slide-06.jpg'],
  ['/hero/slide-06.jpg', '/hero/slide-07.jpg', '/hero/slide-01.jpg', '/hero/slide-02.jpg'],
  ['/hero/slide-08.jpg', '/hero/slide-02.jpg', '/hero/slide-10.jpg', '/hero/slide-07.jpg'],
  ['/hero/slide-15.jpg', '/hero/slide-01.jpg', '/hero/slide-06.jpg', '/hero/slide-10.jpg'],
  ['/hero/slide-07.jpg', '/hero/slide-08.jpg', '/hero/slide-02.jpg', '/hero/slide-01.jpg'],
  ['/hero/slide-10.jpg', '/hero/slide-15.jpg', '/hero/slide-07.jpg', '/hero/slide-08.jpg'],
];

const VIDEOS = [
  'https://assets.mixkit.co/videos/preview/mixkit-hud-map-interface-with-data-and-information-27998-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-code-screen-close-up-1728-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-a-digital-stock-market-ticker-32608-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-futuristic-devices-99786-large.mp4',
];

function pick(arr, i) {
  return arr[i % arr.length];
}

const LIVE = [
  { slug: 'ai-social-media-automation-guide-2026', title: 'AI Social Media Automation: The Complete 2026 Guide', silo: 'automation', siloLabel: 'Automation', kw: ['AI social media automation', 'social automation 2026', 'automated posting', 'AEO social content'], angle: 'mission-control automation and answer-engine ready publishing' },
  { slug: 'multi-platform-publishing-strategy', title: 'Multi-Platform Publishing Strategy for Modern Brands', silo: 'platforms', siloLabel: 'Platforms', kw: ['multi-platform publishing', 'cross-posting strategy', 'OAuth publishing', 'GEO content distribution'], angle: 'native variants with generative engine summaries' },
  { slug: 'reddit-marketing-automation-b2b', title: 'Reddit Marketing Automation for B2B Growth Teams', silo: 'growth', siloLabel: 'Growth', kw: ['Reddit marketing automation', 'B2B Reddit strategy', 'community SEO', 'local intent Reddit'], angle: 'ethical community growth with local commercial intent' },
  { slug: 'content-calendar-automation-best-practices', title: 'Content Calendar Automation: Best Practices for 2026', silo: 'automation', siloLabel: 'Automation', kw: ['content calendar automation', 'social scheduling', 'auto-publish', 'editorial calendar SEO'], angle: 'calendar systems that feed AEO clusters' },
  { slug: 'social-media-analytics-ga4-integration', title: 'Social Media Analytics & GA4 Integration Explained', silo: 'analytics-seo', siloLabel: 'Analytics & SEO', kw: ['social media analytics', 'GA4 integration', 'social attribution', 'GEO measurement'], angle: 'measurement for AI Overviews and social assisted conversions' },
  { slug: 'quora-traffic-generation-with-ai', title: 'Quora Traffic Generation with AI-Assisted Answers', silo: 'growth', siloLabel: 'Growth', kw: ['Quora traffic', 'AI Quora answers', 'answer engine optimization', 'Quora SEO'], angle: 'AEO-native Q&A as owned demand capture' },
  { slug: 'keyword-intelligence-social-growth', title: 'Keyword Intelligence for Social Growth in 2026', silo: 'growth', siloLabel: 'Growth', kw: ['keyword intelligence', 'social keyword tracking', 'local keyword SEO', 'AEO entities'], angle: 'entity-first keywords for maps, chat, and social' },
  { slug: 'visual-automation-workflows-agencies', title: 'Visual Automation Workflows for Agency Teams', silo: 'automation', siloLabel: 'Automation', kw: ['visual automation', 'agency social automation', 'workflow automation', 'multi-client SEO ops'], angle: 'agency ops that protect GEO brand consistency' },
  { slug: 'oauth-social-account-management-scale', title: 'OAuth Social Account Management at Scale', silo: 'platforms', siloLabel: 'Platforms', kw: ['OAuth social accounts', 'social account management', 'token health', 'multi-location publishing'], angle: 'secure multi-location brand presence' },
  { slug: 'seo-social-silo-structure-brand-authority', title: 'SEO + Social Silo Structure for Brand Authority', silo: 'analytics-seo', siloLabel: 'Analytics & SEO', kw: ['SEO silo structure', 'topic clusters', 'brand authority SEO', 'AEO GEO silos'], angle: 'silos engineered for classic SEO and generative engines' },
];

const SCHEDULED = [
  { slug: 'aeo-playbook-social-brands-2026', title: 'Answer Engine Optimization Playbook for Social Brands', silo: 'analytics-seo', siloLabel: 'Analytics & SEO', kw: ['answer engine optimization', 'AEO playbook', 'speakable content', 'featured snippets social'], angle: 'design content blocks engines quote' },
  { slug: 'geo-local-social-domination', title: 'Generative Engine Optimization for Local Social Domination', silo: 'analytics-seo', siloLabel: 'Analytics & SEO', kw: ['generative engine optimization', 'GEO local SEO', 'AI Overviews local', 'local brand authority'], angle: 'win local AI Overviews with social proof' },
  { slug: 'entity-seo-brand-knowledge-graphs', title: 'Entity SEO: Building Brand Knowledge Graphs from Social Proof', silo: 'analytics-seo', siloLabel: 'Analytics & SEO', kw: ['entity SEO', 'knowledge graph brand', 'E-E-A-T social', 'structured brand data'], angle: 'entities that connect social and search' },
  { slug: 'zero-click-social-strategy', title: 'Zero-Click Search Strategy for Social Teams', silo: 'analytics-seo', siloLabel: 'Analytics & SEO', kw: ['zero-click search', 'brand SERP social', 'AI Overview traffic', 'engagement metrics SEO'], angle: 'measure influence beyond CTR' },
  { slug: 'speakable-schema-social-content', title: 'Speakable Schema and Social Content for Voice & AI Assistants', silo: 'analytics-seo', siloLabel: 'Analytics & SEO', kw: ['speakable schema', 'voice search content', 'assistant optimization', 'AEO markup'], angle: 'markup that survives AI summaries' },
  { slug: 'local-service-business-social-seo', title: 'Local Service Business Social SEO: Maps, Reviews, and Feeds', silo: 'growth', siloLabel: 'Growth', kw: ['local service SEO', 'Google Business Profile social', 'review strategy', 'local AEO'], angle: 'local pack + social corroboration' },
  { slug: 'linkedin-thought-leadership-aeo', title: 'LinkedIn Thought Leadership Built for AEO Citation', silo: 'platforms', siloLabel: 'Platforms', kw: ['LinkedIn thought leadership', 'B2B AEO', 'LinkedIn SEO 2026', 'professional GEO'], angle: 'posts structured for citation' },
  { slug: 'youtube-chapters-geo-optimization', title: 'YouTube Chapters and GEO: Structuring Video for AI Overviews', silo: 'platforms', siloLabel: 'Platforms', kw: ['YouTube SEO chapters', 'video GEO', 'AI overview video', 'YouTube AEO'], angle: 'video transcripts as answer sources' },
  { slug: 'tiktok-discovery-to-owned-search', title: 'From TikTok Discovery to Owned Search Demand', silo: 'platforms', siloLabel: 'Platforms', kw: ['TikTok SEO', 'short video search', 'owned demand capture', 'social to SEO funnel'], angle: 'short-form to silo conversion' },
  { slug: 'reddit-threads-as-research-engines', title: 'Using Reddit Threads as Living Research Engines for Content Silos', silo: 'growth', siloLabel: 'Growth', kw: ['Reddit research SEO', 'community keyword mining', 'UGC insights', 'content silo research'], angle: 'mine intent without spam' },
  { slug: 'quora-spaces-authority-clusters', title: 'Quora Spaces as Authority Clusters for Generative Search', silo: 'growth', siloLabel: 'Growth', kw: ['Quora Spaces SEO', 'authority clusters', 'Q&A AEO', 'referral + generative'], angle: 'cluster answers into silos' },
  { slug: 'prompt-vault-content-systems', title: 'Prompt Vault Systems for Consistent Brand Voice at Scale', silo: 'automation', siloLabel: 'Automation', kw: ['prompt vault', 'AI brand voice', 'content ops automation', 'governed generation'], angle: 'governed prompts for AEO consistency' },
  { slug: 'mission-control-editorial-ops', title: 'Mission Control Editorial Ops for Always-On Brands', silo: 'automation', siloLabel: 'Automation', kw: ['editorial operations', 'mission control social', 'content ops dashboard', 'publish reliability'], angle: 'ops reliability as SEO signal' },
  { slug: 'crisis-pause-automation-playbooks', title: 'Crisis Pause Automation Playbooks Without Killing Momentum', silo: 'automation', siloLabel: 'Automation', kw: ['crisis communications automation', 'social pause playbook', 'brand risk automation', 'approval gates'], angle: 'safe automation under pressure' },
  { slug: 'utm-discipline-multi-network', title: 'UTM Discipline Across 14+ Networks Without Spreadsheet Chaos', silo: 'analytics-seo', siloLabel: 'Analytics & SEO', kw: ['UTM strategy social', 'campaign tracking', 'GA4 social', 'attribution hygiene'], angle: 'clean attribution at scale' },
  { slug: 'first-comment-link-strategy', title: 'First-Comment Link Strategies That Protect Reach and SEO', silo: 'platforms', siloLabel: 'Platforms', kw: ['first comment links', 'social link strategy', 'algorithm friendly linking', 'conversion without reach loss'], angle: 'links without throttling' },
  { slug: 'agency-client-silo-architecture', title: 'Agency Client Silo Architecture for Multi-Brand SEO', silo: 'analytics-seo', siloLabel: 'Analytics & SEO', kw: ['agency SEO silos', 'multi-brand content', 'client topical authority', 'GEO brand separation'], angle: 'separate entities cleanly' },
  { slug: 'review-generation-local-geo', title: 'Ethical Review Generation Loops for Local GEO Wins', silo: 'growth', siloLabel: 'Growth', kw: ['review generation strategy', 'local GEO reviews', 'reputation SEO', 'service area pages social'], angle: 'reviews as generative proof' },
  { slug: 'content-hub-cornerstone-model', title: 'The Content Hub Cornerstone Model for Compounding Silos', silo: 'automation', siloLabel: 'Automation', kw: ['content hub strategy', 'cornerstone content', 'silo compounding', 'repurpose automation'], angle: 'one hub many engines' },
  { slug: 'ai-draft-approval-gates-eeat', title: 'AI Draft Approval Gates That Strengthen E-E-A-T', silo: 'automation', siloLabel: 'Automation', kw: ['E-E-A-T AI content', 'human approval gates', 'trustworthy automation', 'editorial AI'], angle: 'trust without killing speed' },
  { slug: 'social-proof-schema-pipelines', title: 'Social Proof Schema Pipelines for Rich Results', silo: 'analytics-seo', siloLabel: 'Analytics & SEO', kw: ['review schema', 'social proof SEO', 'structured data pipeline', 'rich results social'], angle: 'proof that machines can parse' },
  { slug: 'multilingual-social-geo', title: 'Multilingual Social + GEO Without Diluting Authority', silo: 'platforms', siloLabel: 'Platforms', kw: ['multilingual SEO social', 'hreflang content ops', 'localized GEO', 'global brand voice'], angle: 'locale-safe expansion' },
  { slug: 'community-first-indexation', title: 'Community-First Indexation: From Threads to Topic Ownership', silo: 'growth', siloLabel: 'Growth', kw: ['community indexation', 'topic ownership SEO', 'forum to blog pipeline', 'AEO research'], angle: 'own questions communities surface' },
  { slug: 'executive-bylines-aeo-trust', title: 'Executive Bylines and AEO Trust Signals That Actually Rank', silo: 'analytics-seo', siloLabel: 'Analytics & SEO', kw: ['author bylines SEO', 'E-E-A-T executives', 'thought leadership AEO', 'trust signals'], angle: 'people entities in search' },
  { slug: '2027-roadmap-social-search-convergence', title: '2027 Roadmap: Social and Search Convergence for Operators', silo: 'analytics-seo', siloLabel: 'Analytics & SEO', kw: ['social search convergence', 'future of SEO 2027', 'AEO GEO roadmap', 'operator strategy'], angle: 'prepare systems not slogans' },
];

function expandParagraphs(meta) {
  const k0 = meta.kw[0] || meta.title;
  const k1 = meta.kw[1] || k0;
  const k2 = meta.kw[2] || k1;
  const base = [
    `After two decades advising publishers, multi-location operators, and category-defining brands on answer engines and generative surfaces, one pattern is constant: teams that treat ${k0} as a channel tactic underperform teams that treat it as an operating system. This guide centers on ${meta.angle}. That distinction separates campaigns that spike for a week from programs that compound topical authority across classic Google results, AI Overviews, assistants, and social recommendation graphs.`,
    `Practitioners still over-index on vanity velocity—more posts, more tools, more dashboards—while under-investing in entity clarity, speakable summaries, and measurement that survives zero-click behavior. When we design ${k1} programs, we start with the questions audiences actually ask, the entities search engines must resolve, and the proof social platforms can corroborate in public. Only then do we automate distribution through Social Imperialism-class mission control.`,
    `Local and national intent now interleave. A service brand may need city-level visibility while a SaaS brand needs category definitions that generative engines can quote safely. ${k2} work fails when copy is generic enough to travel everywhere and specific enough nowhere. High-performing systems encode locale, persona, and risk tier into templates so automation cannot invent claims legal would reject.`,
    `Operators see this daily inside unified dashboards: publish reliability, keyword monitors, and content hubs only create leverage when the underlying narrative is engineered for both humans and machines. The following sections translate field lessons from AEO (Answer Engine Optimization) and GEO (Generative Engine Optimization) into concrete playbooks you can run without hiring a research lab.`,
  ];
  const more = [
    `Instrumentation comes first. Define the primary conversion event, the secondary assist events, and the brand-search lift window you will attribute to ${k0}. Without those contracts, AI will optimize for engagement that never reaches revenue, and leadership will correctly question the program.`,
    `Entity hygiene is non-negotiable. Consistent NAP for local brands, consistent product naming for software, and consistent executive bylines across blog, LinkedIn, and schema reduce knowledge-graph fragmentation. Generative engines amplify inconsistency faster than classic blue links ever did.`,
    `Answer blocks should be explicit. AEO rewards concise, cite-able paragraphs that resolve intent in forty to eighty words before deeper exposition. Place those blocks near the top, mark them speakable where appropriate, and support them with evidence sections machines can chunk without inventing claims.`,
    `GEO rewards multi-hop usefulness: definitions, comparisons, steps, and caveats. Structure H2s as questions people type into ChatGPT-class interfaces. Follow with scannable lists that still read as expert prose—not keyword stuffing dressed as bullets.`,
    `Social distribution is corroboration, not decoration. When high-trust accounts discuss the same entities your silos define, you create multi-surface consistency engines can treat as consensus. Automate distribution carefully; never automate deception or undisclosed affiliation.`,
    `Governance beats cleverness. Approval gates, prompt vaults, and brand voice libraries prevent scale from becoming liability. The brands that win the next five years will be those whose automation is boringly reliable and whose expertise is visibly human with named authors and lived experience.`,
    `Measurement must include zero-click proxies: branded search growth, direct navigations, assisted conversions, share of AI citations where observable, and qualitative win reports from sales teams hearing your language repeated on calls.`,
    `Finally, commit to silo depth. Shallow topical coverage signals weakness to both crawlers and generative rankers. Publish fewer pillars with more interconnected support pages—and let social amplify the cluster, not random one-offs that never interlink.`,
    `Advanced teams operationalize ${k0} with weekly entity reviews, monthly silo gap analyses, and quarterly GEO audits that compare AI Overview presence against competitor clusters. Document decisions so future operators inherit reasoning—not only templates.`,
    `Inside Social Imperialism, pair keyword intelligence with content hub cornerstones so every social spike has an owned destination engineered for AEO blocks and internal links. That closed loop is how ${meta.angle} becomes durable advantage rather than campaign noise.`,
  ];
  return { base, more };
}

function wordCount(sections) {
  return sections.reduce(
    (n, s) => n + s.paragraphs.reduce((m, p) => m + p.split(/\s+/).filter(Boolean).length, 0),
    0,
  );
}

function buildSections(meta) {
  const { base, more } = expandParagraphs(meta);
  const short = meta.title.replace(/:.*$/, '');
  const headings = [
    `Why ${short} Matters Now`,
    'AEO Foundations: Designing for Answer Engines',
    'GEO Foundations: Winning Generative Overviews',
    'Operational Architecture Inside Mission Control',
    'Local vs National Intent Mapping',
    'Measurement, Attribution, and Zero-Click Reality',
    'Implementation Roadmap and Governance',
    'Common Failure Modes and Field Fixes',
    'Frequently Asked Questions',
    'Next Steps for Operators',
  ];
  const sections = headings.map((heading, i) => {
    const paragraphs = [];
    if (i < 4) paragraphs.push(base[i]);
    else if (i !== 8) paragraphs.push(more[(i - 4) % more.length]);
    if (i !== 8) {
      paragraphs.push(more[(i + 2) % more.length]);
      paragraphs.push(more[(i + 5) % more.length]);
      paragraphs.push(more[(i + 7) % more.length]);
    }
    if (i === 8) {
      paragraphs.push(
        `What is the difference between AEO and GEO in ${meta.kw[0]} programs? AEO optimizes for direct answers—featured snippets, assistants, and speakable summaries—while GEO optimizes for how generative systems synthesize multi-source overviews. You need both: crisp answer blocks plus deep supporting evidence that engines can cite without inventing details.`,
      );
      paragraphs.push(
        `How long until results appear? Entity cleanup and silo structure can show branded search movement in four to eight weeks; generative citation patterns usually lag and require consistent multi-surface proof. Treat the first ninety days as instrumentation and trust-building, not a viral sprint.`,
      );
      paragraphs.push(
        `Can automation replace subject-matter experts? No. Automation multiplies expert judgment; it cannot invent lived experience. Keep humans on claims, compliance, and original research while machines handle formatting, scheduling, and variant generation.`,
      );
      paragraphs.push(
        `Where should Social Imperialism fit? Use mission control for publishing reliability and monitors for demand sensing; keep your public silos on owned domains as the canonical authority generative engines should cite when users ask commercial or local questions.`,
      );
    }
    return { heading, paragraphs };
  });

  let w = wordCount(sections);
  let guard = 0;
  while (w < 1050 && guard < 15) {
    sections[2].paragraphs.push(
      `Field teams auditing ${meta.kw[0]} should also track competitor answer blocks, schema coverage, and social corroboration velocity. When rivals earn AI Overview citations, reverse-engineer their entity density and internal linking—not their hashtag volume—and rebuild your silo until machines have no ambiguity about who owns the topic.`,
    );
    sections[5].paragraphs.push(
      `Close every sprint with a publish postmortem: what failed OAuth, which variants underperformed, which questions from Reddit or Quora still lack owned destinations. Those questions become next week's AEO targets, turning community noise into a governed roadmap for ${meta.angle}.`,
    );
    w = wordCount(sections);
    guard += 1;
  }
  return sections;
}

function aeo(meta) {
  return `${meta.title.split(':')[0]} succeeds when teams combine speakable answer blocks, entity-consistent social proof, and owned silos that generative engines can cite—then automate distribution without sacrificing human approval on claims.`;
}

function geo(meta) {
  return `Operators with twenty years across answer engines and generative surfaces treat ${meta.kw[0]} as multi-surface authority design: crisp AEO answers, deeper GEO evidence, local and national intent maps, and measurement beyond click-through rate.`;
}

function geoPoints(meta) {
  return [
    `Prioritize entity clarity and consistent naming so ${meta.kw[0]} signals do not fragment across platforms.`,
    'Use Quick Answer blocks near the top for AEO; support with steps, comparisons, and caveats for GEO.',
    'Measure branded search, assists, and citation proxies—not only social vanity metrics.',
    `Encode governance (prompt vaults, approvals) so automation scales ${meta.angle} safely.`,
  ];
}

const articles = {};
const allMeta = [];

function addMeta(item, publishedAt, idx) {
  const imgs = pick(IMAGES, idx);
  const internal = pick(INTERNAL, idx + 3);
  const auth = pick(AUTHORITY, idx + 5);
  const sections = buildSections(item);
  const wc = wordCount(sections);
  articles[item.slug] = { sections };
  allMeta.push({
    slug: item.slug,
    title: item.title,
    excerpt: `${item.angle.charAt(0).toUpperCase()}${item.angle.slice(1)}.`,
    description: `${item.title} — expert AEO/GEO guidance on ${item.kw.slice(0, 3).join(', ')} for operators running Social Imperialism-class systems.`,
    silo: item.silo,
    siloLabel: item.siloLabel,
    publishedAt,
    updatedAt: publishedAt,
    readMinutes: Math.max(8, Math.round(wc / 220)),
    thumbnail: imgs[0],
    headerImage: imgs[1],
    midImage1: imgs[2],
    midImage2: imgs[3],
    midImage1Caption: 'Operational systems: answer blocks, entities, and distribution working together.',
    midImage2Caption: 'Measurement loops that survive zero-click and generative discovery.',
    bottomImage: imgs[0],
    videoUrl: pick(VIDEOS, idx),
    videoCaption: `${item.siloLabel} systems — from research to publish reliability.`,
    keywords: item.kw,
    siloLinks: [
      { label: 'Social Imperialism homepage', href: '/', kind: 'home' },
      { label: internal[0], href: internal[1], kind: 'internal' },
      { label: auth[0], href: auth[1], kind: 'authority' },
    ],
    aeoAnswer: aeo(item),
    geoLead: geo(item),
    geoPoints: geoPoints(item),
    _wordCount: wc,
  });
}

LIVE.forEach((item, i) => {
  const d = new Date(Date.UTC(2026, 0, 12 + i * 7));
  addMeta(item, d.toISOString().slice(0, 10), i);
});

const start = new Date(Date.UTC(2026, 6, 21));
SCHEDULED.forEach((item, i) => {
  const d = new Date(start.getTime() + i * 7 * 86400000);
  addMeta(item, d.toISOString().slice(0, 10), i + 10);
});

const articlesTs = `/** Auto-generated long-form blog bodies — AEO/GEO authoritative format (TSBR-style). */
export type BlogSection = { heading: string; paragraphs: string[] };
export type BlogArticleBody = { sections: BlogSection[] };

export const BLOG_ARTICLES: Record<string, BlogArticleBody> = ${JSON.stringify(articles, null, 2)};
`;

const postsTs = `/** Auto-generated blog post metadata (10 live + 25 weekly drip). Do not hand-edit; re-run generate-blog-content.mjs */
export const GENERATED_BLOG_POSTS = ${JSON.stringify(
  allMeta.map(({ _wordCount, ...rest }) => rest),
  null,
  2,
)};
`;

fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, 'articles.ts'), articlesTs);
fs.writeFileSync(path.join(root, 'generatedPosts.ts'), postsTs);

const minW = Math.min(...allMeta.map((m) => m._wordCount));
console.log('Generated posts:', allMeta.length);
console.log('Min words:', minW);
console.log('Live first:', allMeta[0].slug, allMeta[0]._wordCount);
console.log('Schedule first:', allMeta[10].publishedAt, allMeta[10].slug);
console.log('Schedule last:', allMeta[34].publishedAt, allMeta[34].slug);
