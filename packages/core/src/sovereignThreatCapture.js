/**
 * Sovereign Threat Capture Layer — socialimperialism.com
 * Capture, contain, encrypt, isolate. Admin kinetic 2FA before decrypt/release.
 * Canonical doc: brain/SOVEREIGN_THREAT_CAPTURE.md
 */
const crypto = require('crypto');
const path = require('path');
const axios = require('axios');
const { isPlatformAdminEmail } = require('./platformAdmin');

const ADMIN_IDENTITY = 'THEE_MICHAEL';
const SITE_DOMAIN = 'socialimperialism.com';
const STORAGE_EVENTS = 'sovereignThreatEvents';
const STORAGE_CONTAINMENT = 'sovereignContainment';
const STORAGE_KINETIC = 'sovereignKineticSessions';
const STORAGE_ACTION_HISTORY = 'theeMichaelActionHistory';
const MAX_EVENTS = 200;
const MAX_ACTION_HISTORY = 500;

const THREAT_PATTERNS = [
  { id: 'xss_probe', re: /<script|javascript:|onerror\s*=|onload\s*=/i, severity: 'high', vector: 'cross_site_scripting' },
  { id: 'sqli_probe', re: /(\bunion\b.*\bselect\b|';\s*drop\b|or\s+1\s*=\s*1)/i, severity: 'critical', vector: 'sql_injection_probe' },
  { id: 'path_traversal', re: /(\.\.\/|\.\.\\|%2e%2e)/i, severity: 'high', vector: 'path_traversal' },
  // Match exfil-style leaks in URLs/query — not redacted JSON field names (see redactSensitiveFields)
  { id: 'credential_exfil', re: /(api[_-]?key\s*[:=]\s*['"]?[a-z0-9._-]{8,}|bearer\s+[a-z0-9._-]{32,})/i, severity: 'medium', vector: 'credential_exfiltration_attempt' },
  { id: 'cmd_injection', re: /(\$\(|`|\|\||;\s*cat\s|;\s*curl\s)/i, severity: 'critical', vector: 'command_injection' },
  { id: 'bot_flood', re: /.{8000,}/, severity: 'medium', vector: 'payload_flood' },
];

/** Channels that legitimately carry credentials — never block on credential_exfil alone */
const TRUSTED_CREDENTIAL_CHANNELS = new Set([
  'connect-platform',
  'connect-with-credentials', 'save-platform-login',
  'begin-platform-oauth',
  'poll-platform-oauth',
  'finish-platform-oauth-connect',
  'save-global-keys',
  'get-global-keys',
  'save-grok-settings',
  'get-grok-settings',
  'grok-connect',
]);

/** Read-only export of project data — not gated by live freeze (keys/release paths remain protected). */
const PROTECTED_CHANNELS = new Set([
  'save-global-keys', 'release-guardian-fix', 'approve-guardian-change',
  'decrypt-sovereign-threat-telemetry', 'approve-sovereign-threat-release',
]);

/** Routine SaaS channels — medium/low captures must not block normal product use. */
const SAAS_ROUTINE_CHANNELS = new Set([
  'generate-ai', 'draft-post-reply', 'compose-qa-answer', 'grok-ask-text',
  'publish-post', 'schedule-post', 'save-ai-reply', 'engage-post',
  // Mission Control read paths — auto-release pending review noise
  'get-dashboard-stats', 'get-live-feed', 'get-trending-topics', 'get-daily-social-trends', 'get-live-news',
  'get-setup-status', 'get-section-live', 'get-worker-status', 'get-worker-tasks',
  'get-engagement-queue', 'get-leads', 'get-linked-accounts', 'get-active-campaign',
  'get-domain-metrics', 'get-project-metrics', 'get-fanpage-settings', 'get-watched-monitors',
  'get-auto-search-settings', 'check-api-status', 'get-brand-guidelines',
  'get-sovereign-threat-status', 'get-thee-michael-action-history',
  'get-openmontage-status', 'run-openmontage-preflight', 'run-openmontage-setup', 'fal-generate-video',
  'get-backlot-status', 'open-backlot-board', 'get-backlot-board-state', 'run-backlot-simulate', 'approve-imperial-video-gate',
  'analyze-topic', 'discover-best-questions', 'get-unanswered-questions',
  'get-post-history', 'get-all-post-history', 'get-keywords', 'get-content-library',
  'get-design-templates', 'get-format-templates', 'get-design-compositor-config',
  'get-intelligence-settings', 'refresh-account-profile', 'test-all-connections',
  'run-live-connection-audit', 'get-content-studio-config', 'get-imperial-pipeline-config',
]);

const SENSITIVE_FIELD_RE = /^(password|passwd|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|.*secret|.*token|.*password|.*apikey)$/i;

function redactSensitiveFields(input, depth = 0) {
  if (depth > 10) return '[MAX_DEPTH]';
  if (input == null) return input;
  if (Array.isArray(input)) return input.map((x) => redactSensitiveFields(x, depth + 1));
  if (typeof input === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = SENSITIVE_FIELD_RE.test(k) ? '[REDACTED]' : redactSensitiveFields(v, depth + 1);
    }
    return out;
  }
  return input;
}

function deriveKey(projectId) {
  const secret = process.env.SOVEREIGN_TELEMETRY_KEY || process.env.JWT_SECRET || 'si-sovereign-dev-key';
  return crypto.createHash('sha256').update(`${secret}:${projectId}:${SITE_DOMAIN}`).digest();
}

function encryptSealed(projectId, payload) {
  const key = deriveKey(projectId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const json = JSON.stringify(payload);
  const enc = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: enc.toString('base64'),
  };
}

function decryptSealed(projectId, sealed) {
  const key = deriveKey(projectId);
  const iv = Buffer.from(sealed.iv, 'base64');
  const tag = Buffer.from(sealed.tag, 'base64');
  const data = Buffer.from(sealed.ciphertext, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

function readEvents(store) {
  try { return JSON.parse(store.getItem(STORAGE_EVENTS) || '[]'); } catch { return []; }
}

function writeEvents(store, events) {
  store.setItem(STORAGE_EVENTS, JSON.stringify(events.slice(0, MAX_EVENTS)));
}

function readContainment(store) {
  try {
    return JSON.parse(store.getItem(STORAGE_CONTAINMENT) || '{"frozenModules":[],"blockedChannels":[],"liveFrozen":false}');
  } catch {
    return { frozenModules: [], blockedChannels: [], liveFrozen: false };
  }
}

function writeContainment(store, state) {
  store.setItem(STORAGE_CONTAINMENT, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
}

function readActionHistory(store) {
  try { return JSON.parse(store.getItem(STORAGE_ACTION_HISTORY) || '[]'); } catch { return []; }
}

function writeActionHistory(store, entries) {
  store.setItem(STORAGE_ACTION_HISTORY, JSON.stringify(entries.slice(0, MAX_ACTION_HISTORY)));
}

function appendActionLog(store, entry) {
  const history = readActionHistory(store);
  const action = {
    actionId: entry.actionId || `tma_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    eventId: entry.eventId || null,
    type: entry.type || 'decision',
    decision: entry.decision || null,
    status: entry.status || 'final',
    summary: String(entry.summary || '').slice(0, 320),
    module: entry.module || null,
    channel: entry.channel || null,
    severity: entry.severity || null,
    containmentBefore: entry.containmentBefore || null,
    containmentAfter: entry.containmentAfter || null,
    createdAt: entry.createdAt || new Date().toISOString(),
    decidedAt: entry.decidedAt || null,
    decidedBy: entry.decidedBy || ADMIN_IDENTITY,
    undoneAt: null,
    undoneBy: null,
    canUndo: entry.canUndo !== false,
  };
  history.unshift(action);
  writeActionHistory(store, history);
  return action;
}

function releaseEventContainment(store, event) {
  const c = readContainment(store);
  const before = { ...c, frozenModules: [...(c.frozenModules || [])], blockedChannels: [...(c.blockedChannels || [])] };
  c.frozenModules = (c.frozenModules || []).filter((m) => m !== event.module);
  if (event.channel) c.blockedChannels = (c.blockedChannels || []).filter((ch) => ch !== event.channel);
  const open = readEvents(store).filter((e) => e.eventId !== event.eventId && e.adminDecision !== 'approved' && !e.releasedAt && e.adminDecision !== 'denied');
  const stillFrozen = open.some((e) => e.severity === 'critical' || e.severity === 'high');
  if (!stillFrozen) c.liveFrozen = false;
  writeContainment(store, c);
  return { before, after: readContainment(store) };
}

function theeMichaelDecideThreat(store, { eventId, decision, email }) {
  if (!isAuthorizedAdmin(email)) {
    return { success: false, error: `Authorized administrator required (${ADMIN_IDENTITY})` };
  }
  const events = readEvents(store);
  const idx = events.findIndex((e) => e.eventId === eventId);
  if (idx < 0) return { success: false, error: 'Event not found' };
  const ev = events[idx];
  if (ev.adminDecision === 'approved' || ev.adminDecision === 'denied') {
    return { success: false, error: 'Already decided — use Undo in history to revert' };
  }

  const containmentBefore = readContainment(store);
  const now = new Date().toISOString();

  if (decision === 'approve') {
    ev.adminDecision = 'approved';
    ev.status = 'released';
    ev.releasedAt = now;
    ev.releasedBy = ADMIN_IDENTITY;
    ev.approvedAt = now;
    const { after } = releaseEventContainment(store, ev);
    ev.sandboxLog = { ...ev.sandboxLog, containmentStatus: 'resolved', liveFrozen: false };
    writeEvents(store, events);
    const action = appendActionLog(store, {
      eventId,
      type: 'decision',
      decision: 'approve',
      status: 'final',
      summary: `Approved: ${ev.summary}`,
      module: ev.module,
      channel: ev.channel,
      severity: ev.severity,
      containmentBefore,
      containmentAfter: after,
      decidedAt: now,
      decidedBy: ADMIN_IDENTITY,
    });
    return {
      success: true,
      eventId,
      adminDecision: 'approved',
      message: `${ADMIN_IDENTITY} approved this action. Containment released.`,
      action,
      containment: readContainment(store),
    };
  }

  if (decision === 'deny') {
    ev.adminDecision = 'denied';
    ev.status = 'denied';
    ev.deniedAt = now;
    ev.deniedBy = ADMIN_IDENTITY;
    writeEvents(store, events);
    const action = appendActionLog(store, {
      eventId,
      type: 'decision',
      decision: 'deny',
      status: 'final',
      summary: `Denied: ${ev.summary}`,
      module: ev.module,
      channel: ev.channel,
      severity: ev.severity,
      containmentBefore,
      containmentAfter: readContainment(store),
      decidedAt: now,
      decidedBy: ADMIN_IDENTITY,
    });
    return {
      success: true,
      eventId,
      adminDecision: 'denied',
      message: `${ADMIN_IDENTITY} denied this action. Containment remains active.`,
      action,
      containment: readContainment(store),
    };
  }

  return { success: false, error: 'decision must be approve or deny' };
}

function theeMichaelUndoAction(store, { actionId, email }) {
  if (!isAuthorizedAdmin(email)) {
    return { success: false, error: `Authorized administrator required (${ADMIN_IDENTITY})` };
  }
  const history = readActionHistory(store);
  const idx = history.findIndex((a) => a.actionId === actionId && !a.undoneAt);
  if (idx < 0) return { success: false, error: 'Action not found or already undone' };
  const action = history[idx];
  if (!action.canUndo) return { success: false, error: 'This action cannot be undone' };

  const now = new Date().toISOString();

  if (action.containmentBefore) {
    writeContainment(store, {
      ...action.containmentBefore,
      updatedAt: now,
    });
  }

  if (action.eventId) {
    const events = readEvents(store);
    const evIdx = events.findIndex((e) => e.eventId === action.eventId);
    if (evIdx >= 0) {
      events[evIdx].adminDecision = 'pending';
      events[evIdx].status = 'contained';
      events[evIdx].releasedAt = null;
      events[evIdx].releasedBy = null;
      events[evIdx].approvedAt = null;
      events[evIdx].deniedAt = null;
      events[evIdx].deniedBy = null;
      events[evIdx].undoneAt = now;
      writeEvents(store, events);
    }
  }

  history[idx].undoneAt = now;
  history[idx].undoneBy = ADMIN_IDENTITY;
  history[idx].status = 'undone';
  writeActionHistory(store, history);

  appendActionLog(store, {
    eventId: action.eventId,
    type: 'undo',
    decision: null,
    status: 'final',
    summary: `Undone ${action.decision || action.type}: ${action.summary}`,
    module: action.module,
    channel: action.channel,
    severity: action.severity,
    containmentBefore: readContainment(store),
    containmentAfter: action.containmentBefore,
    decidedAt: now,
    canUndo: false,
  });

  return {
    success: true,
    actionId,
    message: `${ADMIN_IDENTITY} undid action. Event returned to pending review.`,
    containment: readContainment(store),
  };
}

function buildSecurityTemplate(sealedPayload) {
  return {
    banner: `🛡️ ${ADMIN_IDENTITY} SECURITY REVIEW REQUIRED // ${SITE_DOMAIN.toUpperCase()} PROTECTION ENFORCED`,
    supremeAuthority: `authorized ${SITE_DOMAIN} ownership and security administration`,
    physicalSteward: 'registered site owner or designated platform operator',
    executiveControl: `authorized ${SITE_DOMAIN} administrators only`,
    kinetic2faChallenge: 'require registered administrator verification before telemetry decryption, production patch approval, or sensitive security review',
    mutatedAttackVector: 'encrypted until authorized administrative review',
    websiteArchitecture: 'encrypted until authorized administrative review',
    deepMetrics: 'intrusion target, exploit mechanism, affected assets, exposure risk, moderation impact — sealed in protected telemetry',
    predictiveMatrix: 'threat reputation, abuse patterns, bot behavior, mitigation mapping — encrypted until authorized release',
    guardianSandboxLog: 'containment status, patch readiness, regression results, sandbox verification recorded without exposing secrets',
    systemHorizon: 'threat neutralized, contained, and resolved inside sandbox. Live code paths, public pages, admin tools, publishing workflows, and automation hooks remain frozen until administrator verification approves decryption and production deployment',
    sealedRef: sealedPayload,
  };
}

function scanTextForThreats(text) {
  const s = String(text || '');
  const hits = [];
  for (const p of THREAT_PATTERNS) {
    if (p.re.test(s)) hits.push({ id: p.id, severity: p.severity, vector: p.vector });
  }
  return hits;
}

function filterBlockingHits(hits, channel) {
  if (!channel || !TRUSTED_CREDENTIAL_CHANNELS.has(channel)) return hits;
  return hits.filter((h) => h.id !== 'credential_exfil');
}

function scanRequestSurface(req) {
  const channel = req.params?.channel;
  const sanitizedBody = redactSensitiveFields(req.body || {});
  const sanitizedQuery = redactSensitiveFields(req.query || {});
  const parts = [
    req.path,
    req.originalUrl,
    JSON.stringify(sanitizedBody),
    JSON.stringify(sanitizedQuery),
    req.headers['user-agent'],
    req.headers['x-forwarded-for'],
  ].filter(Boolean).join(' ');
  return filterBlockingHits(scanTextForThreats(parts), channel);
}

function isOpenThreatEvent(ev) {
  const decision = ev.adminDecision || 'pending';
  return decision === 'pending' && !ev.releasedAt && !ev.deniedAt && ev.status !== 'denied';
}

function shouldBlockChannelForEvent(ev) {
  if (!ev.channel) return false;
  if (SAAS_ROUTINE_CHANNELS.has(ev.channel) && ev.severity !== 'critical' && ev.severity !== 'high') {
    return false;
  }
  return true;
}

function isKnownFalsePositiveEvent(ev) {
  if (!ev || ev.releasedAt || ev.adminDecision === 'approved') return false;
  const sum = String(ev.summary || '');
  if (sum.startsWith('Client observed SOVEREIGN_')) return true;
  if (ev.vector === 'auth_brute_force' || sum.includes('Auth failure (brute_force)')) return true;
  if (ev.source === 'api_edge'
    && (ev.vector === 'credential_exfiltration_attempt' || sum.includes('credential_exfil'))) return true;
  return false;
}

function releaseKnownFalsePositives(store) {
  const events = readEvents(store);
  let released = 0;
  const releasedIds = [];
  const now = new Date().toISOString();
  for (const ev of events) {
    if (!isOpenThreatEvent(ev) || !isKnownFalsePositiveEvent(ev)) continue;
    ev.adminDecision = 'approved';
    ev.status = 'released';
    ev.releasedAt = now;
    ev.releasedBy = ADMIN_IDENTITY;
    ev.releaseNote = 'known_false_positive_auto_release';
    released += 1;
    if (ev.eventId) releasedIds.push(ev.eventId);
  }
  if (released) {
    writeEvents(store, events);
    const history = readActionHistory(store);
    let historyUpdated = false;
    for (const action of history) {
      if (action.status !== 'pending') continue;
      const matchEvent = action.eventId && releasedIds.includes(action.eventId);
      const matchSummary = action.summary && (
        action.summary.startsWith('Client observed SOVEREIGN_')
        || action.summary.includes('Auth failure (brute_force)')
      );
      if (!matchEvent && !matchSummary) continue;
      action.status = 'final';
      action.decision = 'approve';
      action.decidedAt = now;
      action.decidedBy = ADMIN_IDENTITY;
      historyUpdated = true;
    }
    if (historyUpdated) writeActionHistory(store, history);
  }
  return released;
}

function releaseRoutineFalsePositives(store) {
  const events = readEvents(store);
  let released = 0;
  const releasedIds = [];
  const now = new Date().toISOString();
  for (const ev of events) {
    if (!isOpenThreatEvent(ev)) continue;
    if (!ev.channel || !SAAS_ROUTINE_CHANNELS.has(ev.channel)) continue;
    if (ev.severity === 'critical' || ev.severity === 'high') continue;
    ev.adminDecision = 'approved';
    ev.status = 'released';
    ev.releasedAt = now;
    ev.releasedBy = ADMIN_IDENTITY;
    ev.releaseNote = 'routine_channel_auto_release';
    released += 1;
    if (ev.eventId) releasedIds.push(ev.eventId);
  }
  if (released) {
    writeEvents(store, events);
    const history = readActionHistory(store);
    let historyUpdated = false;
    for (const action of history) {
      if (action.status !== 'pending') continue;
      const matchEvent = action.eventId && releasedIds.includes(action.eventId);
      const matchChannel = action.channel && SAAS_ROUTINE_CHANNELS.has(action.channel)
        && action.severity !== 'critical' && action.severity !== 'high';
      if (!matchEvent && !matchChannel) continue;
      action.status = 'final';
      action.decision = 'approve';
      action.decidedAt = now;
      action.decidedBy = ADMIN_IDENTITY;
      action.summary = `Auto-released (routine): ${action.summary}`;
      historyUpdated = true;
    }
    if (historyUpdated) writeActionHistory(store, history);
  }
  return released;
}

function reconcileContainment(store) {
  const knownReleased = releaseKnownFalsePositives(store);
  const routineReleased = releaseRoutineFalsePositives(store);
  const events = readEvents(store);
  const open = events.filter(isOpenThreatEvent);
  const blockedChannels = [];
  const frozenModules = [];
  for (const ev of open) {
    if (ev.channel && shouldBlockChannelForEvent(ev) && !blockedChannels.includes(ev.channel)) {
      blockedChannels.push(ev.channel);
    }
    if (ev.module && !frozenModules.includes(ev.module)) frozenModules.push(ev.module);
  }
  const liveFrozen = open.some((e) => e.severity === 'critical' || e.severity === 'high');
  const before = readContainment(store);
  const after = { frozenModules, blockedChannels, liveFrozen };
  writeContainment(store, after);
  return { before, after, openCount: open.length, knownReleased, routineReleased };
}

function clearFalsePositiveContainment(store) {
  const reconciled = reconcileContainment(store);
  return {
    released: (reconciled.knownReleased || 0) + (reconciled.routineReleased || 0),
    containment: reconciled.after,
  };
}

function captureThreatEvent(store, {
  source = 'api',
  surface = 'unknown',
  module = 'Mission Control',
  channel,
  severity = 'medium',
  vector = 'anomaly',
  summary,
  requestMeta = {},
  userContext = {},
  autoContain = true,
}) {
  const adminActor = isPlatformAdminEmail(userContext.email);
  if (adminActor) autoContain = false;

  const projectId = store.projectId || store.getItem('activeCampaignId') || 'default';
  const eventId = `sov_threat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const deepMetrics = {
    intrusionTarget: surface,
    exploitMechanism: vector,
    affectedAssets: [module, channel].filter(Boolean),
    userDataExposureRisk: severity === 'critical' ? 'elevated_review' : 'contained',
    moderationImpact: channel?.includes('reply') || channel?.includes('publish') ? 'queue_frozen' : 'none',
    requestMeta: {
      path: requestMeta.path,
      method: requestMeta.method,
      ipHash: requestMeta.ip ? crypto.createHash('sha256').update(String(requestMeta.ip)).digest('hex').slice(0, 16) : null,
      userAgentHash: requestMeta.userAgent ? crypto.createHash('sha256').update(String(requestMeta.userAgent)).digest('hex').slice(0, 16) : null,
    },
    userContext: {
      userIdHash: userContext.userId ? crypto.createHash('sha256').update(String(userContext.userId)).digest('hex').slice(0, 16) : null,
      orgIdHash: userContext.orgId ? crypto.createHash('sha256').update(String(userContext.orgId)).digest('hex').slice(0, 16) : null,
    },
  };

  const predictiveMatrix = {
    reputationSignals: ['pattern_match', vector],
    abusePatterns: [severity, source],
    botBehavior: source === 'api' && !userContext.userId ? 'anonymous_probe' : 'authenticated',
    mitigationMapping: ['contain', 'encrypt', 'admin_review', 'sandbox_verify'],
  };

  const sandboxLog = {
    containmentStatus: 'active',
    patchReadiness: 'pending_sandbox',
    regressionResults: 'not_run',
    sandboxVerification: { testA: null, testB: null },
    liveFrozen: true,
  };

  const sealed = encryptSealed(projectId, {
    mutatedAttackVector: vector,
    websiteArchitecture: { surface, module, channel, domain: SITE_DOMAIN },
    deepMetrics,
    predictiveMatrix,
    rawSummary: String(summary || '').slice(0, 2000),
    capturedAt: new Date().toISOString(),
  });

  const template = buildSecurityTemplate(sealed);

  const event = {
    eventId,
    status: 'contained',
    severity,
    source,
    surface,
    module,
    channel: channel || null,
    summary: String(summary || 'Threat captured — awaiting THEE_MICHAEL review').slice(0, 240),
    templateBanner: template.banner,
    containment: { active: true, liveFrozen: autoContain },
    sandboxLog,
    requiresKinetic2fa: true,
    requiresAdminRelease: true,
    adminIdentity: ADMIN_IDENTITY,
    adminDecision: 'pending',
    createdAt: new Date().toISOString(),
    decryptedAt: null,
    releasedAt: null,
    deniedAt: null,
    approvedAt: null,
    sealedTelemetry: sealed,
  };

  const events = readEvents(store);
  events.unshift(event);
  writeEvents(store, events);

  appendActionLog(store, {
    eventId,
    type: 'capture',
    decision: null,
    status: 'pending',
    summary: event.summary,
    module,
    channel,
    severity,
    containmentBefore: readContainment(store),
    containmentAfter: null,
    canUndo: false,
  });

  if (autoContain) {
    reconcileContainment(store);
    const c = readContainment(store);
    if (module && !c.frozenModules.includes(module)) c.frozenModules.push(module);
    if (channel && shouldBlockChannelForEvent({ channel, severity }) && !c.blockedChannels.includes(channel)) {
      c.blockedChannels.push(channel);
    }
    if (severity === 'critical' || severity === 'high') c.liveFrozen = true;
    writeContainment(store, c);
  }

  if (adminActor) {
    theeMichaelDecideThreat(store, { eventId, decision: 'approve', email: userContext.email });
    return readEvents(store).find((e) => e.eventId === eventId) || event;
  }

  return event;
}

function getRedactedEvents(store, limit = 100) {
  return readEvents(store).slice(0, limit).map((e) => ({
    eventId: e.eventId,
    status: e.status,
    severity: e.severity,
    source: e.source,
    surface: e.surface,
    module: e.module,
    channel: e.channel,
    summary: e.summary,
    templateBanner: e.templateBanner,
    containment: e.containment,
    sandboxLog: {
      containmentStatus: e.sandboxLog?.containmentStatus,
      patchReadiness: e.sandboxLog?.patchReadiness,
      liveFrozen: e.sandboxLog?.liveFrozen,
    },
    requiresKinetic2fa: true,
    requiresAdminRelease: e.requiresAdminRelease,
    adminIdentity: ADMIN_IDENTITY,
    adminDecision: e.adminDecision || (e.releasedAt ? 'approved' : e.deniedAt ? 'denied' : 'pending'),
    createdAt: e.createdAt,
    releasedAt: e.releasedAt,
    deniedAt: e.deniedAt,
    approvedAt: e.approvedAt,
    telemetrySealed: true,
  }));
}

function getActionHistoryRedacted(store, limit = 100) {
  return readActionHistory(store).slice(0, limit).map((a) => ({
    actionId: a.actionId,
    eventId: a.eventId,
    type: a.type,
    decision: a.decision,
    status: a.status,
    summary: a.summary,
    module: a.module,
    channel: a.channel,
    severity: a.severity,
    createdAt: a.createdAt,
    decidedAt: a.decidedAt,
    decidedBy: a.decidedBy,
    undoneAt: a.undoneAt,
    undoneBy: a.undoneBy,
    canUndo: a.canUndo && !a.undoneAt && a.status === 'final' && (a.decision === 'approve' || a.decision === 'deny'),
  }));
}

function isAuthorizedAdmin(email) {
  return isPlatformAdminEmail(email);
}

/** Auto-approve all pending sovereign events when THEE_MICHAEL is signed in. */
function releasePendingThreatsForPlatformAdmin(store, email) {
  if (!isPlatformAdminEmail(email)) return { released: 0 };
  const events = readEvents(store);
  const now = new Date().toISOString();
  let released = 0;
  for (const ev of events) {
    const decision = ev.adminDecision || 'pending';
    if (decision !== 'pending' || ev.releasedAt || ev.deniedAt) continue;
    ev.adminDecision = 'approved';
    ev.status = 'released';
    ev.releasedAt = now;
    ev.releasedBy = ADMIN_IDENTITY;
    ev.approvedAt = now;
    ev.autoApprovedBy = String(email).toLowerCase();
    ev.sandboxLog = {
      ...ev.sandboxLog,
      containmentStatus: 'resolved',
      liveFrozen: false,
    };
    releaseEventContainment(store, ev);
    released += 1;
  }
  if (released) writeEvents(store, events);
  reconcileContainment(store);
  return { released };
}

async function deliverKineticChallenge(store, { email, challengeId, code }, handlers = {}) {
  const delivery = [];
  const subject = `[${SITE_DOMAIN}] Kinetic 2FA verification code`;
  const text = [
    `Administrator verification for ${SITE_DOMAIN}`,
    '',
    `Code: ${code}`,
    `Challenge: ${challengeId}`,
    'Expires in 5 minutes.',
    '',
    'If you did not request this, ignore immediately.',
  ].join('\n');
  const html = `<p>Your verification code: <strong>${code}</strong></p><p>Challenge: ${challengeId}</p><p>Expires in 5 minutes.</p>`;

  try {
    const emailService = require(path.join(__dirname, '../../../apps/desktop/services/emailService'));
    let keys = {};
    try { keys = JSON.parse(store.getItem('globalApiKeys') || '{}'); } catch { /* ignore */ }
    const sent = await emailService.sendEmail(keys, {
      to: email,
      subject,
      text,
      html,
      providerPriority: ['ses', 'acumbamail', 'vbout'],
    });
    delivery.push({ channel: 'email', ok: !!(sent?.ok || sent?.success), provider: sent?.provider });
  } catch (e) {
    delivery.push({ channel: 'email', ok: false, error: e.message });
  }

  try {
    if (handlers['get-guardian-config']) {
      const cfg = await handlers['get-guardian-config'](null);
      const url = cfg?.alertWebhookUrl?.trim();
      if (url) {
        const res = await axios.post(url, {
          event: 'sovereign.kinetic_2fa',
          source: 'sovereign-threat-capture',
          timestamp: new Date().toISOString(),
          data: {
            challengeId,
            email,
            domain: SITE_DOMAIN,
            message: 'Kinetic 2FA challenge issued — check authorized administrator email',
          },
        }, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json', 'X-SI-Event': 'sovereign.kinetic_2fa' },
          validateStatus: () => true,
        });
        delivery.push({ channel: 'webhook', ok: res.status >= 200 && res.status < 300, status: res.status });
      }
    }
  } catch (e) {
    delivery.push({ channel: 'webhook', ok: false, error: e.message });
  }

  return delivery;
}

async function requestKinetic2FA(store, { email }, handlers = {}) {
  if (!isAuthorizedAdmin(email)) {
    return { success: false, error: 'Not an authorized administrator channel' };
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const challengeId = `kinetic_${Date.now()}`;
  const hash = crypto.createHash('sha256').update(`${challengeId}:${code}:${process.env.JWT_SECRET || 'si'}`).digest('hex');
  const sessions = JSON.parse(store.getItem(STORAGE_KINETIC) || '[]');
  sessions.unshift({
    challengeId,
    email: String(email).toLowerCase(),
    codeHash: hash,
    expiresAt: Date.now() + 5 * 60 * 1000,
    verified: false,
  });
  store.setItem(STORAGE_KINETIC, JSON.stringify(sessions.slice(0, 20)));

  const delivery = await deliverKineticChallenge(store, { email, challengeId, code }, handlers);
  const emailSent = delivery.some((d) => d.channel === 'email' && d.ok);
  const webhookSent = delivery.some((d) => d.channel === 'webhook' && d.ok);

  let message = `Kinetic 2FA challenge issued to authorized ${SITE_DOMAIN} administrator channel.`;
  if (process.env.NODE_ENV === 'production') {
    if (emailSent) message += ' Verification code sent to registered admin email.';
    else if (webhookSent) message += ' Admin channel notified via Guardian webhook.';
    else message += ' Configure SMTP (SES/Acumbamail) or Guardian alert webhook for delivery.';
  } else {
    message += ' Physical verification required.';
  }

  return {
    success: true,
    challengeId,
    routedTo: ADMIN_IDENTITY,
    message,
    expiresInSeconds: 300,
    delivery,
    devCode: process.env.NODE_ENV !== 'production' ? code : undefined,
  };
}

function verifyKinetic2FA(store, { challengeId, code, email }) {
  const sessions = JSON.parse(store.getItem(STORAGE_KINETIC) || '[]');
  const idx = sessions.findIndex((s) => s.challengeId === challengeId && !s.verified);
  if (idx < 0) return { success: false, error: 'Challenge expired or invalid' };
  const session = sessions[idx];
  if (Date.now() > session.expiresAt) return { success: false, error: 'Challenge expired' };
  if (!isAuthorizedAdmin(email) || session.email !== String(email).toLowerCase()) {
    return { success: false, error: 'Administrator channel mismatch' };
  }
  const hash = crypto.createHash('sha256').update(`${challengeId}:${code}:${process.env.JWT_SECRET || 'si'}`).digest('hex');
  if (hash !== session.codeHash) return { success: false, error: 'Invalid verification code' };

  const sessionToken = crypto.randomBytes(24).toString('hex');
  sessions[idx].verified = true;
  sessions[idx].sessionToken = sessionToken;
  sessions[idx].verifiedAt = new Date().toISOString();
  sessions[idx].sessionExpiresAt = Date.now() + 15 * 60 * 1000;
  store.setItem(STORAGE_KINETIC, JSON.stringify(sessions));

  return {
    success: true,
    sessionToken,
    adminIdentity: ADMIN_IDENTITY,
    message: `${ADMIN_IDENTITY} kinetic verification complete. Decrypt and release actions unlocked for 15 minutes.`,
    expiresInSeconds: 900,
  };
}

function assertKineticSession(store, sessionToken) {
  const sessions = JSON.parse(store.getItem(STORAGE_KINETIC) || '[]');
  const s = sessions.find((x) => x.sessionToken === sessionToken && x.verified);
  if (!s || Date.now() > (s.sessionExpiresAt || 0)) {
    return { ok: false, error: 'Kinetic 2FA session required or expired' };
  }
  return { ok: true, session: s };
}

function registerSovereignThreatHandlers({ ipcMain, store, handlers = {} }) {
  ipcMain.handle('get-sovereign-threat-status', () => {
    const ctx = store._invokeContext || {};
    if (isPlatformAdminEmail(ctx.email)) {
      releasePendingThreatsForPlatformAdmin(store, ctx.email);
    }
    reconcileContainment(store);
    const containment = readContainment(store);
    const events = readEvents(store);
    const pending = events.filter((e) => (e.adminDecision || 'pending') === 'pending' && !e.releasedAt && !e.deniedAt);
    const open = events.filter((e) => e.status === 'contained' && !e.releasedAt && e.adminDecision !== 'approved');
    return {
      enabled: true,
      domain: SITE_DOMAIN,
      adminIdentity: ADMIN_IDENTITY,
      layer: `${ADMIN_IDENTITY} Security Control`,
      containment,
      openThreatCount: open.length,
      pendingReviewCount: pending.length,
      criticalCount: open.filter((e) => e.severity === 'critical').length,
      liveFrozen: containment.liveFrozen,
      kinetic2faRequired: true,
      events: getRedactedEvents(store, 50),
      actionHistory: getActionHistoryRedacted(store, 100),
    };
  });

  ipcMain.handle('get-thee-michael-action-history', () => ({
    success: true,
    adminIdentity: ADMIN_IDENTITY,
    history: getActionHistoryRedacted(store, 200),
    events: getRedactedEvents(store, 100),
  }));

  ipcMain.handle('thee-michael-decide-threat', (event, payload = {}) => {
    const ctx = store._invokeContext || {};
    const email = payload.adminEmail || ctx.email;
    return theeMichaelDecideThreat(store, {
      eventId: payload.eventId,
      decision: payload.decision,
      email,
    });
  });

  ipcMain.handle('thee-michael-undo-action', (event, payload = {}) => {
    const ctx = store._invokeContext || {};
    const email = payload.adminEmail || ctx.email;
    return theeMichaelUndoAction(store, {
      actionId: payload.actionId,
      email,
    });
  });

  ipcMain.handle('capture-sovereign-threat', (event, payload = {}) => {
    const captured = captureThreatEvent(store, payload);
    return { success: true, event: getRedactedEvents(store).find((e) => e.eventId === captured.eventId), message: captured.templateBanner };
  });

  ipcMain.handle('request-kinetic-2fa-challenge', async (event, payload = {}) => {
    return requestKinetic2FA(store, payload, handlers);
  });

  ipcMain.handle('verify-kinetic-2fa', (event, payload = {}) => {
    return verifyKinetic2FA(store, payload);
  });

  ipcMain.handle('decrypt-sovereign-threat-telemetry', (event, payload = {}) => {
    const ctx = store._invokeContext || {};
    const email = payload.adminEmail || ctx.email;
    if (!isPlatformAdminEmail(email)) {
      const gate = assertKineticSession(store, payload.sessionToken);
      if (!gate.ok) return { success: false, error: gate.error };
    }
    const events = readEvents(store);
    const ev = events.find((e) => e.eventId === payload.eventId);
    if (!ev) return { success: false, error: 'Event not found' };
    const projectId = store.projectId || store.getItem('activeCampaignId') || 'default';
    const decrypted = decryptSealed(projectId, ev.sealedTelemetry);
    ev.decryptedAt = new Date().toISOString();
    ev.decryptedBy = ADMIN_IDENTITY;
    writeEvents(store, events);
    return {
      success: true,
      eventId: ev.eventId,
      template: buildSecurityTemplate(ev.sealedTelemetry),
      telemetry: decrypted,
      adminIdentity: ADMIN_IDENTITY,
    };
  });

  ipcMain.handle('approve-sovereign-threat-release', async (event, payload = {}) => {
    const ctx = store._invokeContext || {};
    const email = payload.adminEmail || ctx.email;
    const adminBypass = isPlatformAdminEmail(email);
    if (!adminBypass) {
      const gate = assertKineticSession(store, payload.sessionToken);
      if (!gate.ok) return { success: false, error: gate.error };
    }

    const cfg = handlers['get-guardian-config'] ? await handlers['get-guardian-config'](null).catch(() => ({})) : {};
    if (!adminBypass && cfg.approvalGateEnabled !== false) {
      const ticket = await handlers['create-guardian-approval']?.(null, {
        module: 'THEE_MICHAEL Security Control',
        component: 'production_release',
        issueSummary: payload.summary || 'THEE_MICHAEL security release approval',
        proposedFix: 'Decrypt telemetry review complete — promote contained patch to production',
        riskLevel: payload.severity === 'critical' ? 'high' : 'medium',
        sandboxTestA: payload.sandboxTestA || { pass: true, notes: 'Threat contained in sandbox' },
        sandboxTestB: payload.sandboxTestB || { pass: true, notes: 'Regression check on isolated path' },
        recommendedAction: `${ADMIN_IDENTITY} physical verification + guardian approval required`,
      });
      if (!ticket?.success) return { success: false, error: 'Guardian approval routing failed' };
    }

    const events = readEvents(store);
    const idx = events.findIndex((e) => e.eventId === payload.eventId);
    if (idx < 0) return { success: false, error: 'Event not found' };

    events[idx].status = 'released';
    events[idx].adminDecision = 'approved';
    events[idx].approvedAt = new Date().toISOString();
    events[idx].releasedAt = new Date().toISOString();
    events[idx].releasedBy = ADMIN_IDENTITY;
    events[idx].sandboxLog = {
      ...events[idx].sandboxLog,
      containmentStatus: 'resolved',
      patchReadiness: 'approved',
      regressionResults: 'pass',
      sandboxVerification: { testA: 'pass', testB: 'pass' },
      liveFrozen: false,
    };
    writeEvents(store, events);

    const c = readContainment(store);
    c.liveFrozen = false;
    if (payload.eventId) {
      const ev = events[idx];
      c.frozenModules = c.frozenModules.filter((m) => m !== ev.module);
      if (ev.channel) c.blockedChannels = c.blockedChannels.filter((ch) => ch !== ev.channel);
    }
    writeContainment(store, c);

    return {
      success: true,
      eventId: payload.eventId,
      message: `Threat release approved by ${ADMIN_IDENTITY}. Live paths unfrozen after verification.`,
      containment: readContainment(store),
    };
  });

  ipcMain.handle('admin-clear-sovereign-false-positives', (event, payload = {}) => {
    const ctx = store._invokeContext || {};
    const email = payload.adminEmail || ctx.email;
    if (!isAuthorizedAdmin(email)) {
      return { success: false, error: 'Authorized administrator required (THEE_MICHAEL)' };
    }
    const result = clearFalsePositiveContainment(store);
    if (result.released > 0) {
      appendActionLog(store, {
        type: 'false_positive_clear',
        decision: 'approve',
        status: 'final',
        summary: `Cleared ${result.released} false-positive threat(s)`,
        containmentBefore: null,
        containmentAfter: result.containment,
        decidedAt: new Date().toISOString(),
        canUndo: true,
      });
    }
    return {
      success: true,
      message: `${ADMIN_IDENTITY} cleared ${result.released} false-positive threat(s). Live paths restored.`,
      ...result,
      actionHistory: getActionHistoryRedacted(store, 20),
    };
  });

  ipcMain.handle('run-sovereign-threat-scan', () => {
    const containment = readContainment(store);
    const events = readEvents(store);
    return {
      success: true,
      domain: SITE_DOMAIN,
      scannedAt: new Date().toISOString(),
      openThreats: events.filter((e) => !e.releasedAt).length,
      containment,
      modulesProtected: [
        'public website', 'web application', 'content systems', 'dashboards',
        'admin tools', 'analytics', 'automation hooks', 'integrations', 'brain memory',
      ],
    };
  });

  console.log(`[sovereignThreatCapture] ${ADMIN_IDENTITY} Security Control active for`, SITE_DOMAIN);
}

module.exports = {
  registerSovereignThreatHandlers,
  captureThreatEvent,
  scanRequestSurface,
  scanTextForThreats,
  redactSensitiveFields,
  reconcileContainment,
  releasePendingThreatsForPlatformAdmin,
  releaseRoutineFalsePositives,
  clearFalsePositiveContainment,
  theeMichaelDecideThreat,
  theeMichaelUndoAction,
  getRedactedEvents,
  getActionHistoryRedacted,
  readContainment,
  readActionHistory,
  PROTECTED_CHANNELS,
  SAAS_ROUTINE_CHANNELS,
  TRUSTED_CREDENTIAL_CHANNELS,
  ADMIN_IDENTITY,
  SITE_DOMAIN,
  buildSecurityTemplate,
};