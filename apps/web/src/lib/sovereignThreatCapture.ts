/**
 * Sovereign Threat Capture Layer — client helpers for socialimperialism.com
 * Canonical doc: brain/SOVEREIGN_THREAT_CAPTURE.md
 */

export const SOVEREIGN_ADMIN = 'THEE_MICHAEL';
export const SOVEREIGN_DOMAIN = 'socialimperialism.com';

export const SOVEREIGN_BANNER =
  '🛡️ SOVEREIGN THREAT CAPTURED // SOCIALIMPERIALISM.COM PROTECTION ENFORCED';

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
  createdAt: string;
  releasedAt?: string | null;
  telemetrySealed?: boolean;
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
  criticalCount?: number;
  liveFrozen?: boolean;
  kinetic2faRequired?: boolean;
  events?: SovereignThreatEvent[];
};

/** Report client-side anomaly (XSS in form, suspicious navigation) to backend */
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