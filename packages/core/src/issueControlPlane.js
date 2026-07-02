/**
 * THEE_MICHAEL Issue Control Plane — Web-Augmented GitOps Review Console.
 * Additive to Guardian Gatekeeper; sovereign base rules remain immutable.
 */
const crypto = require('crypto');
const path = require('path');
const { runWebAugmentedRepair, fingerprintError, ADMIN_EMAILS } = require('./webAugmentedRepair');

function assertIssueControlAdmin(store) {
  const ctx = store?._invokeContext;
  // Desktop/local IPC — no SaaS user context; local operator is trusted.
  if (!ctx?.email) return { ok: true };
  try {
    const { isPlatformAdmin } = require(path.join(__dirname, '../../../apps/desktop/services/keys'));
    if (isPlatformAdmin(ctx.email)) return { ok: true };
  } catch { /* fallback below */ }
  const email = String(ctx.email).trim().toLowerCase();
  if (ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email)) return { ok: true };
  return { ok: false, error: 'Authorized administrator required (THEE_MICHAEL)' };
}

const STORAGE_ACTIVE = 'platformIssuesActive';
const STORAGE_LEDGER = 'platformIssuesLedger';
const MAX_ACTIVE = 100;
const MAX_LEDGER = 500;

function parseJson(raw, fallback) {
  try { return JSON.parse(raw || ''); } catch { return fallback; }
}

function readActive(store) {
  return parseJson(store.getItem(STORAGE_ACTIVE), []);
}

function writeActive(store, items) {
  store.setItem(STORAGE_ACTIVE, JSON.stringify(items.slice(0, MAX_ACTIVE)));
}

function readLedger(store) {
  return parseJson(store.getItem(STORAGE_LEDGER), []);
}

function writeLedger(store, items) {
  store.setItem(STORAGE_LEDGER, JSON.stringify(items.slice(0, MAX_LEDGER)));
}

function getProjectId(store) {
  return store.getItem('saasProjectId') || store.getItem('activeCampaignId') || 'default';
}

async function persistIssuePrisma(projectId, issue) {
  try {
    const { prisma } = require('@si/db');
    return prisma.platformIssue.upsert({
      where: { id: issue.id },
      create: {
        id: issue.id,
        projectId,
        status: issue.status,
        severity: issue.severity,
        issueSignature: issue.issueSignature,
        filePath: issue.filePath,
        component: issue.component,
        platform: issue.platform,
        errorCode: issue.errorCode,
        traceback: issue.traceback,
        rootCause: issue.rootCause,
        patchDiff: issue.patchDiff,
        patchCode: issue.patchCode,
        webSources: JSON.stringify(issue.webSources || []),
        nodeId: issue.nodeId,
        dependencies: issue.dependencies,
        emailSentAt: issue.emailSentAt ? new Date(issue.emailSentAt) : null,
      },
      update: {
        status: issue.status,
        rootCause: issue.rootCause,
        patchDiff: issue.patchDiff,
        patchCode: issue.patchCode,
        webSources: JSON.stringify(issue.webSources || []),
        emailSentAt: issue.emailSentAt ? new Date(issue.emailSentAt) : undefined,
        updatedAt: new Date(),
      },
    });
  } catch {
    return null;
  }
}

async function appendLedgerPrisma(projectId, entry) {
  try {
    const { prisma } = require('@si/db');
    return prisma.platformIssueLedger.create({
      data: {
        id: entry.id,
        projectId,
        issueId: entry.issueId,
        action: entry.action,
        issueSignature: entry.issueSignature,
        traceback: entry.traceback,
        patchCode: entry.patchCode,
        outcome: entry.outcome,
        deploymentMetrics: entry.deploymentMetrics,
        actedBy: entry.actedBy,
      },
    });
  } catch {
    return null;
  }
}

async function dispatchDiagnosticEmail(store, issue, resolveKeys) {
  const keys = resolveKeys ? resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}')) : {};
  const path = require('path');
  let emailService;
  try {
    emailService = require(path.join(__dirname, '../../../apps/desktop/services/emailService'));
  } catch {
    return { success: false, error: 'emailService unavailable' };
  }

  const adminTo = keys.adminAlertEmail || process.env.ADMIN_ALERT_EMAIL || ADMIN_EMAILS[0];
  const subject = `[Social Imperialism] Runtime Issue ${issue.issueSignature} — ${issue.severity}`;
  const html = `
    <h2>THEE_MICHAEL Diagnostic Dispatch</h2>
    <p><strong>Timestamp:</strong> ${issue.createdAt || new Date().toISOString()}</p>
    <p><strong>Node:</strong> ${issue.nodeId || process.env.HOSTNAME || 'desktop'}</p>
    <p><strong>File:</strong> ${issue.filePath || 'n/a'}</p>
    <p><strong>Component:</strong> ${issue.component || 'n/a'}</p>
    <p><strong>Platform:</strong> ${issue.platform || 'multi'}</p>
    <p><strong>Error:</strong> ${issue.errorCode || 'RUNTIME_EXCEPTION'}</p>
    <h3>Root Cause</h3>
    <pre>${issue.rootCause || 'Analysis pending'}</pre>
    <h3>Traceback</h3>
    <pre>${String(issue.traceback || '').slice(0, 4000)}</pre>
    <h3>Remediation Patch Preview</h3>
    <pre>${String(issue.patchCode || '').slice(0, 6000)}</pre>
    <p>Review at <a href="https://www.socialimperialism.com/dashboard/issues">/dashboard/issues</a></p>
  `;

  const sent = await emailService.sendEmail(keys, {
    to: adminTo,
    subject,
    html,
    text: `${issue.rootCause}\n\n${issue.traceback}`,
  });
  return sent;
}

async function interceptRuntimeIssue(store, payload = {}, deps = {}) {
  const { resolveKeys } = deps;
  const keys = resolveKeys ? resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}')) : {};
  const repair = await runWebAugmentedRepair(payload, keys);

  const issue = {
    id: `iss_${crypto.randomBytes(8).toString('hex')}`,
    status: 'pending',
    severity: payload.severity || (/critical|Cannot find module/i.test(payload.traceback || '') ? 'high' : 'medium'),
    issueSignature: repair.issueSignature,
    filePath: payload.filePath || null,
    component: payload.component || null,
    platform: payload.platform || null,
    errorCode: payload.errorCode || 'RUNTIME_EXCEPTION',
    traceback: String(payload.traceback || '').slice(0, 12000),
    rootCause: repair.rootCause,
    patchDiff: repair.patchDiff,
    patchCode: repair.patchCode,
    webSources: repair.webSources,
    nodeId: payload.nodeId || null,
    dependencies: payload.dependencies ? JSON.stringify(payload.dependencies) : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const active = readActive(store);
  const dupe = active.find((x) => x.issueSignature === issue.issueSignature && x.status === 'pending');
  if (!dupe) {
    active.unshift(issue);
    writeActive(store, active);
  }

  const projectId = getProjectId(store);
  await persistIssuePrisma(projectId, issue);

  const emailResult = await dispatchDiagnosticEmail(store, issue, resolveKeys);
  if (emailResult?.success) {
    issue.emailSentAt = new Date().toISOString();
    const idx = readActive(store).findIndex((x) => x.id === issue.id);
    if (idx >= 0) {
      const next = readActive(store);
      next[idx].emailSentAt = issue.emailSentAt;
      writeActive(store, next);
    }
  }

  if (deps.handlers?.['dispatch-outbound-webhook']) {
    try {
      await deps.handlers['dispatch-outbound-webhook'](null, {
        eventType: 'issue.intercepted',
        data: { issueId: issue.id, signature: issue.issueSignature, severity: issue.severity },
      });
    } catch { /* optional */ }
  }

  try {
    const { appendErrorJournal } = require('./selfHealJournal');
    await appendErrorJournal(store, {
      source: 'issue-control',
      severity: issue.severity,
      errorCode: issue.errorCode,
      message: issue.traceback,
      rootCause: issue.rootCause,
      suggestedFix: issue.patchCode ? 'Review web-augmented patch in Issue Control' : 'Run Guardian scan and reconnect integrations',
      component: issue.component,
      issueSignature: issue.issueSignature,
      learning: issue.rootCause,
    });
  } catch { /* self-heal journal optional */ }

  return { success: true, issue, emailResult, duplicate: !!dupe };
}

function moveToLedger(store, issue, action, meta = {}) {
  const entry = {
    id: `led_${crypto.randomBytes(8).toString('hex')}`,
    issueId: issue.id,
    action,
    issueSignature: issue.issueSignature,
    traceback: issue.traceback,
    patchCode: issue.patchCode,
    outcome: meta.outcome || null,
    deploymentMetrics: meta.deploymentMetrics ? JSON.stringify(meta.deploymentMetrics) : null,
    actedBy: meta.actedBy || 'THEE_MICHAEL',
    createdAt: new Date().toISOString(),
  };
  const ledger = readLedger(store);
  ledger.unshift(entry);
  writeLedger(store, ledger);
  appendLedgerPrisma(getProjectId(store), entry);
  return entry;
}

function registerIssueControlPlaneHandlers({ ipcMain, store, handlers = {}, resolveKeys }) {
  const deps = { handlers, resolveKeys };

  const bind = (channel, fn, { adminOnly = true } = {}) => {
    const wrapped = async (...args) => {
      if (adminOnly) {
        const gate = assertIssueControlAdmin(store);
        if (!gate.ok) return { success: false, error: gate.error, code: 'ADMIN_REQUIRED' };
      }
      return fn(...args);
    };
    handlers[channel] = wrapped;
    ipcMain.handle(channel, wrapped);
  };

  bind('intercept-runtime-issue', async (_e, payload) => interceptRuntimeIssue(store, payload, deps), { adminOnly: false });

  bind('run-web-augmented-repair', async (_e, payload) => {
    const keys = resolveKeys ? resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}')) : {};
    return runWebAugmentedRepair(payload || {}, keys);
  });

  bind('get-active-issues', async () => {
    let prismaIssues = [];
    try {
      const { prisma } = require('@si/db');
      const projectId = getProjectId(store);
      prismaIssues = await prisma.platformIssue.findMany({
        where: { projectId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: MAX_ACTIVE,
      });
    } catch { /* desktop-only */ }
    const local = readActive(store).filter((x) => x.status === 'pending');
    const merged = prismaIssues.length
      ? prismaIssues.map((r) => ({
        ...r,
        webSources: parseJson(r.webSources, []),
      }))
      : local;
    return { success: true, issues: merged, count: merged.length };
  });

  bind('get-issues-ledger', async () => {
    let prismaLedger = [];
    try {
      const { prisma } = require('@si/db');
      prismaLedger = await prisma.platformIssueLedger.findMany({
        where: { projectId: getProjectId(store) },
        orderBy: { createdAt: 'desc' },
        take: MAX_LEDGER,
      });
    } catch { /* ignore */ }
    const local = readLedger(store);
    return { success: true, ledger: prismaLedger.length ? prismaLedger : local, count: (prismaLedger.length || local.length) };
  });

  bind('approve-issue-patch', async (_e, payload = {}) => {
    const { issueId, actedBy } = payload;
    const active = readActive(store);
    const idx = active.findIndex((x) => x.id === issueId);
    if (idx < 0) return { success: false, error: 'Issue not found' };

    const issue = { ...active[idx], status: 'approved', updatedAt: new Date().toISOString() };
    active.splice(idx, 1);
    writeActive(store, active);

    let sandbox = { success: true, message: 'Patch approved — queued for 3-tier sandbox validation' };
    if (handlers['run-guardian-sandbox-test']) {
      try {
        sandbox = await handlers['run-guardian-sandbox-test'](null, { issueId, patchCode: issue.patchCode });
      } catch (e) {
        sandbox = { success: false, error: e.message };
      }
    }

    const ledgerEntry = moveToLedger(store, issue, 'approve', {
      actedBy,
      outcome: sandbox.success ? 'approved_and_sandbox_passed' : 'approved_sandbox_failed',
      deploymentMetrics: sandbox,
    });

    await persistIssuePrisma(getProjectId(store), issue);

    if (handlers['dispatch-outbound-webhook']) {
      try {
        await handlers['dispatch-outbound-webhook'](null, { eventType: 'issue.approved', data: { issueId, ledgerId: ledgerEntry.id } });
      } catch { /* ignore */ }
    }

    return { success: true, issue, sandbox, ledgerEntry };
  });

  bind('deny-issue-patch', async (_e, payload = {}) => {
    const { issueId, actedBy, quarantinePlatform } = payload;
    const active = readActive(store);
    const idx = active.findIndex((x) => x.id === issueId);
    if (idx < 0) return { success: false, error: 'Issue not found' };

    const issue = { ...active[idx], status: 'denied', updatedAt: new Date().toISOString() };
    active.splice(idx, 1);
    writeActive(store, active);

    const ledgerEntry = moveToLedger(store, issue, 'deny', {
      actedBy,
      outcome: quarantinePlatform ? `quarantined:${issue.platform || 'multi'}` : 'denied_no_deploy',
    });

    return { success: true, issue, ledgerEntry, quarantined: !!quarantinePlatform };
  });

  bind('delete-issue', async (_e, payload = {}) => {
    const { issueId, fromLedger, ledgerId, actedBy } = payload;

    if (fromLedger && ledgerId) {
      const ledger = readLedger(store).filter((x) => x.id !== ledgerId);
      writeLedger(store, ledger);
      try {
        const { prisma } = require('@si/db');
        await prisma.platformIssueLedger.deleteMany({ where: { id: ledgerId } });
      } catch { /* ignore */ }
      return { success: true, removed: ledgerId, scope: 'ledger' };
    }

    const active = readActive(store);
    const issue = active.find((x) => x.id === issueId);
    const next = active.filter((x) => x.id !== issueId);
    writeActive(store, next);
    if (issue) moveToLedger(store, issue, 'delete', { actedBy, outcome: 'removed_from_queue' });
    return { success: true, removed: issueId, scope: 'active' };
  });

  bind('edit-issue-patch', async (_e, payload = {}) => {
    const { issueId, patchCode, rootCause, actedBy } = payload;
    const active = readActive(store);
    const idx = active.findIndex((x) => x.id === issueId);
    if (idx < 0) return { success: false, error: 'Issue not found' };

    active[idx] = {
      ...active[idx],
      patchCode: patchCode ?? active[idx].patchCode,
      rootCause: rootCause ?? active[idx].rootCause,
      updatedAt: new Date().toISOString(),
      editedBy: actedBy || 'THEE_MICHAEL',
    };
    writeActive(store, active);
    await persistIssuePrisma(getProjectId(store), active[idx]);
    return { success: true, issue: active[idx] };
  });

  bind('dispatch-issue-diagnostic-email', async (_e, payload = {}) => {
    const { issueId } = payload;
    const issue = readActive(store).find((x) => x.id === issueId);
    if (!issue) return { success: false, error: 'Issue not found' };
    const emailResult = await dispatchDiagnosticEmail(store, issue, resolveKeys);
    return { success: !!emailResult?.success, emailResult };
  });

  bind('queue-issue-from-guardian-alert', async (_e, alert = {}) => {
    return interceptRuntimeIssue(store, {
      filePath: alert.module || 'guardian-scan',
      component: alert.module,
      platform: alert.platform,
      severity: alert.severity,
      traceback: `${alert.summary}\nRecommended: ${alert.recommendedAction || ''}`,
      errorCode: 'GUARDIAN_ALERT',
    }, deps);
  }, { adminOnly: false });

  console.log('[issueControlPlane] THEE_MICHAEL Web-Augmented GitOps console registered');
}

function installProcessErrorInterceptors(store, deps = {}) {
  const onError = async (err) => {
    try {
      await interceptRuntimeIssue(store, {
        traceback: err?.stack || String(err),
        errorCode: err?.code || 'UNCAUGHT_EXCEPTION',
        filePath: 'main-process',
        component: 'electron-main',
        severity: 'critical',
      }, deps);
    } catch { /* never throw from interceptor */ }
  };
  process.on('uncaughtException', onError);
  process.on('unhandledRejection', (reason) => onError(reason instanceof Error ? reason : new Error(String(reason))));
}

module.exports = {
  registerIssueControlPlaneHandlers,
  installProcessErrorInterceptors,
  interceptRuntimeIssue,
  fingerprintError,
};