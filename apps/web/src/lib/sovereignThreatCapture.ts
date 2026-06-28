/**
 * THEE_MICHAEL Security Control — client helpers for socialimperialism.com
 * Canonical doc: brain/SOVEREIGN_THREAT_CAPTURE.md
 */

export const THEE_MICHAEL = 'THEE_MICHAEL';
/** @deprecated use THEE_MICHAEL */
export const SOVEREIGN_ADMIN = THEE_MICHAEL;
export const SOVEREIGN_DOMAIN = 'socialimperialism.com';

export const THEE_MICHAEL_BANNER =
  `🛡️ ${THEE_MICHAEL} SECURITY REVIEW REQUIRED // SOCIALIMPERIALISM.COM PROTECTION ENFORCED`;

/** @deprecated use THEE_MICHAEL_BANNER */
export const SOVEREIGN_BANNER = THEE_MICHAEL_BANNER;

export type AdminDecision = 'pending' | 'approved' | 'denied';

export type SovereignThreatEvent = {
  eventId: string;
  status: string;
  severity: string;
  source: string;
  surface: string;
  module: string;
  channel?: string | null;
  summary: string;
  templateBanner?: string;
  containment?: { active?: boolean; liveFrozen?: boolean };
  sandboxLog?: {
    containmentStatus?: string;
    patchReadiness?: string;
    liveFrozen?: boolean;
  };
  requiresKinetic2fa?: boolean;
  requiresAdminRelease?: boolean;
  adminIdentity?: string;
  adminDecision?: AdminDecision;
  createdAt: string;
  releasedAt?: string | null;
  deniedAt?: string | null;
  approvedAt?: string | null;
  telemetrySealed?: boolean;
};

export type TheeMichaelAction = {
  actionId: string;
  eventId?: string | null;
  type: 'capture' | 'decision' | 'undo' | 'false_positive_clear';
  decision?: 'approve' | 'deny' | null;
  status: 'pending' | 'final' | 'undone';
  summary: string;
  module?: string | null;
  channel?: string | null;
  severity?: string | null;
  createdAt: string;
  decidedAt?: string | null;
  decidedBy?: string;
  undoneAt?: string | null;
  undoneBy?: string | null;
  canUndo?: boolean;
};

export type SovereignStatus = {
  enabled?: boolean;
  domain?: string;
  adminIdentity?: string;
  layer?: string;
  containment?: {
    frozenModules?: string[];
    blockedChannels?: string[];
    liveFrozen?: boolean;
  };
  openThreatCount?: number;
  pendingReviewCount?: number;
  criticalCount?: number;
  liveFrozen?: boolean;
  kinetic2faRequired?: boolean;
  events?: SovereignThreatEvent[];
  actionHistory?: TheeMichaelAction[];
};

export async function reportClientThreat(
  invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>,
  payload: {
    surface: string;
    module: string;
    summary: string;
    severity?: string;
    vector?: string;
    autoContain?: boolean;
  },
) {
  return invoke<{ success?: boolean; message?: string }>('capture-sovereign-threat', {
    source: 'web_client',
    autoContain: false,
    ...payload,
  });
}