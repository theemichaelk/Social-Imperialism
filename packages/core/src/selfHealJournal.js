/**
 * THEE_MICHAEL Self-Heal Journal — self-documenting errors, fixes, and learnings.
 * Persisted in project store + Prisma ProjectSetting for cross-session memory.
 */
const crypto = require('crypto');

const JOURNAL_KEY = 'selfHealErrorJournal';
const AUDIT_KEY = 'selfHealAuditLog';
const RECS_KEY = 'selfHealDailyRecommendations';
const LEARNING_KEY = 'selfHealLearningMemory';
const MAX_JOURNAL = 80;
const MAX_AUDITS = 30;
const MAX_LEARNING = 50;

function parseJson(raw, fallback) {
  try { return JSON.parse(raw || ''); } catch { return fallback; }
}

function getProjectId(store) {
  return store.projectId || store.getItem('saasProjectId') || store.getItem('activeCampaignId') || 'default';
}

async function syncToPrisma(projectId, key, value) {
  try {
    const { prisma } = require('@si/db');
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    await prisma.projectSetting.upsert({
      where: { projectId_key: { projectId, key } },
      create: { projectId, key, value: str },
      update: { value: str },
    });
  } catch { /* desktop-only or db unavailable */ }
}

function readStoreList(store, key, max) {
  return parseJson(store.getItem(key), []).slice(0, max);
}

function writeStoreList(store, key, items, max) {
  store.setItem(key, JSON.stringify(items.slice(0, max)));
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * Document an error with root cause, suggested fix, and learning takeaway.
 */
async function appendErrorJournal(store, entry = {}) {
  const projectId = getProjectId(store);
  const item = {
    id: entry.id || makeId('err'),
    kind: 'error',
    severity: entry.severity || 'medium',
    source: entry.source || 'runtime',
    errorCode: entry.errorCode || 'RUNTIME_EXCEPTION',
    message: String(entry.message || entry.traceback || '').slice(0, 2000),
    rootCause: entry.rootCause || null,
    suggestedFix: entry.suggestedFix || entry.patchSummary || null,
    component: entry.component || null,
    issueSignature: entry.issueSignature || null,
    autoFixAttempted: false,
    autoFixResult: null,
    resolved: false,
    learning: entry.learning || null,
    ts: entry.ts || new Date().toISOString(),
  };

  const journal = readStoreList(store, JOURNAL_KEY, MAX_JOURNAL);
  const dupe = item.issueSignature
    && journal.find((j) => j.issueSignature === item.issueSignature && !j.resolved && j.kind === 'error');
  if (!dupe) {
    journal.unshift(item);
    writeStoreList(store, JOURNAL_KEY, journal, MAX_JOURNAL);
    await syncToPrisma(projectId, JOURNAL_KEY, journal);
  }

  if (item.learning || item.rootCause) {
    await appendLearning(store, {
      topic: item.errorCode,
      insight: item.learning || item.rootCause,
      source: 'error',
    });
  }

  return { item, duplicate: !!dupe };
}

/**
 * Document a fix attempt and what was learned.
 */
async function appendFixJournal(store, entry = {}) {
  const projectId = getProjectId(store);
  const item = {
    id: entry.id || makeId('fix'),
    kind: 'fix',
    severity: entry.severity || 'low',
    source: entry.source || 'self-heal',
    errorCode: entry.errorCode || 'AUTO_FIX',
    message: String(entry.message || '').slice(0, 2000),
    fixAction: entry.fixAction || null,
    fixResult: entry.fixResult || 'applied',
    learning: entry.learning || null,
    relatedErrorId: entry.relatedErrorId || null,
    issueSignature: entry.issueSignature || null,
    resolved: entry.fixResult === 'applied' || entry.fixResult === 'success',
    ts: entry.ts || new Date().toISOString(),
  };

  const journal = readStoreList(store, JOURNAL_KEY, MAX_JOURNAL);
  journal.unshift(item);

  if (entry.relatedErrorId || entry.issueSignature) {
    for (let i = 0; i < journal.length; i += 1) {
      const j = journal[i];
      if (j.kind === 'error' && !j.resolved) {
        const match = (entry.relatedErrorId && j.id === entry.relatedErrorId)
          || (entry.issueSignature && j.issueSignature === entry.issueSignature);
        if (match) {
          journal[i] = {
            ...j,
            resolved: item.resolved,
            autoFixAttempted: true,
            autoFixResult: item.fixResult,
            suggestedFix: item.fixAction || j.suggestedFix,
          };
        }
      }
    }
  }

  writeStoreList(store, JOURNAL_KEY, journal, MAX_JOURNAL);
  await syncToPrisma(projectId, JOURNAL_KEY, journal);

  if (item.learning) {
    await appendLearning(store, { topic: item.errorCode, insight: item.learning, source: 'fix' });
  }

  return item;
}

async function appendLearning(store, { topic, insight, source = 'audit' }) {
  const projectId = getProjectId(store);
  const mem = readStoreList(store, LEARNING_KEY, MAX_LEARNING);
  const entry = {
    id: makeId('learn'),
    topic: topic || 'general',
    insight: String(insight || '').slice(0, 500),
    source,
    ts: new Date().toISOString(),
  };
  const deduped = [entry, ...mem.filter((m) => m.insight !== entry.insight)].slice(0, MAX_LEARNING);
  writeStoreList(store, LEARNING_KEY, deduped, MAX_LEARNING);
  await syncToPrisma(projectId, LEARNING_KEY, deduped);
  return entry;
}

async function appendAuditLog(store, audit = {}) {
  const projectId = getProjectId(store);
  const entry = {
    id: makeId('audit'),
    status: audit.status || 'completed',
    checksRun: audit.checksRun || 0,
    checksPassed: audit.checksPassed || 0,
    checksFailed: audit.checksFailed || 0,
    autoFixesApplied: audit.autoFixesApplied || 0,
    issuesFound: audit.issuesFound || 0,
    recommendations: audit.recommendations || [],
    failures: audit.failures || [],
    learnings: audit.learnings || [],
    durationMs: audit.durationMs || 0,
    ts: audit.ts || new Date().toISOString(),
  };

  const log = readStoreList(store, AUDIT_KEY, MAX_AUDITS);
  log.unshift(entry);
  writeStoreList(store, AUDIT_KEY, log, MAX_AUDITS);
  await syncToPrisma(projectId, AUDIT_KEY, log);

  for (const l of entry.learnings || []) {
    await appendLearning(store, { topic: 'daily-audit', insight: l, source: 'audit' });
  }

  return entry;
}

async function saveDailyRecommendations(store, recommendations = []) {
  const projectId = getProjectId(store);
  const payload = {
    generatedAt: new Date().toISOString(),
    count: recommendations.length,
    items: recommendations,
  };
  store.setItem(RECS_KEY, JSON.stringify(payload));
  await syncToPrisma(projectId, RECS_KEY, payload);
  return payload;
}

function getJournal(store) {
  return readStoreList(store, JOURNAL_KEY, MAX_JOURNAL);
}

function getAuditLog(store) {
  return readStoreList(store, AUDIT_KEY, MAX_AUDITS);
}

function getLearningMemory(store) {
  return readStoreList(store, LEARNING_KEY, MAX_LEARNING);
}

function getDailyRecommendations(store) {
  return parseJson(store.getItem(RECS_KEY), { generatedAt: null, count: 0, items: [] });
}

function formatJournalForPrompt(store) {
  const journal = getJournal(store).slice(0, 8);
  const learning = getLearningMemory(store).slice(0, 6);
  const recs = getDailyRecommendations(store);

  if (!journal.length && !learning.length && !recs.items?.length) return '';

  const lines = ['', '--- SELF-HEAL INTELLIGENCE (errors · fixes · learnings) ---'];

  const openErrors = journal.filter((j) => j.kind === 'error' && !j.resolved).slice(0, 3);
  if (openErrors.length) {
    lines.push(`Open issues: ${openErrors.map((e) => `${e.errorCode} — ${e.rootCause || e.message?.slice(0, 80)}`).join('; ')}`);
  }

  const recentFixes = journal.filter((j) => j.kind === 'fix').slice(0, 2);
  if (recentFixes.length) {
    lines.push(`Recent fixes: ${recentFixes.map((f) => f.fixAction || f.message?.slice(0, 60)).join('; ')}`);
  }

  if (learning.length) {
    lines.push(`Learned patterns: ${learning.slice(0, 3).map((l) => l.insight).join(' | ')}`);
  }

  if (recs.items?.length) {
    lines.push(`Daily recommendations (${recs.generatedAt?.slice(0, 10) || 'today'}):`);
    for (const r of recs.items.slice(0, 5)) {
      lines.push(`- [${r.category || r.topic}] ${r.title}: ${r.action}`);
    }
  }

  lines.push('Reference documented errors/fixes when advising. Suggest SI module routes for each recommendation.');
  lines.push('--- END SELF-HEAL INTELLIGENCE ---');
  return lines.join('\n');
}

module.exports = {
  JOURNAL_KEY,
  AUDIT_KEY,
  RECS_KEY,
  LEARNING_KEY,
  appendErrorJournal,
  appendFixJournal,
  appendLearning,
  appendAuditLog,
  saveDailyRecommendations,
  getJournal,
  getAuditLog,
  getLearningMemory,
  getDailyRecommendations,
  formatJournalForPrompt,
};