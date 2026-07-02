/**
 * THEE_MICHAEL Self-Heal Engine
 * Daily self-audit · safe auto-fixes · user recommendations from accumulated data
 */
const { createPrismaStore, invoke } = require('@si/core');
const {
  appendErrorJournal,
  appendFixJournal,
  appendAuditLog,
  saveDailyRecommendations,
  getJournal,
  getAuditLog,
  getLearningMemory,
  getDailyRecommendations,
  formatJournalForPrompt,
} = require('@si/core/src/selfHealJournal');
const { buildIntelligenceBrief, resolveProjectKeys } = require('../seo/seoIntelligenceEngine');

const SAFE_AUTO_FIXES = [
  {
    id: 'requeue-due-posts',
    label: 'Re-process due scheduled posts',
    channel: 'process-due-scheduled-posts',
    args: [],
    learning: 'Due posts stuck in queue — scheduler re-process clears backlog without user action.',
  },
  {
    id: 'refresh-guardian-scan',
    label: 'Refresh Guardian health scan',
    channel: 'run-guardian-scan',
    args: [],
    learning: 'Proactive guardian scan surfaces integration/token issues before users notice.',
  },
];

const AUDIT_CHECKS = [
  { id: 'guardian', channel: 'run-guardian-scan', label: 'Guardian health scan' },
  { id: 'api-status', channel: 'check-api-status', label: 'API integrations status' },
  { id: 'worker', channel: 'get-worker-status', label: 'Worker status' },
  { id: 'queue', channel: 'get-content-queue', label: 'Content queue depth' },
  { id: 'engagement', channel: 'get-engagement-queue', label: 'Engagement queue' },
  { id: 'keywords', channel: 'get-keywords', label: 'Keyword monitor' },
];

async function getStore(projectId, organizationId) {
  return createPrismaStore({ projectId, organizationId });
}

async function runCheck(projectId, organizationId, check) {
  try {
    const data = await invoke({
      projectId,
      organizationId,
      channel: check.channel,
      args: check.args || [],
    });
    return { id: check.id, label: check.label, ok: true, data };
  } catch (e) {
    return { id: check.id, label: check.label, ok: false, error: e.message };
  }
}

function extractGuardianIssues(scanData) {
  const alerts = scanData?.alerts || [];
  return Array.isArray(alerts) ? alerts : [];
}

function buildRecommendationsFromAudit(ctx) {
  const {
    checks = [],
    guardianAlerts = [],
    keywords = [],
    seoBrief = null,
    journal = [],
    project,
  } = ctx;

  const recs = [];
  const add = (category, title, action, href, priority = 50) => {
    recs.push({ category, title, action, href, priority, topic: category });
  };

  const failed = checks.filter((c) => !c.ok);
  for (const f of failed) {
    add('Health', `${f.label} check failed`, `Open Integrations and verify connections — ${f.error}`, '/integrations?tab=connections', 90);
  }

  for (const alert of guardianAlerts.slice(0, 5)) {
    const mod = alert.module || alert.component || 'system';
    add(
      'Guardian',
      `${mod}: ${alert.summary || alert.message || 'degraded'}`,
      alert.recommendedAction || `Review ${mod} in Settings → Guardian & API`,
      '/settings?tab=guardian-api',
      alert.severity === 'high' ? 95 : 70,
    );
  }

  const openErrors = journal.filter((j) => j.kind === 'error' && !j.resolved);
  for (const err of openErrors.slice(0, 3)) {
    add(
      'Self-Heal',
      `Unresolved: ${err.errorCode}`,
      err.suggestedFix || `Review Issue Control for ${err.issueSignature || err.id}`,
      '/dashboard/issues',
      85,
    );
  }

  if (!keywords?.length) {
    add('SEO', 'No keywords monitored', 'Add 3–5 high-intent terms in Keywords, then run KGR in SEO Tools', '/keywords', 60);
  } else if (keywords.length < 5) {
    add('SEO', 'Thin keyword coverage', `You monitor ${keywords.length} terms — expand to 10+ for better SERP signal`, '/keywords', 55);
  }

  if (seoBrief?.recommendations?.length) {
    for (const sr of seoBrief.recommendations.slice(0, 3)) {
      add(
        'SEO',
        `${sr.framework}: ${sr.label}`,
        sr.actions[0],
        '/seo-tools',
        65,
      );
    }
  }

  if (seoBrief && !seoBrief.liveData) {
    add('SEO', 'Connect SerpAPI for live intelligence', 'Add SERP_API_KEY under Integrations → Connections for multi-engine SERP pulse', '/integrations?tab=connections', 58);
  }

  const queueCheck = checks.find((c) => c.id === 'queue');
  const pending = queueCheck?.data?.pending || queueCheck?.data?.stats?.pending || 0;
  if (pending > 10) {
    add('Content', 'Large content queue backlog', `${pending} items pending — review Calendar and Scheduler`, '/calendar', 72);
  }

  const engagementCheck = checks.find((c) => c.id === 'engagement');
  const engPending = engagementCheck?.data?.pending || engagementCheck?.data?.stats?.pending || 0;
  if (engPending > 5) {
    add('Engagement', 'Replies awaiting review', `${engPending} drafts in AI Replies queue — approve or edit`, '/history?tab=pending', 68);
  }

  if (!project?.brandName && !project?.description) {
    add('Brand', 'Incomplete brand profile', 'Complete Setup Wizard — brand voice improves AI replies and SEO entity signals', '/onboarding', 45);
  }

  add('Growth', 'Daily improvement habit', 'Run one SEO Tools scan + approve 3 replies + schedule 1 post — compound growth loop', '/dashboard', 40);

  return recs.sort((a, b) => b.priority - a.priority).slice(0, 12);
}

async function applySafeAutoFixes(store, projectId, organizationId, failures = []) {
  const applied = [];

  for (const fix of SAFE_AUTO_FIXES) {
    const relevant = failures.some((f) => f.id === 'queue' || f.id === 'guardian' || f.id === 'api-status');
    if (!relevant && fix.id !== 'refresh-guardian-scan') continue;

    try {
      const result = await invoke({
        projectId,
        organizationId,
        channel: fix.channel,
        args: fix.args,
      });
      const entry = await appendFixJournal(store, {
        source: 'daily-self-heal',
        errorCode: 'AUTO_FIX',
        message: fix.label,
        fixAction: fix.label,
        fixResult: 'applied',
        learning: fix.learning,
      });
      applied.push({ fix: fix.id, ok: true, result, journalId: entry.id });
    } catch (e) {
      await appendErrorJournal(store, {
        source: 'self-heal',
        errorCode: 'AUTO_FIX_FAILED',
        message: `${fix.label}: ${e.message}`,
        rootCause: 'Safe auto-fix could not complete — may need manual Integrations review',
        suggestedFix: 'Open Integrations → Connections and verify API keys / OAuth tokens',
        learning: `Auto-fix ${fix.id} failed — escalate if recurring.`,
      });
      applied.push({ fix: fix.id, ok: false, error: e.message });
    }
  }

  return applied;
}

async function runProjectSelfAudit(projectId, organizationId, opts = {}) {
  const started = Date.now();
  const store = await getStore(projectId, organizationId);
  const keys = await resolveProjectKeys(projectId, organizationId);

  const checks = [];
  for (const check of AUDIT_CHECKS) {
    checks.push(await runCheck(projectId, organizationId, check));
  }

  const guardianCheck = checks.find((c) => c.id === 'guardian');
  const guardianAlerts = extractGuardianIssues(guardianCheck?.data);

  let keywords = [];
  const kwCheck = checks.find((c) => c.id === 'keywords');
  if (kwCheck?.ok) {
    const raw = kwCheck.data;
    keywords = Array.isArray(raw) ? raw : (raw?.keywords || []);
    if (!Array.isArray(keywords)) keywords = [];
  }

  const project = await require('@si/db').prisma.project.findUnique({ where: { id: projectId } });

  let seoBrief = null;
  try {
    seoBrief = await buildIntelligenceBrief('daily SEO growth audit', {
      keys,
      invoke,
      projectId,
      organizationId,
    });
  } catch (e) {
    await appendErrorJournal(store, {
      source: 'seo-intel',
      errorCode: 'SEO_BRIEF_FAILED',
      message: e.message,
      rootCause: 'Daily SEO brief generation failed',
      suggestedFix: 'Verify SerpAPI key or retry from SEO Tools',
    });
  }

  const journal = getJournal(store);
  const failures = checks.filter((c) => !c.ok);

  for (const f of failures) {
    await appendErrorJournal(store, {
      source: 'daily-audit',
      errorCode: `AUDIT_${f.id.toUpperCase()}`,
      severity: 'medium',
      message: `${f.label}: ${f.error}`,
      rootCause: `Automated ${f.label} check failed during daily self-audit`,
      suggestedFix: f.id === 'api-status'
        ? 'Reconnect platforms in Integrations Hub'
        : `Open ${f.label} module and verify configuration`,
      learning: `Recurring ${f.id} failures often indicate expired OAuth or missing API keys.`,
    });
  }

  const autoFixes = opts.skipAutoFix ? [] : await applySafeAutoFixes(store, projectId, organizationId, failures);

  const recommendations = buildRecommendationsFromAudit({
    checks,
    guardianAlerts,
    keywords,
    seoBrief,
    journal: getJournal(store),
    project,
  });

  await saveDailyRecommendations(store, recommendations);

  const learnings = [
    ...autoFixes.filter((a) => a.ok).map((a) => SAFE_AUTO_FIXES.find((f) => f.id === a.fix)?.learning).filter(Boolean),
    failures.length
      ? `${failures.length} audit check(s) failed — documented in self-heal journal`
      : 'All audit checks passed — maintain daily SEO + engagement rhythm',
  ];

  if (seoBrief?.pulse?.insights?.[0]) learnings.push(seoBrief.pulse.insights[0]);

  const auditEntry = await appendAuditLog(store, {
    status: failures.length ? 'degraded' : 'healthy',
    checksRun: checks.length,
    checksPassed: checks.filter((c) => c.ok).length,
    checksFailed: failures.length,
    autoFixesApplied: autoFixes.filter((a) => a.ok).length,
    issuesFound: failures.length + guardianAlerts.length,
    recommendations,
    failures: failures.map((f) => ({ id: f.id, error: f.error })),
    learnings,
    durationMs: Date.now() - started,
  });

  await store.flush();

  return {
    projectId,
    audit: auditEntry,
    checks,
    guardianAlerts,
    recommendations,
    autoFixes,
    seoBriefSummary: seoBrief ? {
      intents: seoBrief.intents,
      keyword: seoBrief.keyword,
      liveData: seoBrief.liveData,
    } : null,
  };
}

async function runDailySelfHealForAllProjects() {
  const { prisma } = require('@si/db');
  const projects = await prisma.project.findMany({ where: { isActive: true } });
  const results = [];

  for (const p of projects) {
    try {
      const result = await runProjectSelfAudit(p.id, p.organizationId);
      results.push({ projectId: p.id, ok: true, ...result });
      console.log(`[self-heal] Daily audit project ${p.id}: ${result.audit.status} (${result.audit.checksPassed}/${result.audit.checksRun} passed, ${result.recommendations.length} recs)`);
    } catch (e) {
      console.warn(`[self-heal] Daily audit project ${p.id}:`, e.message);
      results.push({ projectId: p.id, ok: false, error: e.message });
    }
  }

  return results;
}

async function getSelfHealStatus(projectId, organizationId) {
  const store = await getStore(projectId, organizationId);
  const journal = getJournal(store);
  const audits = getAuditLog(store);
  const learning = getLearningMemory(store);
  const recommendations = getDailyRecommendations(store);

  return {
    journal: {
      total: journal.length,
      openErrors: journal.filter((j) => j.kind === 'error' && !j.resolved).length,
      recentFixes: journal.filter((j) => j.kind === 'fix').slice(0, 5),
      recentErrors: journal.filter((j) => j.kind === 'error').slice(0, 5),
    },
    lastAudit: audits[0] || null,
    learning: learning.slice(0, 10),
    recommendations,
    promptAppend: formatJournalForPrompt(store),
  };
}

module.exports = {
  runProjectSelfAudit,
  runDailySelfHealForAllProjects,
  getSelfHealStatus,
  buildRecommendationsFromAudit,
  SAFE_AUTO_FIXES,
  AUDIT_CHECKS,
};