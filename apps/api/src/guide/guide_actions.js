/**
 * THEE_MICHAEL — live guide action planner for socialimperialism.com
 * Maps natural language → Social Imperialism sidebar modules, tabs, and routes.
 */

const PRODUCT = 'Social Imperialism';
const PRODUCT_URL = 'https://www.socialimperialism.com';

/** Canonical views — ids match nav.ts where possible */
const GUIDE_VIEWS = [
  // Mission Control
  { id: 'dashboard', section: 'Mission Control', label: 'Dashboard', href: '/dashboard', navId: 'dashboard', sectionId: 'mission', pageId: 'dashboard', selectTab: 'overview',
    aliases: ['dashboard', 'mission control', 'home', 'pulse', 'live feed', 'overview tab'] },
  { id: 'browse-posts', section: 'Mission Control', label: 'Browse Posts', href: '/browse-posts', navId: 'browse-posts', sectionId: 'mission', pageId: 'browse-posts', selectTab: 'discover',
    aliases: ['browse posts', 'discover tab', 'find conversations', 'discovery feed', 'scan posts'] },

  // Create & Publish
  { id: 'onboarding', section: 'Create & Publish', label: 'Setup Wizard', href: '/onboarding', navId: 'onboarding', sectionId: 'create',
    aliases: ['setup wizard', 'onboarding', 'go live checklist', 'go-live', 'brand profile', 'research my brand', 'auto-fill brand'] },
  { id: 'content-hub', section: 'Create & Publish', label: 'Create', href: '/content-hub?tab=studio', navId: 'content-hub', sectionId: 'create', tab: 'studio', pageId: 'content-hub', selectTab: 'studio',
    aliases: ['create', 'content hub', 'generate', 'draft', 'publish', 'studio tab', 'write post'] },
  { id: 'content-library', section: 'Create & Publish', label: 'Library', href: '/content-library', navId: 'content-library', sectionId: 'create',
    aliases: ['library', 'content library', 'assets', 'reuse'] },
  { id: 'design-studio', section: 'Create & Publish', label: 'Design Studio', href: '/design-studio', navId: 'design-studio', sectionId: 'create',
    aliases: ['design studio', 'visual posts', 'templates', 'graphics'] },
  { id: 'brand', section: 'Create & Publish', label: 'Brand', href: '/brand', navId: 'brand', sectionId: 'create',
    aliases: ['brand', 'brand voice', 'tone', 'guidelines'] },
  { id: 'calendar', section: 'Create & Publish', label: 'Calendar', href: '/calendar', navId: 'calendar', sectionId: 'create',
    aliases: ['calendar', 'schedule', 'scheduling', 'publish runway'] },
  { id: 'scheduler', section: 'Create & Publish', label: 'Scheduler', href: '/scheduler', navId: 'scheduler', sectionId: 'create',
    aliases: ['scheduler', 'background runs', 'due posts'] },

  // Discovery & Replies
  { id: 'prompt-vault', section: 'Discovery & Replies', label: 'Prompt Vault', href: '/prompt-vault', navId: 'prompt-vault', sectionId: 'discovery',
    aliases: ['prompt vault', 'saved prompts', 'prompts', 'vault', 'prompt library'] },
  { id: 'engagement', section: 'Discovery & Replies', label: 'Engagement', href: '/engagement', navId: 'engagement', sectionId: 'discovery',
    aliases: ['engagement', 'warm profiles', 'engagement crm', 'comment'] },
  { id: 'history', section: 'Discovery & Replies', label: 'AI Replies', href: '/history?tab=pending', navId: 'history', sectionId: 'discovery', tab: 'pending', pageId: 'history', selectTab: 'pending',
    aliases: ['ai replies', 'replies', 'pending review', 'reply queue', 'approve drafts'] },
  { id: 'keywords', section: 'Discovery & Replies', label: 'Keywords', href: '/keywords', navId: 'keywords', sectionId: 'discovery',
    aliases: ['keywords', 'keyword monitor', 'topics', 'monitor topics'] },
  { id: 'seo-tools', section: 'Discovery & Replies', label: 'SEO Tools', href: '/seo-tools', navId: 'seo-tools', sectionId: 'discovery',
    aliases: ['seo tools', 'kgr', 'keyword research', 'serp research', 'aeo', 'answer engine', 'geo', 'generative engine', 'ai overview', 'paa', 'people also ask', 'featured snippet', 'national seo', 'serp api', 'bing scrape', 'google scrape'] },
  { id: 'seo-local', section: 'Discovery & Replies', label: 'Keywords · Local', href: '/keywords', navId: 'keywords', sectionId: 'discovery',
    aliases: ['local seo', 'near me', 'google business', 'gmb', 'map pack', 'city ranking', 'service area pages'] },

  // Growth Labs
  { id: 'reddit-ai', section: 'Growth Labs', label: 'Growth Lab', href: '/reddit-ai', navId: 'reddit-ai', sectionId: 'labs',
    aliases: ['growth lab', 'reddit', 'reddit ai', 'subreddit'] },
  { id: 'quora-traffic', section: 'Growth Labs', label: 'Quora Ops', href: '/quora-traffic', navId: 'quora-traffic', sectionId: 'labs',
    aliases: ['quora', 'quora ops', 'quora traffic', 'answers'] },

  // Automation
  { id: 'automations', section: 'Automation', label: 'Automations', href: '/automations', navId: 'automations', sectionId: 'automation',
    aliases: ['automations', 'visual flows', 'workflows'] },
  { id: 'rules', section: 'Automation', label: 'Auto-Rules', href: '/rules', navId: 'rules', sectionId: 'automation',
    aliases: ['auto-rules', 'auto rules', 'keyword triggers', 'monitors'] },

  // Accounts
  { id: 'account-hub', section: 'Accounts', label: 'Accounts', href: '/account-hub', navId: 'account-hub', sectionId: 'accounts',
    aliases: ['accounts', 'account hub', 'connected accounts', 'oauth status'] },
  { id: 'account-creator', section: 'Accounts', label: 'Acct Creator', href: '/account-creator', navId: 'account-creator', sectionId: 'accounts',
    aliases: ['acct creator', 'account creator', 'new profiles', 'profile kits'] },

  // System
  { id: 'my-account', section: 'System', label: 'My Account', href: '/dashboard/users', navId: 'dashboard-users', sectionId: 'system',
    aliases: ['my account', 'profile', 'sitemap', 'feed.xml', 'organization'] },
  { id: 'integrations', section: 'System', label: 'Integrations', href: '/integrations?tab=connections', navId: 'integrations', sectionId: 'system', tab: 'connections', pageId: 'integrations', selectTab: 'connections',
    aliases: ['integrations', 'integrations hub', 'connect platform', 'connections', 'oauth', 'api connection', 'connect apps'] },
  { id: 'integrations-probes', section: 'System', label: 'Integrations · Live Probes', href: '/integrations?tab=probes', navId: 'integrations', sectionId: 'system', tab: 'probes', pageId: 'integrations', selectTab: 'probes',
    aliases: ['live probes', 'probes', 'test connections'] },
  { id: 'settings', section: 'System', label: 'Settings', href: '/settings', navId: 'settings', sectionId: 'system', pageId: 'settings', selectTab: 'overview',
    aliases: ['settings', 'api keys', 'configuration'] },
  { id: 'settings-billing', section: 'System', label: 'Settings · Billing', href: '/settings?tab=billing', navId: 'settings', sectionId: 'system', tab: 'billing', pageId: 'settings', selectTab: 'billing',
    aliases: ['billing', 'subscription', 'plan', 'payment'] },
  { id: 'settings-guardian', section: 'System', label: 'Settings · Guardian & API', href: '/settings?tab=guardian-api', navId: 'settings', sectionId: 'system', tab: 'guardian-api', pageId: 'settings', selectTab: 'guardian-api',
    aliases: ['guardian', 'gatekeeper', 'thee_michael security', 'security control'] },
  { id: 'campaign-manager', section: 'System', label: 'Campaign Command', href: '/campaign-manager', navId: 'campaign-manager', sectionId: 'system',
    aliases: ['campaign command', 'campaign manager', 'campaigns', 'verified nodes'] },
  { id: 'dns', section: 'System', label: 'DNS', href: '/dns', navId: 'dns', sectionId: 'system',
    aliases: ['dns', 'domain', 'domains', 'records'] },
  { id: 'support', section: 'System', label: 'Imperialism Brain', href: '/support', navId: 'support', sectionId: 'system',
    aliases: ['imperialism brain', 'live support', 'help', 'thee_michael', 'brain'] },
  { id: 'download', section: 'System', label: 'Download Desktop App', href: '/download', navId: 'download', sectionId: 'system',
    aliases: ['download', 'desktop app', 'windows installer', 'electron'] },
  { id: 'issue-control', section: 'System', label: 'Issue Control', href: '/dashboard/issues', navId: 'dashboard-issues', sectionId: 'system', adminOnly: true,
    aliases: ['issue control', 'gitops', 'repairs', 'audit issues'] },
  { id: 'admin-directory', section: 'System', label: 'Admin Directory', href: '/dashboard/admin', navId: 'dashboard-admin', sectionId: 'system', adminOnly: true,
    aliases: ['admin directory', 'admin', 'all users', 'user directory'] },
];

const URL_RE = /\b(?:go\s+to|open)\s+(https?:\/\/[^\s]+)/i;
const CANT_FIND_RE = /(?:don'?t\s+see|can'?t\s+find|where\s+is|where'?s|take\s+me\s+to|show\s+me|left\s+(?:side|sidebar|nav|menu)|sidebar|tab\s+on\s+the\s+left)/i;
const FOCUS_MODE_RE = /focus\s+mode|hidden\s+tab|collapsed|advanced\s+(?:tab|rail|group)/i;

function matchView(query) {
  const q = query.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const view of GUIDE_VIEWS) {
    for (const alias of view.aliases) {
      if (q.includes(alias) && alias.length >= bestScore) {
        best = view;
        bestScore = alias.length;
      }
    }
  }
  return best;
}

function planForView(view, opts = {}) {
  const actions = [];
  const needsFocusExpand = opts.cantFind || FOCUS_MODE_RE.test(opts.query || '') || (view.pageId && opts.cantFind);

  if (needsFocusExpand) {
    actions.push({ type: 'message', text: `Checking Focus mode on ${PRODUCT}…` });
    actions.push({ type: 'disable_simple_mode' });
    if (view.pageId) {
      actions.push({ type: 'expand_advanced_rail', pageId: view.pageId });
    } else {
      actions.push({ type: 'expand_advanced_rail', pageId: null });
    }
  }

  if (view.sectionId) {
    actions.push({ type: 'expand_sidebar_section', sectionId: view.sectionId });
  }

  if (view.pageId && view.selectTab) {
    actions.push({
      type: 'restore_hidden_tabs',
      pageId: view.pageId,
      tabIds: [view.selectTab],
    });
  }

  actions.push({
    type: 'navigate',
    href: view.href,
    label: view.label,
    navId: view.navId,
    sectionId: view.sectionId,
    tab: view.tab,
  });

  if (view.pageId && view.selectTab) {
    actions.push({ type: 'wait', ms: 450 });
    actions.push({ type: 'select_tab', pageId: view.pageId, tabId: view.selectTab });
  }

  actions.push({
    type: 'highlight',
    navId: view.navId,
    sectionId: view.sectionId,
    selector: view.pageId && view.selectTab ? `[data-guide-tab="${view.selectTab}"]` : undefined,
    ms: 4200,
  });
  actions.push({ type: 'flash_screen' });

  return actions;
}

function planGuideActions(query, context = {}) {
  const q = String(query || '').trim();
  if (!q) {
    return {
      actions: [],
      reply: `Tell me which ${PRODUCT} module to open — e.g. Integrations, Prompt Vault, Create, or Browse Posts.`,
    };
  }

  const urlMatch = q.match(URL_RE);
  if (urlMatch) {
    const url = urlMatch[1];
    const isExternal = !url.includes('socialimperialism.com');
    return {
      actions: [
        { type: 'message', text: `Opening ${url}…` },
        { type: 'open_url', url, target: isExternal ? '_blank' : '_self' },
      ],
      reply: isExternal
        ? `Opening ${url} in a new tab.`
        : `Navigating within ${PRODUCT}.`,
    };
  }

  if (/research\s+my\s+brand|auto[\s-]?fill\s+brand|setup\s+wizard|brand\s+profile/i.test(q)) {
    const view = resolveViewById('onboarding');
    const actions = planForView(view, { cantFind: CANT_FIND_RE.test(q), query: q });
    actions.unshift({ type: 'message', text: 'THEE_MICHAEL intelligent setup → enter domain and click Research My Brand…' });
    return {
      actions,
      reply: 'Opening **Setup Wizard** — enter your domain, click **THEE_MICHAEL — Research & Auto-Fill from Web**. I pull live site data, SEO intel, keywords, and wire everything to **Campaign Command**.',
    };
  }

  // AEO / GEO / Local / National SEO intelligence routes
  if (/\bae[no]\b|answer\s+engine|featured\s+snippet|\bpaa\b|people\s+also\s+ask/i.test(q)) {
    const view = resolveViewById('seo-tools');
    const actions = planForView(view, { cantFind: CANT_FIND_RE.test(q), query: q });
    actions.unshift({ type: 'message', text: 'AEO intelligence → SEO Tools (PAA, KGR, snippets)…' });
    return {
      actions,
      reply: 'Opening **SEO Tools** for **AEO** — run **People Also Ask** and **KGR**, then draft answer-first posts in **Create**. Live SERP requires SerpAPI under **Integrations → Connections**.',
    };
  }

  if (/\bgeo\b|generative\s+engine|ai\s+overview|llm\s+visibility|perplexity|chatgpt\s+citat/i.test(q)) {
    const view = resolveViewById('seo-tools');
    const actions = planForView(view, { cantFind: CANT_FIND_RE.test(q), query: q });
    actions.unshift({ type: 'message', text: 'GEO intelligence → SERP citation research…' });
    return {
      actions,
      reply: 'Opening **SEO Tools** for **GEO** — scrape who gets cited, then publish original data in **Create** and seed **Quora Ops** for corroboration.',
    };
  }

  if (/local\s+seo|near\s+me|google\s+business|\bgmb\b|map\s+pack|city\s+rank/i.test(q)) {
    const view = resolveViewById('seo-local') || resolveViewById('keywords');
    const actions = planForView(view, { cantFind: CANT_FIND_RE.test(q), query: q });
    actions.unshift({ type: 'message', text: 'Local SEO sprint → Keywords + DNS…' });
    return {
      actions,
      reply: 'Routing **Local SEO** — add city+service terms in **Keywords**, verify **DNS** records, schedule proof posts on **Calendar**.',
    };
  }

  if (/national\s+seo|head\s+term|topical\s+map|domain\s+authority|competitive\s+keyword/i.test(q)) {
    const view = resolveViewById('seo-tools');
    const actions = planForView(view, { cantFind: CANT_FIND_RE.test(q), query: q });
    actions.unshift({ type: 'message', text: 'National SEO → KGR + clustering…' });
    return {
      actions,
      reply: 'Opening **SEO Tools** for **National SEO** — run **KGR**, **Grouping Tool**, then align **Brand** voice for entity consistency.',
    };
  }

  // Google Trends / SERP research — native SI paths
  if (/google\s+trends?|trending\s+search|serp\s*api/i.test(q)) {
    const view = resolveViewById('seo-tools');
    const actions = planForView(view, { cantFind: CANT_FIND_RE.test(q), query: q });
    actions.unshift({ type: 'message', text: 'Routing to SEO Tools on socialimperialism.com…' });
    return {
      actions,
      reply: 'Opening **SEO Tools** — run KGR or scrape research, then send winners to **Keywords**. Add `SERP_API_KEY` under **Integrations → Connections** for live Google Trends data.',
    };
  }

  if (/self[\s-]?heal|daily\s+audit|run\s+audit|what\s+should\s+i\s+improve/i.test(q)) {
    const view = resolveViewById('support');
    const actions = planForView(view, { cantFind: CANT_FIND_RE.test(q), query: q });
    actions.unshift({ type: 'message', text: 'Self-heal audit → Imperialism Brain…' });
    return {
      actions,
      reply: 'Opening **Imperialism Brain** — say **"run audit now"** for Guardian + SEO rollup, or **"what should I improve today?"** for daily recommendations.',
    };
  }

  if (/run\s+audit|issue\s+control|gitops/i.test(q)) {
    const view = resolveViewById('issue-control');
    return {
      actions: planForView(view, { cantFind: true, query: q }),
      reply: 'Opening **Issue Control** on socialimperialism.com for THEE_MICHAEL GitOps repairs.',
    };
  }

  const view = matchView(q);
  if (view) {
    const cantFind = CANT_FIND_RE.test(q);
    const actions = planForView(view, { cantFind, query: q });
    const sectionHint = view.section ? ` (${view.section} in the left sidebar)` : '';
    return {
      actions,
      reply: cantFind
        ? `Taking you to **${view.label}**${sectionHint} — Focus mode expanded, tabs restored, and module highlighted on ${PRODUCT_URL}.`
        : `Opening **${view.label}** on ${PRODUCT}.`,
    };
  }

  return {
    actions: [
      { type: 'navigate', href: '/support', label: 'Imperialism Brain', navId: 'support', sectionId: 'system' },
      { type: 'highlight', navId: 'support', sectionId: 'system', ms: 3000 },
    ],
    reply: `I could not map that to a ${PRODUCT} module — opening **Imperialism Brain** live support.`,
  };
}

function resolveViewById(viewId) {
  return GUIDE_VIEWS.find((v) => v.id === viewId) || null;
}

function planFromViewId(viewId) {
  const view = resolveViewById(viewId);
  if (!view) return { actions: [], reply: 'Unknown Social Imperialism module id.' };
  return {
    actions: planForView(view, { cantFind: true, query: view.label }),
    reply: `Pushing live redirect to **${view.label}** on ${PRODUCT_URL}.`,
  };
}

function listViewsForApi() {
  return GUIDE_VIEWS.map((v) => ({
    id: v.id,
    label: v.label,
    href: v.href,
    section: v.section,
    navId: v.navId,
  }));
}

module.exports = {
  PRODUCT,
  PRODUCT_URL,
  GUIDE_VIEWS,
  planGuideActions,
  planFromViewId,
  resolveViewById,
  listViewsForApi,
};