/**
 * Polymorphic session enclave — transient secret storage.
 * Secrets never enter chat logs, localStorage, or persistent training vectors.
 * TTL-bound sessionStorage only; cleared on tab close.
 */

const ENCLAVE_KEY = 'si_overlord_enclave_v1';
const DEFAULT_TTL_MS = 12 * 60 * 1000;

export type EnclaveEntry = {
  id: string;
  kind: 'api_key' | 'token' | 'credential' | 'config';
  label: string;
  /** Opaque blob — base64 of JSON metadata only; value held in memory map */
  fingerprint: string;
  savedAt: number;
  expiresAt: number;
};

type EnclaveVault = {
  entries: EnclaveEntry[];
  sessionSalt: string;
};

const memoryVault = new Map<string, string>();

function sessionSalt(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const existing = sessionStorage.getItem(`${ENCLAVE_KEY}_salt`);
    if (existing) return existing;
    const salt = `ol_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(`${ENCLAVE_KEY}_salt`, salt);
    return salt;
  } catch {
    return 'fallback';
  }
}

function fingerprint(value: string): string {
  const tail = value.slice(-4);
  return `••••${tail}`;
}

function loadVault(): EnclaveVault {
  if (typeof window === 'undefined') return { entries: [], sessionSalt: 'ssr' };
  try {
    const raw = sessionStorage.getItem(ENCLAVE_KEY);
    if (!raw) return { entries: [], sessionSalt: sessionSalt() };
    const parsed = JSON.parse(raw) as EnclaveVault;
    const now = Date.now();
    parsed.entries = (parsed.entries || []).filter((e) => e.expiresAt > now);
    return parsed;
  } catch {
    return { entries: [], sessionSalt: sessionSalt() };
  }
}

function persistVault(vault: EnclaveVault) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(ENCLAVE_KEY, JSON.stringify(vault));
  } catch { /* ignore */ }
}

export function storeEnclaveSecret(
  label: string,
  value: string,
  kind: EnclaveEntry['kind'] = 'api_key',
  ttlMs = DEFAULT_TTL_MS,
): EnclaveEntry {
  const id = `enc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry: EnclaveEntry = {
    id,
    kind,
    label,
    fingerprint: fingerprint(value),
    savedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };
  memoryVault.set(id, value);
  const vault = loadVault();
  vault.entries.unshift(entry);
  vault.entries = vault.entries.slice(0, 24);
  persistVault(vault);
  return entry;
}

export function getEnclaveSecret(id: string): string | null {
  const vault = loadVault();
  const entry = vault.entries.find((e) => e.id === id);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return memoryVault.get(id) || null;
}

export function listEnclaveEntries(): EnclaveEntry[] {
  return loadVault().entries;
}

export function purgeEnclave() {
  memoryVault.clear();
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ENCLAVE_KEY);
    sessionStorage.removeItem(`${ENCLAVE_KEY}_salt`);
  } catch { /* ignore */ }
}

/** Redact secrets from text before logging or AI prompts. */
export function redactSecrets(text: string): string {
  return text
    .replace(/\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{16,}\b/g, '[REDACTED_STRIPE]')
    .replace(/\bAIza[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_GOOGLE]')
    .replace(/\b(xox[baprs]-)[A-Za-z0-9-]{10,}\b/gi, '[REDACTED_SLACK]')
    .replace(/(api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[^\s'"]{8,}/gi, '$1=[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{20,}\b/gi, 'Bearer [REDACTED]');
}