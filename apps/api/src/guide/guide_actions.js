/**
 * THEE_MICHAEL — structured live guide action planner.
 * Plans navigate, simple-mode, tab expand, highlight, open_url sequences.
 */

const GUIDE_VIEWS = [
  { id: 'skills', aliases: ['skills', 'skill tab', 'prompt vault', 'prompts', 'saved prompts'], label: 'Skills (Prompt Vault)', href: '/prompt-vault', navId: 'prompt-vault', sectionId: 'discovery' },
  { id: 'mine', aliases: ['mine', 'my account', 'my profile', 'account hub'], label: 'Mine (My Account)', href: '/dashboard/users', navId: 'dashboard-users', sectionId: 'system' },
  { id: 'studio', aliases: ['studio', 'create', 'content hub', 'generate'], label: 'Studio (Create)', href: '/content-hub?tab=studio', navId: 'content-hub', sectionId: 'create', tab: 'studio', pageId: 'content-hub', selectTab: 'studio' },
  { id: 'connect-apps', aliases: ['connect apps', 'connect platform', 'connections', 'oauth', 'integrations'], label: 'Connect Apps', href: '/integrations?tab=connections', navId: 'integrations', sectionId: 'system', tab: 'connections', pageId: 'integrations', selectTab: 'connections' },
  { id: 'explore', aliases: ['explore', 'discover', 'browse posts', 'browse'], label: 'Explore (Discover)', href: '/browse-posts', navId: 'browse-posts', sectionId: 'mission', pageId: 'browse-posts', selectTab: 'discover' },
  { id: 'seo-tools', aliases: ['seo tools', 'google trends', 'trends', 'kgr', 'research'], label: 'SEO Tools', href: '/seo-tools', navId: 'seo-tools', sectionId: 'discovery' },
  { id: 'keywords', aliases: ['keywords', 'keyword monitor'], label: 'Keywords', href: '/keywords', navId: 'keywords', sectionId: 'discovery' },
  { id: 'history', aliases: ['ai replies', 'replies', 'pending review'], label: 'AI Replies', href: '/history?tab=pending', navId: 'history', sectionId: 'discovery', tab: 'pending', pageId: 'history', selectTab: 'pending' },
  { id: 'billing', aliases: ['billing', 'subscription', 'plan'], label: 'Billing', href: '/settings?tab=billing', navId: 'settings', sectionId: 'system', tab: 'billing', pageId: 'settings', selectTab: 'billing' },
  { id: 'campaign', aliases: ['campaign command', 'campaign manager', 'verified nodes'], label: 'Campaign Command', href: '/campaign-manager', navId: 'campaign-manager', sectionId: 'system' },
  { id: 'admin', aliases: ['admin directory', 'admin console'], label: 'Admin Directory', href: '/dashboard/admin', navId: 'dashboard-admin', sectionId: 'system' },
];

const URL_RE = /\b(?:go\s+to|open)\s+(https?:\/\/[^\s]+)/i;
const CANT_FIND_RE = /(?:don'?t\s+see|can'?t\s+find|where\s+is|take\s+me\s+to|show\s+me|open|go\s+to)/i;

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
  const needsSimpleOff = opts.cantFind || /tab|sidebar|left|simple|focus|hidden/i.test(opts.query || '');

  if (needsSimpleOff) {
    actions.push({ type: 'message', text: 'Auditing Simple mode…' });
    actions.push({ type: 'disable_simple_mode' });
    actions.push({ type: 'expand_advanced_rail', pageId: view.pageId || null });
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
    actions.push({ type: 'expand_advanced_rail', pageId: view.pageId });
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
    actions.push({ type: 'wait', ms: 400 });
    actions.push({ type: 'select_tab', pageId: view.pageId, tabId: view.selectTab });
  }

  actions.push({
    type: 'highlight',
    navId: view.navId,
    sectionId: view.sectionId,
    selector: view.pageId ? `[data-guide-tab="${view.selectTab || ''}"]` : undefined,
    ms: 4200,
  });
  actions.push({ type: 'flash_screen' });

  return actions;
}

function planGuideActions(query, context = {}) {
  const q = String(query || '').trim();
  if (!q) return { actions: [], reply: 'Tell me where you want to go — e.g. Skills, Connect Apps, or Studio.' };

  const urlMatch = q.match(URL_RE);
  if (urlMatch) {
    const url = urlMatch[1];
    return {
      actions: [
        { type: 'message', text: `Opening ${url}…` },
        { type: 'open_url', url, target: '_blank' },
      ],
      reply: `Opening ${url} in a new tab.`,
    };
  }

  if (/mine/i.test(q) && /trend|google/i.test(q)) {
    const view = resolveViewById('keywords');
    const actions = planForView(view, { cantFind: true, query: q });
    actions.unshift({ type: 'message', text: 'Routing to Keywords — Google Trends flow lives under live metrics.' });
    return {
      actions,
      reply: 'Opening **Keywords** with the Google Trends research path (add SERP_API_KEY in Integrations for live trends).',
    };
  }

  const view = matchView(q);
  if (view) {
    const cantFind = CANT_FIND_RE.test(q);
    const actions = planForView(view, { cantFind, query: q });
    return {
      actions,
      reply: cantFind
        ? `Taking you to **${view.label}** — Simple mode off, advanced tabs expanded, and sidebar highlighted.`
        : `Opening **${view.label}** now.`,
    };
  }

  if (/run\s+audit|issue\s+control/i.test(q)) {
    return {
      actions: [
        { type: 'navigate', href: '/dashboard/issues', label: 'Issue Control', navId: 'dashboard-issues', sectionId: 'system' },
        { type: 'highlight', navId: 'dashboard-issues', ms: 3500 },
      ],
      reply: 'Opening Issue Control for a live audit.',
    };
  }

  return {
    actions: [{ type: 'navigate', href: '/support', label: 'Imperialism Brain', navId: 'support', sectionId: 'system' }],
    reply: 'I could not map that view — opening Live Support so we can narrow it down.',
  };
}

function resolveViewById(viewId) {
  return GUIDE_VIEWS.find((v) => v.id === viewId) || null;
}

function planFromViewId(viewId) {
  const view = resolveViewById(viewId);
  if (!view) return { actions: [], reply: 'Unknown view id.' };
  return { actions: planForView(view, { cantFind: true, query: view.label }), reply: `Pushing live redirect to ${view.label}.` };
}

module.exports = {
  GUIDE_VIEWS,
  planGuideActions,
  planFromViewId,
  resolveViewById,
};