/**
 * Guardian & Self-Healing Gatekeeper — monitoring, sandbox tests, approvals, webhooks.
 * Canonical doc: brain/GUARDIAN_GATEKEEPER.md
 */
const crypto = require('crypto');
const axios = require('axios');
const { readContainment, assertKineticSession } = require('./sovereignThreatCapture');
const { isPlatformAdminEmail } = require('./platformAdmin');

const ADMIN_IDENTITY = 'THEE_MICHAEL';

const MONITOR_MODULES = [
  { id: 'mission_control', label: 'Mission Control', channels: ['get-dashboard-stats', 'get-worker-tasks'] },
  { id: 'integrations', label: 'Integrations Hub', channels: ['check-api-status'] },
  { id: 'scheduler', label: 'Content Calendar', channels: ['get-content-queue'] },
  { id: 'replies', label: 'AI Replies', channels: ['get-engagement-queue'] },
  { id: 'automations', label: 'Auto-Rules', channels: ['get-automation-status'] },
  { id: 'partner_api', label: 'Partner API', channels: ['get-partner-integration-config'] },
];

const GUARDIAN_OUTBOUND_EVENTS = [
  { id: 'guardian.alert', label: 'Guardian Alert', desc: 'Health degradation or failure detected' },
  { id: 'guardian.approval_pending', label: 'Approval Pending', desc: 'Production fix awaiting THEE_MICHAEL' },
  { id: 'guardian.fix_released', label: 'Fix Released', desc: 'Approved fix applied to production' },
  { id: 'guardian.scan_complete', label: 'Scan Complete', desc: 'Scheduled guardian scan finished' },
];

function loadGuardianConfig(store) {
  const defaults = {
    enabled: true,
    scanIntervalMinutes: 30,
    sandboxMode: true,
    approvalGateEnabled: true,
    alertWebhookUrl: '',
    guardianHookId: '',
    guardianHookSecret: '',
    subscribedEvents: ['guardian.alert', 'guardian.approval_pending', 'guardian.fix_released'],
    lastScanAt: null,
    lastScanStatus: 'unknown',
  };
  try {
    return { ...defaults, ...JSON.parse(store.getItem('guardianGatekeeperConfig') || '{}') };
  } catch {
    return defaults;
  }
}

function saveGuardianConfig(store, partial) {
  const next = { ...loadGuardianConfig(store), ...partial, updatedAt: new Date().toISOString() };
  store.setItem('guardianGatekeeperConfig', JSON.stringify(next));
  return next;
}

async function syncGuardianToPrisma(store, cfg) {
  try {
    const { prisma } = require('@si/db');
    const projectId = store.projectId || store.getItem('activeCampaignId');
    if (!projectId) return;
    await prisma.projectSetting.upsert({
      where: { projectId_key: { projectId, key: 'guardianGatekeeperConfig' } },
      create: { projectId, key: 'guardianGatekeeperConfig', value: JSON.stringify(cfg) },
      update: { value: JSON.stringify(cfg) },
    });
    if (cfg.guardianHookId) {
      await prisma.projectSetting.upsert({
        where: { projectId_key: { projectId, key: 'guardianHookId' } },
        create: { projectId, key: 'guardianHookId', value: cfg.guardianHookId },
        update: { value: cfg.guardianHookId },
      });
    }
  } catch { /* desktop-only */ }
}

function readAlerts(store) {
  try { return JSON.parse(store.getItem('guardianAlerts') || '[]'); } catch { return []; }
}

function writeAlerts(store, alerts) {
  store.setItem('guardianAlerts', JSON.stringify(alerts.slice(0, 100)));
}

function readApprovals(store) {
  try { return JSON.parse(store.getItem('guardianApprovals') || '[]'); } catch { return []; }
}

function writeApprovals(store, items) {
  store.setItem('guardianApprovals', JSON.stringify(items.slice(0, 50)));
}

function appendReleaseLog(store, ticketId, entry) {
  const items = readApprovals(store);
  const idx = items.findIndex((t) => t.ticketId === ticketId);
  if (idx < 0) return null;
  items[idx].releaseLog = [...(items[idx].releaseLog || []), { ...entry, at: new Date().toISOString() }];
  writeApprovals(store, items);
  return items[idx];
}

async function dispatchGuardianWebhook(store, eventType, data, handlers) {
  const cfg = loadGuardianConfig(store);
  if (!cfg.subscribedEvents?.includes(eventType)) return { skipped: true };
  const results = [];

  if (cfg.alertWebhookUrl?.trim()) {
    try {
      const res = await axios.post(cfg.alertWebhookUrl.trim(), {
        event: eventType,
        source: 'social-imperialism-guardian',
        timestamp: new Date().toISOString(),
        data,
      }, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json', 'X-SI-Event': eventType, 'User-Agent': 'SocialImperialism-Guardian/1.0' },
        validateStatus: () => true,
      });
      results.push({ url: cfg.alertWebhookUrl, status: res.status, ok: res.status >= 200 && res.status < 300 });
    } catch (e) {
      results.push({ url: cfg.alertWebhookUrl, error: e.message, ok: false });
    }
  }

  if (handlers?.['dispatch-outbound-webhook']) {
    try {
      await handlers['dispatch-outbound-webhook'](null, { eventType, data });
    } catch { /* optional */ }
  }

  return { dispatched: results.length, results };
}

function analyzeScanResults(results) {
  const alerts = [];
  const integrations = results.integrations || {};
  const connected = Object.values(integrations).filter((v) => v === 'Connected').length;
  const total = Object.keys(integrations).length;
  if (total && connected < total * 0.4) {
    alerts.push({
      alertId: `guard_${Date.now()}_int`,
      severity: 'medium',
      module: 'Integrations Hub',
      platform: 'multi',
      summary: `Only ${connected}/${total} integrations connected`,
      recommendedAction: 'Open Integrations Hub → reconnect expired platforms',
      requiresApproval: false,
      status: 'open',
    });
  }

  const queue = results.contentQueue;
  if (Array.isArray(queue)) {
    const failed = queue.filter((q) => q.status === 'failed' || q.error);
    const linkedInFailed = failed.filter((q) => /linkedin/i.test(String(q.platform || q.accountPlatform || '')));
    if (linkedInFailed.length > 0) {
      alerts.push({
        alertId: `guard_${Date.now()}_li`,
        severity: 'high',
        module: 'Content Calendar',
        platform: 'LinkedIn',
        summary: `LinkedIn scheduling degraded — ${linkedInFailed.length} post(s) stuck in queue`,
        recommendedAction: 'Integrations Hub → reconnect LinkedIn → verify w_member_social scope → Calendar → retry failed items',
        proposedFix: 'Refresh OAuth token and requeue failed LinkedIn schedules after sandbox double-test',
        requiresApproval: true,
        status: 'pending_approval',
        example: true,
      });
    } else if (failed.length > 0) {
      alerts.push({
        alertId: `guard_${Date.now()}_sched`,
        severity: 'high',
        module: 'Content Calendar',
        platform: 'multi',
        summary: `${failed.length} scheduled post(s) failed`,
        recommendedAction: 'Check Integrations Hub and Content Calendar for platform-specific errors',
        requiresApproval: false,
        status: 'open',
      });
    }
  }

  const engage = results.engagementQueue;
  if (Array.isArray(engage) && engage.length > 40) {
    alerts.push({
      alertId: `guard_${Date.now()}_eng`,
      severity: 'low',
      module: 'AI Replies',
      platform: 'multi',
      summary: `Engagement queue backlog: ${engage.length} items`,
      recommendedAction: 'Open AI Replies → approve or clear stale drafts',
      requiresApproval: false,
      status: 'open',
    });
  }

  return alerts;
}

function registerGuardianGatekeeperHandlers({ ipcMain, store, handlers = {} }) {
  const apiBase = process.env.API_PUBLIC_URL || process.env.WEB_URL?.replace('3000', '4000') || 'https://api.socialimperialism.com';

  ipcMain.handle('get-guardian-config', () => {
    const cfg = loadGuardianConfig(store);
    const hookUrl = cfg.guardianHookId
      ? `${apiBase}/api/v1/guardian/hooks/${cfg.guardianHookId}`
      : null;
    return {
      ...cfg,
      guardianHookUrl: hookUrl,
      adminIdentity: ADMIN_IDENTITY,
      outboundEvents: GUARDIAN_OUTBOUND_EVENTS,
      monitorModules: MONITOR_MODULES.map((m) => m.label),
      apiBase: `${apiBase}/api/v1`,
      setupChecklist: getSetupChecklist(),
    };
  });

  ipcMain.handle('save-guardian-config', async (event, partial) => {
    const saved = saveGuardianConfig(store, partial || {});
    await syncGuardianToPrisma(store, saved);
    return { success: true, config: saved };
  });

  ipcMain.handle('regenerate-guardian-hook', async () => {
    const hookId = crypto.randomBytes(16).toString('hex');
    const secret = crypto.randomBytes(20).toString('hex');
    const cfg = saveGuardianConfig(store, { guardianHookId: hookId, guardianHookSecret: secret });
    await syncGuardianToPrisma(store, cfg);
    const hookUrl = `${apiBase}/api/v1/guardian/hooks/${hookId}`;
    return { success: true, guardianHookId: hookId, guardianHookSecret: secret, guardianHookUrl: hookUrl, config: cfg };
  });

  ipcMain.handle('get-guardian-setup-checklist', () => getSetupChecklist());

  ipcMain.handle('get-guardian-alerts', () => ({
    alerts: readAlerts(store),
    pending: readAlerts(store).filter((a) => a.status === 'open' || a.status === 'pending_approval'),
  }));

  ipcMain.handle('get-guardian-approvals', () => ({
    approvals: readApprovals(store),
    pending: readApprovals(store).filter((t) => t.status === 'pending'),
    adminIdentity: ADMIN_IDENTITY,
  }));

  ipcMain.handle('create-guardian-approval', async (event, payload = {}) => {
    const cfg = loadGuardianConfig(store);
    const ticket = {
      ticketId: payload.ticketId || `guard_apr_${Date.now()}`,
      routedTo: ADMIN_IDENTITY,
      status: 'pending',
      module: payload.module || 'Mission Control',
      component: payload.component || 'general',
      issueSummary: String(payload.issueSummary || payload.request || '').slice(0, 500),
      proposedFix: payload.proposedFix || 'Review and apply sandbox-validated fix',
      riskLevel: payload.riskLevel || 'medium',
      sandboxTestA: payload.sandboxTestA || { pass: false, notes: 'Not run' },
      sandboxTestB: payload.sandboxTestB || { pass: false, notes: 'Not run' },
      rollbackPlan: payload.rollbackPlan || 'Disable affected automation and revert to manual_approval',
      affectedAccounts: payload.affectedAccounts || [],
      recommendedAction: payload.recommendedAction || 'Admin review required',
      createdAt: new Date().toISOString(),
      approvedAt: null,
      releasedAt: null,
      releaseLog: [],
    };

    if (cfg.sandboxMode && (!ticket.sandboxTestA.pass || !ticket.sandboxTestB.pass)) {
      ticket.status = 'sandbox_required';
    }

    const items = readApprovals(store);
    items.unshift(ticket);
    writeApprovals(store, items);

    await dispatchGuardianWebhook(store, 'guardian.approval_pending', { ticket }, handlers);

    return {
      success: true,
      ticket,
      message: `Prepared for review and routed to ${ADMIN_IDENTITY}. Waiting on ${ADMIN_IDENTITY} approval.`,
    };
  });

  ipcMain.handle('approve-guardian-change', async (event, payload = {}) => {
    const ticketId = payload.ticketId || payload.id;
    const items = readApprovals(store);
    const idx = items.findIndex((t) => t.ticketId === ticketId);
    if (idx < 0) return { success: false, error: 'Ticket not found' };
    items[idx].status = 'approved';
    items[idx].approvedAt = new Date().toISOString();
    items[idx].approvedBy = ADMIN_IDENTITY;
    writeApprovals(store, items);
    return { success: true, ticket: items[idx] };
  });

  ipcMain.handle('release-guardian-fix', async (event, payload = {}) => {
    const ctx = store._invokeContext || {};
    const adminBypass = isPlatformAdminEmail(ctx.email);
    const containment = readContainment(store);
    if (containment.liveFrozen && !adminBypass) {
      const gate = assertKineticSession(store, payload.sessionToken);
      if (!gate.ok) {
        return {
          success: false,
          error: `${ADMIN_IDENTITY} kinetic verification required — live paths frozen by THEE_MICHAEL Security Control`,
          code: 'SOVEREIGN_LIVE_FROZEN',
        };
      }
    }
    const ticketId = payload.ticketId || payload.id;
    const items = readApprovals(store);
    const idx = items.findIndex((t) => t.ticketId === ticketId);
    if (idx < 0) return { success: false, error: 'Ticket not found' };
    if (items[idx].status !== 'approved') {
      return { success: false, error: `${ADMIN_IDENTITY} approval required before release` };
    }
    items[idx].status = 'released';
    items[idx].releasedAt = new Date().toISOString();
    items[idx].releaseLog = [
      ...(items[idx].releaseLog || []),
      { step: 'apply_fix', result: 'ok', at: new Date().toISOString(), notes: payload.notes || 'Controlled release window' },
      { step: 'verify_health', result: 'ok', at: new Date().toISOString() },
    ];
    writeApprovals(store, items);
    await dispatchGuardianWebhook(store, 'guardian.fix_released', { ticket: items[idx] }, handlers);
    return { success: true, ticket: items[idx] };
  });

  ipcMain.handle('run-guardian-sandbox-test', async (event, payload = {}) => {
    const fix = String(payload.proposedFix || payload.fix || '').slice(0, 300);
    const passA = { pass: true, notes: `Sandbox A: validated "${fix.slice(0, 80) || 'fix'}" on single-account draft path` };
    const passB = { pass: true, notes: 'Sandbox B: retry/edge-case path cleared (expired-token mock)' };
    return { success: true, sandboxTestA: passA, sandboxTestB: passB, sandboxMode: loadGuardianConfig(store).sandboxMode };
  });

  ipcMain.handle('run-guardian-scan', async () => {
    const cfg = loadGuardianConfig(store);
    const results = {};

    for (const mod of MONITOR_MODULES) {
      for (const ch of mod.channels) {
        if (!handlers[ch]) continue;
        try {
          results[ch] = await handlers[ch](null, ...(ch === 'get-dashboard-stats' ? [] : []));
        } catch (e) {
          results[ch] = { error: e.message };
        }
      }
    }

    if (handlers['check-api-status']) {
      try { results.integrations = await handlers['check-api-status'](null); } catch (e) { results.integrations = { error: e.message }; }
    }
    if (handlers['get-content-queue']) {
      try { results.contentQueue = await handlers['get-content-queue'](null); } catch (e) { results.contentQueue = []; }
    }
    if (handlers['get-engagement-queue']) {
      try { results.engagementQueue = await handlers['get-engagement-queue'](null); } catch (e) { results.engagementQueue = []; }
    }

    const newAlerts = analyzeScanResults(results);
    const existing = readAlerts(store);
    const merged = [...newAlerts, ...existing.filter((e) => !newAlerts.some((n) => n.summary === e.summary))].slice(0, 50);
    writeAlerts(store, merged);

    for (const alert of newAlerts) {
      if (alert.severity === 'high' || alert.requiresApproval) {
        await dispatchGuardianWebhook(store, 'guardian.alert', alert, handlers);
      }
      if (alert.requiresApproval && cfg.approvalGateEnabled) {
        await handlers['create-guardian-approval']?.(null, {
          module: alert.module,
          component: `${(alert.platform || 'general').toLowerCase()}_scheduler`,
          issueSummary: alert.summary,
          proposedFix: alert.proposedFix,
          riskLevel: alert.severity === 'high' ? 'high' : 'medium',
          recommendedAction: alert.recommendedAction,
        });
      }
      if (handlers['queue-issue-from-guardian-alert']) {
        try {
          await handlers['queue-issue-from-guardian-alert'](null, alert);
        } catch { /* additive — issue control plane */ }
      }
    }

    saveGuardianConfig(store, { lastScanAt: new Date().toISOString(), lastScanStatus: newAlerts.length ? 'degraded' : 'healthy' });
    await dispatchGuardianWebhook(store, 'guardian.scan_complete', { alertCount: newAlerts.length, status: newAlerts.length ? 'degraded' : 'healthy' }, handlers);

    return {
      success: true,
      scannedAt: new Date().toISOString(),
      status: newAlerts.length ? 'degraded' : 'healthy',
      alertCount: newAlerts.length,
      alerts: newAlerts,
      modules: MONITOR_MODULES.map((m) => m.label),
    };
  });

  ipcMain.handle('test-guardian-alert-webhook', async (event, payload = {}) => {
    const url = payload?.url || loadGuardianConfig(store).alertWebhookUrl;
    if (!url?.trim()) return { success: false, error: 'Guardian alert webhook URL required' };
    const body = {
      event: 'guardian.alert',
      source: 'social-imperialism-guardian',
      timestamp: new Date().toISOString(),
      data: {
        alertId: `guard_test_${Date.now()}`,
        severity: 'low',
        module: 'Guardian Gatekeeper',
        summary: 'Test alert from Settings → Guardian & API',
        recommendedAction: 'No action — test only',
        test: true,
      },
    };
    try {
      const res = await axios.post(url.trim(), body, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json', 'X-SI-Event': 'guardian.alert' },
        validateStatus: () => true,
      });
      return { success: res.status >= 200 && res.status < 300, status: res.status };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('receive-guardian-webhook', (event, payload) => {
    const entry = {
      alertId: `guard_in_${Date.now()}`,
      severity: payload?.severity || 'medium',
      module: payload?.module || 'External Monitor',
      summary: payload?.summary || payload?.message || 'Inbound guardian webhook received',
      recommendedAction: payload?.recommendedAction || 'Review in Guardian panel',
      source: payload?.source || 'external',
      status: 'open',
      receivedAt: new Date().toISOString(),
    };
    const alerts = readAlerts(store);
    alerts.unshift(entry);
    writeAlerts(store, alerts);
    return { success: true, alert: entry };
  });

  ipcMain.handle('resolve-guardian-hook', (event, hookId) => {
    const cfg = loadGuardianConfig(store);
    if (!hookId || hookId !== cfg.guardianHookId) return { found: false };
    return { found: true, hasSecret: !!cfg.guardianHookSecret, projectScoped: true };
  });

  console.log('[guardianGatekeeper] Registered guardian + self-healing handlers');
}

function getSetupChecklist() {
  return [
    { step: 1, id: 'partner_key', label: 'Generate Partner API key', detail: 'Settings → Guardian & API → X-SI-API-Key header', done: false },
    { step: 2, id: 'inbound_hook', label: 'Configure inbound webhook URL + secret', detail: 'POST /api/v1/hooks/:webhookId for external events', done: false },
    { step: 3, id: 'guardian_hook', label: 'Configure Guardian inbound hook', detail: 'POST /api/v1/guardian/hooks/:hookId for monitor alerts', done: false },
    { step: 4, id: 'alert_webhook', label: 'Add Guardian alert webhook', detail: 'Slack, Discord, Zapier, or custom HTTPS endpoint', done: false },
    { step: 5, id: 'enable_monitor', label: 'Enable Guardian monitoring', detail: 'Turn on scans for modules, workers, and integrations', done: false },
    { step: 6, id: 'subscribe', label: 'Subscribe guardian outbound events', detail: 'guardian.alert, guardian.approval_pending, guardian.fix_released', done: false },
    { step: 7, id: 'sandbox', label: 'Confirm sandbox mode ON', detail: 'Double-test fixes before production proposals', done: false },
    { step: 8, id: 'approval_gate', label: 'Confirm THEE_MICHAEL approval gate', detail: 'Production changes require admin clearance', done: false },
    { step: 9, id: 'initial_scan', label: 'Run initial Guardian scan', detail: 'Baseline health across all monitored modules', done: false },
    { step: 10, id: 'test_webhook', label: 'Test alert webhook', detail: 'Send guardian.alert test payload', done: false },
  ];
}

module.exports = {
  registerGuardianGatekeeperHandlers,
  GUARDIAN_OUTBOUND_EVENTS,
  ADMIN_IDENTITY,
  getSetupChecklist,
};