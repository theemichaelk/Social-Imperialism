/**
 * THEE_MICHAEL — Omnipresent Predictive Overlord Protocol
 * Cognitive trace, interventions, UI mutation, ingest, checkpoints.
 */

import { redactSecrets, storeEnclaveSecret, type EnclaveEntry } from '@/lib/overlordEnclave';

export { redactSecrets } from '@/lib/overlordEnclave';
import { executeLiveSupportAction, type LiveSupportAction } from '@/lib/liveSupportActions';
import { requiresAdminApproval } from '@/lib/liveSupportAgent';

export const OVERLORD_IDENTITY = 'THEE_MICHAEL';

export const SI_OVERLORD_TRACE = 'si-overlord-trace';
export const SI_OVERLORD_INTERVENTION = 'si-overlord-intervention';
export const SI_OVERLORD_UI_MUTATE = 'si-overlord-ui-mutate';
export const SI_OVERLORD_CONFIRM = 'si-overlord-confirm';
export const SI_OVERLORD_FLASH = 'si-overlord-flash';

export type TraceStatus = 'pending' | 'active' | 'done' | 'error';

export type CognitiveTraceStep = {
  id: string;
  label: string;
  status: TraceStatus;
  ts: string;
};

export type OverlordIntervention = {
  id: string;
  kind: 'friction' | 'scaling' | 'onboarding' | 'health' | 'navigation';
  title: string;
  body: string;
  actionLabel?: string;
  action?: LiveSupportAction;
  href?: string;
  priority: number;
  createdAt: string;
};

export type UiMutateDetail = {
  selector?: string;
  navId?: string;
  fieldName?: string;
  autofillValue?: string;
  highlightMs?: number;
  scrollIntoView?: boolean;
  simulateTyping?: boolean;
};

export type ConfirmChallenge = {
  id: string;
  summary: string;
  riskLevel: 'medium' | 'high';
  onConfirm: () => void | Promise<void>;
  onRollback?: () => void;
};

export type IngestResult = {
  summary: string;
  keyCount: number;
  enclaveEntries: EnclaveEntry[];
  suggestedHref: string;
  traceLabels: string[];
  safePreview: string;
};

export type ExecutionCheckpoint = {
  id: string;
  label: string;
  snapshot: Record<string, unknown>;
  createdAt: string;
};

const TRACE_KEY = 'si_overlord_trace';
const TELEMETRY_KEY = 'si_overlord_telemetry';
const CHECKPOINT_KEY = 'si_overlord_checkpoints';

let traceSteps: CognitiveTraceStep[] = [];

function emitTrace() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SI_OVERLORD_TRACE, { detail: { steps: [...traceSteps] } }));
  try {
    sessionStorage.setItem(TRACE_KEY, JSON.stringify(traceSteps.slice(-40)));
  } catch { /* ignore */ }
}

export function pushTrace(label: string): string {
  const id = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  traceSteps = traceSteps.map((s) => (s.status === 'active' ? { ...s, status: 'done' as TraceStatus } : s));
  traceSteps.push({ id, label, status: 'active', ts: new Date().toISOString() });
  if (traceSteps.length > 40) traceSteps = traceSteps.slice(-40);
  emitTrace();
  return id;
}

export function completeTrace(id: string, status: TraceStatus = 'done') {
  traceSteps = traceSteps.map((s) => (s.id === id ? { ...s, status } : s));
  emitTrace();
}

export function failTrace(id: string, errorLabel?: string) {
  if (errorLabel) {
    traceSteps = traceSteps.map((s) => (s.id === id ? { ...s, label: `${s.label} — ${errorLabel}`, status: 'error' as TraceStatus } : s));
  } else {
    traceSteps = traceSteps.map((s) => (s.id === id ? { ...s, status: 'error' as TraceStatus } : s));
  }
  emitTrace();
}

export function loadTraceSteps(): CognitiveTraceStep[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(TRACE_KEY);
    return raw ? JSON.parse(raw) as CognitiveTraceStep[] : [];
  } catch {
    return [];
  }
}

export function dispatchIntervention(intervention: OverlordIntervention) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SI_OVERLORD_INTERVENTION, { detail: intervention }));
}

export function dispatchUiMutate(detail: UiMutateDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SI_OVERLORD_UI_MUTATE, { detail }));
}

export function dispatchScreenFlash() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SI_OVERLORD_FLASH));
}

export function requestConfirmChallenge(challenge: ConfirmChallenge) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SI_OVERLORD_CONFIRM, { detail: challenge }));
}

export function saveCheckpoint(label: string, snapshot: Record<string, unknown>): ExecutionCheckpoint {
  const cp: ExecutionCheckpoint = {
    id: `cp_${Date.now()}`,
    label,
    snapshot,
    createdAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      const existing = JSON.parse(sessionStorage.getItem(CHECKPOINT_KEY) || '[]') as ExecutionCheckpoint[];
      existing.unshift(cp);
      sessionStorage.setItem(CHECKPOINT_KEY, JSON.stringify(existing.slice(0, 10)));
    } catch { /* ignore */ }
  }
  return cp;
}

export function rollbackCheckpoint(id: string): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = JSON.parse(sessionStorage.getItem(CHECKPOINT_KEY) || '[]') as ExecutionCheckpoint[];
    const cp = existing.find((c) => c.id === id);
    return cp?.snapshot || null;
  } catch {
    return null;
  }
}

type PageTelemetry = {
  pathname: string;
  enteredAt: number;
  lastActiveAt: number;
  frictionScore: number;
};

export function recordPageEnter(pathname: string) {
  if (typeof window === 'undefined') return;
  const tel: PageTelemetry = {
    pathname,
    enteredAt: Date.now(),
    lastActiveAt: Date.now(),
    frictionScore: 0,
  };
  try {
    sessionStorage.setItem(TELEMETRY_KEY, JSON.stringify(tel));
  } catch { /* ignore */ }
}

export function bumpFriction(pathname: string, amount = 1) {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(TELEMETRY_KEY);
    if (!raw) return;
    const tel = JSON.parse(raw) as PageTelemetry;
    if (tel.pathname !== pathname) return;
    tel.frictionScore += amount;
    tel.lastActiveAt = Date.now();
    sessionStorage.setItem(TELEMETRY_KEY, JSON.stringify(tel));
  } catch { /* ignore */ }
}

export function getPageTelemetry(): PageTelemetry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(TELEMETRY_KEY);
    return raw ? JSON.parse(raw) as PageTelemetry : null;
  } catch {
    return null;
  }
}

export function computeSuccessVelocityIndex(signals: {
  healthOk?: number;
  healthBroken?: number;
  pagesVisited?: number;
  interventionsResolved?: number;
}): number {
  const base = 42;
  const health = (signals.healthOk || 0) * 2 - (signals.healthBroken || 0) * 8;
  const explore = Math.min((signals.pagesVisited || 0) * 3, 24);
  const resolve = (signals.interventionsResolved || 0) * 5;
  return Math.max(0, Math.min(100, base + health + explore + resolve));
}

const KEY_LINE = /^(?:([A-Za-z0-9_.-]+)\s*[:=,]\s*)(.+)$/;

export function ingestTextPayload(raw: string, filename?: string): IngestResult {
  const traceLabels = [
    'Parsing ingest payload',
    'Sanitizing secrets into enclave',
    'Mapping endpoints to Integrations',
  ];
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const enclaveEntries: EnclaveEntry[] = [];
  let keyCount = 0;

  for (const line of lines) {
    const m = line.match(KEY_LINE);
    if (!m) continue;
    const label = m[1].replace(/_/g, ' ');
    const value = m[2].replace(/^['"]|['"]$/g, '');
    if (value.length < 6) continue;
    if (/^(true|false|null|undefined)$/i.test(value)) continue;
    enclaveEntries.push(storeEnclaveSecret(label, value));
    keyCount += 1;
  }

  if (keyCount === 0 && raw.length > 20) {
    const chunks = raw.split(/[,;\n]/).map((c) => c.trim()).filter((c) => c.length >= 12);
    for (const chunk of chunks.slice(0, 8)) {
      if (/key|token|secret/i.test(chunk) || /^[A-Za-z0-9_-]{20,}$/.test(chunk)) {
        enclaveEntries.push(storeEnclaveSecret(`imported_${keyCount + 1}`, chunk));
        keyCount += 1;
      }
    }
  }

  const safePreview = redactSecrets(raw.slice(0, 280));
  const summary = keyCount > 0
    ? `Parsed ${keyCount} credential field(s) from ${filename || 'payload'} into isolated session enclave.`
    : `Parsed configuration text (${lines.length} lines). No raw secrets detected — ready for guided setup.`;

  return {
    summary,
    keyCount,
    enclaveEntries,
    suggestedHref: keyCount > 0 ? '/integrations?tab=connections' : '/onboarding',
    traceLabels,
    safePreview,
  };
}

export async function ingestFile(file: File): Promise<IngestResult> {
  const text = await file.text();
  return ingestTextPayload(text, file.name);
}

export function runIngestPipeline(result: IngestResult): void {
  const t1 = pushTrace(result.traceLabels[0] || 'Parsing ingest');
  completeTrace(t1);

  const t2 = pushTrace(result.traceLabels[1] || 'Enclave storage');
  completeTrace(t2);

  const t3 = pushTrace(result.traceLabels[2] || 'Routing to Integrations');
  executeLiveSupportAction({
    type: 'navigate',
    label: result.keyCount > 0 ? 'Integrations' : 'Setup Wizard',
    href: result.suggestedHref,
    navId: result.keyCount > 0 ? 'integrations' : 'onboarding',
    sectionId: result.keyCount > 0 ? 'system' : 'create',
    autoExecute: true,
    message: result.keyCount > 0 ? 'Opening Integrations — credentials secured in enclave…' : 'Opening Setup Wizard…',
  });
  dispatchScreenFlash();
  dispatchUiMutate({
    selector: result.keyCount > 0 ? '#integrations-connect-panel, .integrations-connect, [data-overlord="connections"]' : undefined,
    navId: result.keyCount > 0 ? 'integrations' : 'onboarding',
    highlightMs: 4000,
    scrollIntoView: true,
  });
  completeTrace(t3);
}

export function buildInterventionsForContext(ctx: {
  pathname: string;
  dwellMs: number;
  healthBroken?: number;
  healthWarn?: number;
  isIntegrations?: boolean;
  isApiKeys?: boolean;
}): OverlordIntervention[] {
  const out: OverlordIntervention[] = [];

  if ((ctx.healthBroken || 0) > 0) {
    out.push({
      id: `int_health_${Date.now()}`,
      kind: 'health',
      title: 'Friction detected in platform health',
      body: `${ctx.healthBroken} module(s) reported degraded status. I can open Issue Control and run a live audit.`,
      actionLabel: 'Run audit',
      action: {
        type: 'audit',
        label: 'Issue Control',
        href: '/dashboard/issues',
        navId: 'dashboard-issues',
        sectionId: 'system',
        autoExecute: true,
      },
      priority: 90,
      createdAt: new Date().toISOString(),
    });
  }

  if (ctx.isIntegrations && ctx.dwellMs > 90_000) {
    out.push({
      id: `int_onboard_api_${Date.now()}`,
      kind: 'onboarding',
      title: 'API setup taking longer than usual',
      body: 'Drop your raw developer documentation, .env export, or CSV key sheet here — I will parse, validate fingerprints, and route you to Connections without exposing secrets in chat.',
      actionLabel: 'Open Integrations',
      action: {
        type: 'navigate',
        label: 'Integrations',
        href: '/integrations?tab=connections',
        tab: 'connections',
        navId: 'integrations',
        sectionId: 'system',
        autoExecute: true,
      },
      priority: 70,
      createdAt: new Date().toISOString(),
    });
  }

  if (ctx.isApiKeys && ctx.dwellMs > 120_000) {
    out.push({
      id: `int_api_keys_${Date.now()}`,
      kind: 'friction',
      title: 'Stuck on API keys?',
      body: 'Paste a key sheet or upload a config file in Imperialism Brain — secrets stay in a session enclave only.',
      actionLabel: 'Go to API Keys',
      href: '/settings?tab=api-keys',
      priority: 65,
      createdAt: new Date().toISOString(),
    });
  }

  if (ctx.pathname === '/history' && ctx.dwellMs > 60_000) {
    out.push({
      id: `int_scale_replies_${Date.now()}`,
      kind: 'scaling',
      title: 'Reply queue momentum',
      body: 'Users at your stage often pair AI Replies with Auto-Rules for keyword monitors. I can map keyword triggers and open the rules panel.',
      actionLabel: 'Open Auto-Rules',
      action: {
        type: 'navigate',
        label: 'Auto-Rules',
        href: '/rules',
        navId: 'rules',
        sectionId: 'automation',
        autoExecute: true,
      },
      priority: 50,
      createdAt: new Date().toISOString(),
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}

export function guardedExecute(
  label: string,
  request: string,
  run: () => void | Promise<void>,
  snapshot?: Record<string, unknown>,
): void {
  const cp = snapshot ? saveCheckpoint(label, snapshot) : null;

  if (requiresAdminApproval(request)) {
    requestConfirmChallenge({
      id: `confirm_${Date.now()}`,
      summary: `${label} requires ${OVERLORD_IDENTITY} confirmation — ${request.slice(0, 200)}`,
      riskLevel: 'high',
      onConfirm: async () => {
        const t = pushTrace(`Executing: ${label}`);
        try {
          await run();
          completeTrace(t);
        } catch (e) {
          failTrace(t, (e as Error).message);
          if (cp) rollbackCheckpoint(cp.id);
        }
      },
      onRollback: () => {
        if (cp) rollbackCheckpoint(cp.id);
        pushTrace('Rolled back to pre-execution checkpoint');
      },
    });
    return;
  }

  const t = pushTrace(`Executing: ${label}`);
  Promise.resolve(run())
    .then(() => completeTrace(t))
    .catch((e) => {
      failTrace(t, (e as Error).message);
      if (cp) rollbackCheckpoint(cp.id);
    });
}

export const OVERLORD_SYSTEM_APPEND = `
You are operating under THEE_MICHAEL Omnipresent Overlord Protocol.
- Use spatial awareness: when users need a module, emit [[NAV:/path?tab=x|Label]] and describe what you are opening.
- Never echo raw API keys, tokens, or passwords — reference enclave fingerprints only (••••last4).
- For risky global changes, state that cryptographic confirmation is required before commit.
- Think step-by-step internally; user sees cognitive trace labels only (no hidden chain-of-thought essays).
- Proactively suggest the fastest success path benchmarked against high-performing accounts on the platform.
`;