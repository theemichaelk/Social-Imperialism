/**
 * Seeds desktop-compatible localStorage keys for new SaaS projects.
 * Only writes keys that are missing — never overwrites user data.
 * No mock/dummy accounts, posts, leads, or sample content.
 */

const DEMO_ENTRY_IDS = new Set(['reply_demo_1', 'lead_demo_1', 'sched_demo_1', 'elist_demo_1']);
const DEMO_QUORA_URLS = new Set([
  'https://www.quora.com/What-are-the-best-social-media-automation-tools',
  'https://www.quora.com/How-do-I-grow-a-B2B-SaaS-brand-on-LinkedIn',
]);
const DEMO_HANDLES = new Set(['Acme Growth Labs', '@acmegrowth', 'u/acmegrowth']);

function isDemoLinkedAccount(acc) {
  if (!acc || typeof acc !== 'object') return false;
  if (DEMO_HANDLES.has(String(acc.handle || '').trim())) return true;
  if (acc.profile?.name === 'Acme Growth Labs') return true;
  if (/^si_(li|tw|rd)_/.test(String(acc.id || '')) && /acme/i.test(String(acc.handle || ''))) return true;
  return false;
}

function filterDemoList(raw, predicate = (item) => !DEMO_ENTRY_IDS.has(item?.id)) {
  try {
    const list = JSON.parse(raw || '[]');
    if (!Array.isArray(list)) return null;
    const filtered = list.filter(predicate);
    return filtered.length === list.length ? null : filtered;
  } catch {
    return null;
  }
}

function isQaTestReply(reply) {
  const post = String(reply?.originalPost || '').trim();
  const content = String(reply?.replyContent || '');
  if (/^(test|best crm\?|test browse)$/i.test(post)) return true;
  if (/test reply content here/i.test(content)) return true;
  if (/hubspot and pipedrive are solid picks/i.test(content)) return true;
  if (/we recommend evaluating hubspot and pipedrive/i.test(content)) return true;
  if (/updated (via page )?qa/i.test(content)) return true;
  if (/acme growth labs|acmegrowth\.com/i.test(content)) return true;
  return false;
}

function isQaEngagementList(list) {
  if (DEMO_ENTRY_IDS.has(list?.id)) return true;
  return /^qa(\s|[-_])/i.test(String(list?.name || ''));
}

function isQaKeyword(kw) {
  const term = String(kw?.term || '').trim().toLowerCase();
  return term === 'qa-test-keyword' || term.startsWith('qa-test') || term === 'qa page test';
}

function isQaScheduledPost(post) {
  const content = String(post?.content || '');
  return /qa (page test|publish|scheduled|test)/i.test(content)
    || /Acme Growth Labs tip/i.test(content)
    || DEMO_ENTRY_IDS.has(post?.id);
}

function isQaPostHistory(post) {
  return /qa (page test|publish|scheduled)/i.test(String(post?.content || ''));
}

function stripDemoSeedData(store, projectId) {
  if (!projectId) return;

  const linkedKey = `linkedAccounts_${projectId}`;
  const linked = filterDemoList(store.getItem(linkedKey), (acc) => !isDemoLinkedAccount(acc));
  if (linked) store.setItem(linkedKey, JSON.stringify(linked));

  const demoTerms = ['social media automation', 'B2B marketing', 'content marketing', 'lead generation', 'growth hacking'];
  const kwPrefix = `kw_${String(projectId).slice(0, 4)}_`;
  const keys = [
    ['keywords', (k) => !(demoTerms.includes(k?.term) && String(k?.id || '').startsWith(kwPrefix)) && !isQaKeyword(k)],
    ['engagementLists', (e) => !isQaEngagementList(e)],
    ['aiRepliesHistory', (r) => !DEMO_ENTRY_IDS.has(r?.id) && !isQaTestReply(r)],
    ['leads', (l) => !DEMO_ENTRY_IDS.has(l?.id)],
    ['scheduled_posts', (p) => !isQaScheduledPost(p)],
    ['postHistory', (p) => !isQaPostHistory(p)],
  ];

  for (const [key, pred] of keys) {
    const filtered = filterDemoList(store.getItem(key), pred);
    if (filtered) store.setItem(key, JSON.stringify(filtered));
  }

  try {
    const qKey = 'quoraTrafficOps';
    const all = JSON.parse(store.getItem(qKey) || '{}');
    const cur = all[projectId];
    if (cur?.cachedQuestions?.length) {
      const cached = cur.cachedQuestions.filter((q) => !DEMO_QUORA_URLS.has(q?.url) && !q?.demo);
      if (cached.length !== cur.cachedQuestions.length) {
        all[projectId] = { ...cur, cachedQuestions: cached };
        if (!cached.length) delete all[projectId].lastScrape;
        store.setItem(qKey, JSON.stringify(all));
      }
    }
  } catch { /* ignore */ }
}

function buildDefaults(project) {
  const id = project.id;
  const brand = project.brandName || project.name || '';
  return {
    keywords: [],
    [`linkedAccounts_${id}`]: [],
    engagementLists: [],
    watchedMonitors: [],
    autoRulesEngine: {
      enabled: false,
      replyMode: 'smart',
      spamFilter: true,
      crisisMode: false,
      maxRepliesPerHour: 10,
      platforms: ['Twitter', 'LinkedIn', 'Reddit'],
      updatedAt: new Date().toISOString(),
    },
    aiRepliesHistory: [],
    leads: [],
    postHistory: [],
    scheduled_posts: [],
    fanpageSettings: {
      enabled: false,
      targetPlatforms: [],
      rssUrl: '',
      autoPublish: false,
    },
    qaSettings: {
      enabled: false,
      platforms: ['Quora', 'Reddit'],
      minViews: 1000,
      autoCompose: false,
    },
    qaSources: { reddit: true, quora: true, stackexchange: false },
    autoSearchSettings: { dailyEnabled: false, frequency: 'daily' },
    autoContentSettings: { enabled: false, scheduleMode: 'daily', postsPerDay: 2 },
    automationFlow: { nodes: [], edges: [], status: 'draft' },
    quoraTrafficOps: {
      [id]: {
        mode: 'manual',
        model: 'gemini',
        angles: [{ id: 'default', name: 'Default Brand Angle', brandPositioning: brand }],
        answers: [],
        publishedLog: [],
        cachedQuestions: [],
      },
    },
    workerTasks: [],
    workerRunningFlag: 'false',
    onboardingComplete: 'false',
    emailCampaigns: {
      settings: {
        defaultProvider: 'auto',
        providerPriority: ['acumbamail', 'ses', 'vbout', 'mailchimp'],
        fromEmail: '',
        fromName: brand || 'Social Imperialism',
        alertEmail: '',
        shortenLinks: true,
        enabled: false,
      },
      campaigns: [],
      log: [],
    },
  };
}

function parseJsonArray(raw) {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function ensureProjectDefaults(store, project) {
  if (!project?.id) return;
  const defaults = buildDefaults(project);
  const linkedKey = `linkedAccounts_${project.id}`;

  for (const [key, value] of Object.entries(defaults)) {
    if (key === linkedKey) {
      if (!store.getItem(key)) store.setItem(key, '[]');
      continue;
    }
    if (!store.getItem(key)) {
      store.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }

  if (!store.getItem(linkedKey)) store.setItem(linkedKey, '[]');

  try {
    const qKey = 'quoraTrafficOps';
    const all = JSON.parse(store.getItem(qKey) || '{}');
    if (!all[project.id]) {
      all[project.id] = defaults.quoraTrafficOps[project.id];
      store.setItem(qKey, JSON.stringify(all));
    }
  } catch { /* ignore */ }

  stripDemoSeedData(store, project.id);
}

module.exports = {
  ensureProjectDefaults,
  buildDefaults,
  stripDemoSeedData,
  isDemoLinkedAccount,
  isQaTestReply,
  isQaKeyword,
  DEMO_ENTRY_IDS,
};