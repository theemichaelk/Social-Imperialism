/**
 * Guardian & Self-Healing Gatekeeper — types and helpers.
 * Canonical doc: brain/GUARDIAN_GATEKEEPER.md
 */

export const GUARDIAN_ADMIN = 'THEE_MICHAEL';

export const GUARDIAN_SYSTEM_PROMPT = `You are the Social Imperialism Guardian and Self-Healing Gatekeeper.
Monitor Mission Control, workers, integrations, scheduling, AI replies, analytics, and Partner API health.
Use current platform API docs and policy when diagnosing. Never apply production fixes without ${GUARDIAN_ADMIN} approval.
Always sandbox double-test (Test A + Test B) before proposing release. Do not expose private admin contact details.
Be calm, precise, operational. Lead with severity, module, and one next action.`;

export type GuardianAlert = {
  alertId: string;
  severity: 'low' | 'medium' | 'high';
  module: string;
  platform?: string;
  summary: string;
  recommendedAction: string;
  proposedFix?: string;
  requiresApproval?: boolean;
  status: string;
  example?: boolean;
};

export type GuardianApproval = {
  ticketId: string;
  routedTo: string;
  status: 'pending' | 'sandbox_required' | 'approved' | 'released' | 'rejected';
  module: string;
  component: string;
  issueSummary: string;
  proposedFix: string;
  riskLevel: string;
  sandboxTestA: { pass: boolean; notes: string };
  sandboxTestB: { pass: boolean; notes: string };
  rollbackPlan: string;
  affectedAccounts: string[];
  recommendedAction: string;
  createdAt: string;
  approvedAt?: string | null;
  releasedAt?: string | null;
  releaseLog?: Array<{ step: string; result: string; at: string; notes?: string }>;
};

export type GuardianConfig = {
  enabled?: boolean;
  scanIntervalMinutes?: number;
  sandboxMode?: boolean;
  approvalGateEnabled?: boolean;
  alertWebhookUrl?: string;
  guardianHookUrl?: string | null;
  guardianHookSecret?: string;
  apiBase?: string;
  lastScanAt?: string | null;
  lastScanStatus?: string;
  adminIdentity?: string;
  outboundEvents?: Array<{ id: string; label: string; desc?: string }>;
  setupChecklist?: Array<{ step: number; id: string; label: string; detail: string; done?: boolean }>;
};

export const SETUP_CHECKLIST_IDS = [
  'partner_key', 'inbound_hook', 'guardian_hook', 'alert_webhook',
  'enable_monitor', 'subscribe', 'sandbox', 'approval_gate', 'initial_scan', 'test_webhook',
] as const;

export function severityColor(severity: string): string {
  if (severity === 'high') return '#f87171';
  if (severity === 'medium') return '#f59e0b';
  return '#38bdf8';
}

export function statusLabel(status: string): string {
  if (status === 'pending' || status === 'pending_approval') return `Waiting on ${GUARDIAN_ADMIN} approval`;
  if (status === 'sandbox_required') return 'Sandbox tests required';
  if (status === 'approved') return 'Approved — ready to release';
  if (status === 'released') return 'Released';
  if (status === 'healthy') return 'Healthy';
  if (status === 'degraded') return 'Degraded';
  return status;
}