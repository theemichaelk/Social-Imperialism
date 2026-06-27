/**
 * Seeds desktop-compatible localStorage keys for new SaaS projects.
 * Only writes keys that are missing — never overwrites user data.
 */

function demoLinkedAccounts(projectId) {
  return [
    {
      id: `si_li_${projectId.slice(0, 6)}`,
      platform: 'LinkedIn',
      handle: 'Acme Growth Labs',
      type: 'Profile',
      linkedAt: new Date().toISOString(),
      profile: { name: 'Acme Growth Labs', headline: 'B2B SaaS marketing automation' },
    },
    {
      id: `si_tw_${projectId.slice(0, 6)}`,
      platform: 'Twitter',
      handle: '@acmegrowth',
      type: 'Profile',
      linkedAt: new Date().toISOString(),
    },
    {
      id: `si_rd_${projectId.slice(0, 6)}`,
      platform: 'Reddit',
      handle: 'u/acmegrowth',
      type: 'User',
      subreddit: 'marketing',
      linkedAt: new Date().toISOString(),
    },
  ];
}

function demoKeywords(projectId) {
  const terms = [
    'social media automation',
    'B2B marketing',
    'content marketing',
    'lead generation',
    'growth hacking',
  ];
  return terms.map((term, i) => ({
    id: `kw_${projectId.slice(0, 4)}_${i}`,
    term,
    campaignId: projectId,
    platforms: ['Twitter', 'LinkedIn', 'Reddit'],
  }));
}

function buildDefaults(project) {
  const id = project.id;
  const brand = project.brandName || project.name || 'Brand';
  return {
    keywords: demoKeywords(id),
    [`linkedAccounts_${id}`]: demoLinkedAccounts(id),
    engagementLists: [
      {
        id: 'elist_demo_1',
        name: 'SaaS Founders',
        type: 'linkedin-profiles',
        profileUrls: ['https://www.linkedin.com/in/example'],
        autoEngage: false,
        campaignId: id,
      },
    ],
    watchedMonitors: [
      { id: 'mon_1', label: 'Brand mentions', type: 'keyword', target: brand, platform: 'Twitter' },
      { id: 'mon_2', label: 'Competitor watch', type: 'keyword', target: 'marketing automation', platform: 'Reddit' },
    ],
    autoRulesEngine: {
      enabled: true,
      replyMode: 'smart',
      spamFilter: true,
      crisisMode: false,
      maxRepliesPerHour: 10,
      platforms: ['Twitter', 'LinkedIn', 'Reddit'],
      updatedAt: new Date().toISOString(),
    },
    aiRepliesHistory: [
      {
        id: 'reply_demo_1',
        originalPost: 'What is the best tool for social media scheduling?',
        replyContent: `Great question! ${brand} helps teams automate scheduling, engagement, and analytics across every major platform.`,
        platform: 'Twitter',
        status: 'draft',
        campaignId: id,
        createdAt: new Date().toISOString(),
      },
    ],
    leads: [
      {
        id: 'lead_demo_1',
        platform: 'Reddit',
        author: 'startup_founder',
        content: 'Looking for social media automation recommendations',
        url: 'https://reddit.com/r/marketing/comments/demo',
        capturedAt: new Date().toISOString(),
      },
    ],
    postHistory: [],
    scheduled_posts: [
      {
        id: 'sched_demo_1',
        campaignId: id,
        platform: 'LinkedIn',
        accountId: `si_li_${id.slice(0, 6)}`,
        content: `🚀 ${brand} tip: Batch your content creation on Monday, schedule for the week, engage daily.`,
        timestamp: new Date(Date.now() + 3 * 86400000).toISOString(),
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      },
    ],
    fanpageSettings: {
      enabled: true,
      targetPlatforms: ['Facebook', 'LinkedIn'],
      rssUrl: 'https://feeds.feedburner.com/TechCrunch',
      autoPublish: false,
    },
    qaSettings: {
      enabled: true,
      platforms: ['Quora', 'Reddit'],
      minViews: 1000,
      autoCompose: false,
    },
    qaSources: { reddit: true, quora: true, stackexchange: false },
    autoSearchSettings: { dailyEnabled: true, frequency: 'daily' },
    autoContentSettings: { enabled: false, scheduleMode: 'daily', postsPerDay: 2 },
    automationFlow: { nodes: [], edges: [], status: 'draft' },
    quoraTrafficOps: {
      [id]: {
        mode: 'manual',
        model: 'gemini',
        angles: [{ id: 'default', name: 'Default Brand Angle', brandPositioning: brand }],
        answers: [],
        publishedLog: [],
        cachedQuestions: [
          { title: 'What are the best social media automation tools?', url: 'https://www.quora.com/What-are-the-best-social-media-automation-tools', keyword: 'marketing', score: 85, views: 12000 },
          { title: 'How do I grow a B2B SaaS brand on LinkedIn?', url: 'https://www.quora.com/How-do-I-grow-a-B2B-SaaS-brand-on-LinkedIn', keyword: 'marketing', score: 78, views: 8500 },
        ],
        lastScrape: { keyword: 'marketing', at: new Date().toISOString(), count: 2 },
      },
    },
    workerTasks: [],
    workerRunningFlag: 'false',
    onboardingComplete: 'true',
    emailCampaigns: {
      settings: {
        defaultProvider: 'auto',
        providerPriority: ['acumbamail', 'ses', 'vbout', 'mailchimp'],
        fromEmail: 'michaelk@tsbrenterprises.com',
        fromName: 'Social Imperialism',
        alertEmail: 'theesaintmichael@gmail.com',
        shortenLinks: true,
        enabled: true,
      },
      campaigns: [
        {
          id: 'email_camp_mention_digest',
          name: 'Social Mention Auto-Reply Digest',
          description: 'Email digest when AI drafts a social auto-reply.',
          provider: 'auto',
          trigger: 'reply.generated',
          enabled: true,
          autoReply: true,
          shortenLinks: true,
          subject: `${brand} — AI Reply Drafted on {{platform}}`,
          html: `<p>Hi,</p><p>Auto-reply drafted on <strong>{{platform}}</strong>:</p><blockquote>{{preview}}</blockquote><p><a href="https://www.socialimperialism.com/history">Review in dashboard</a></p>`,
        },
        {
          id: 'email_camp_keyword_nurture',
          name: 'Keyword Match Lead Nurture',
          provider: 'auto',
          trigger: 'keyword.matched',
          enabled: true,
          autoReply: true,
          shortenLinks: true,
          subject: `${brand} — Keyword Match: {{matchedKeyword}}`,
          html: `<p>Keyword <strong>{{matchedKeyword}}</strong> matched on {{platform}}.</p><p>{{topic}}</p>`,
        },
        {
          id: 'email_camp_welcome',
          name: 'Brand Welcome & Onboarding',
          provider: 'auto',
          trigger: 'lead.captured',
          enabled: true,
          autoReply: true,
          shortenLinks: true,
          subject: `Welcome to ${brand}`,
          html: `<p>Welcome! Your ${brand} automation is live.</p>`,
        },
      ],
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
      const existing = parseJsonArray(store.getItem(key));
      if (existing?.length) continue;
      store.setItem(key, JSON.stringify(defaults[linkedKey]));
      continue;
    }
    if (!store.getItem(key)) {
      store.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }

  if (!parseJsonArray(store.getItem(linkedKey))?.length) {
    store.setItem(linkedKey, JSON.stringify(defaults[linkedKey]));
  }

  try {
    const qKey = 'quoraTrafficOps';
    const all = JSON.parse(store.getItem(qKey) || '{}');
    const seed = defaults.quoraTrafficOps[project.id];
    if (seed) {
      const cur = all[project.id] || {};
      if (!all[project.id]) {
        all[project.id] = seed;
      } else if (!cur.cachedQuestions?.length && seed.cachedQuestions?.length) {
        all[project.id] = { ...cur, cachedQuestions: seed.cachedQuestions, lastScrape: cur.lastScrape || seed.lastScrape };
      }
      store.setItem(qKey, JSON.stringify(all));
    }
  } catch { /* ignore */ }
}

module.exports = { ensureProjectDefaults, demoLinkedAccounts, demoKeywords, buildDefaults };