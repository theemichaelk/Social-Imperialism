import { reportClientThreat } from '@/lib/sovereignThreatCapture';

export function getApiBase(): string {
  // Browser: same-origin /api proxy (Next.js rewrites → production API, no CORS issues).
  if (typeof window !== 'undefined') return '';
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('si_token');
}

export function getProjectId(): string | null {
  if (typeof window === 'undefined') return null;
  const id = localStorage.getItem('si_project_id');
  if (id?.startsWith('camp_')) return null;
  return id;
}

export function setProjectId(id: string | null) {
  if (typeof window === 'undefined') return;
  if (id) localStorage.setItem('si_project_id', id);
  else localStorage.removeItem('si_project_id');
}

export function setSession(data: { token: string; project?: { id: string } }) {
  localStorage.setItem('si_token', data.token);
  if (data.project?.id) setProjectId(data.project.id);
}

export function clearSession() {
  localStorage.removeItem('si_token');
  setProjectId(null);
}

type MeResponse = {
  project?: { id: string; name?: string };
  projects?: Array<{ id: string; name?: string; isActive?: boolean }>;
};

let bootstrapPromise: Promise<void> | null = null;

/** Sync si_project_id from server (fixes stale local dev IDs in production). */
export async function repairSession(): Promise<void> {
  const token = getToken();
  if (!token) return;
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('si_project_id');
    if (raw?.startsWith('camp_')) localStorage.removeItem('si_project_id');
  }
  try {
    const me = await auth.me() as MeResponse;
    const active =
      me.project?.id
      || me.projects?.find((p) => p.isActive)?.id
      || me.projects?.[0]?.id;
    if (active) setProjectId(active);
    else setProjectId(null);
  } catch {
    clearSession();
    if (typeof window !== 'undefined') window.location.replace('/login');
  }
}

export async function bootstrapSession(): Promise<void> {
  if (!getToken()) return;
  if (!bootstrapPromise) bootstrapPromise = repairSession();
  await bootstrapPromise;
}

function isStaleProjectError(msg: string) {
  return /project not found|no project/i.test(msg);
}

function isRetryableResponse(status: number, json: Record<string, unknown>) {
  return status === 503 || json.retryable === true
    || /timeout|ECONNRESET|503|502|429/i.test(String(json.error || ''));
}

const SOVEREIGN_CODES = new Set([
  'SOVEREIGN_CONTAINED',
  'SOVEREIGN_THREAT_CAPTURED',
  'SOVEREIGN_LIVE_FROZEN',
  'SOVEREIGN_CHANNEL_BLOCKED',
]);

export function isSovereignError(code?: string) {
  return !!code && SOVEREIGN_CODES.has(code);
}

function reportSovereignClientAnomaly(path: string, code: string, msg: string) {
  if (typeof window === 'undefined' || path.includes('capture-sovereign-threat')) return;
  const dedupeKey = `sov_client_${code}_${path}`;
  try {
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, '1');
  } catch { /* ignore */ }
  if (!getToken()) return;
  reportClientThreat(
    (channel, payload) => invoke(channel, payload),
    {
      surface: path,
      module: 'Web Application',
      severity: code === 'SOVEREIGN_THREAT_CAPTURED' ? 'high' : 'medium',
      vector: code.toLowerCase(),
      summary: `Client observed ${code}: ${msg}`.slice(0, 240),
    },
  ).catch(() => {});
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function apiFetch(path: string, options: RequestInit = {}, retryState: { allowSessionRetry?: boolean; attempt?: number } = {}) {
  const { allowSessionRetry = true, attempt = 0 } = retryState;
  const token = getToken();
  const projectId = getProjectId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (projectId) headers['x-project-id'] = projectId;

  const res = await fetch(`${getApiBase()}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.error as string) || res.statusText;
    if (allowSessionRetry && typeof window !== 'undefined' && isStaleProjectError(msg)) {
      setProjectId(null);
      await repairSession();
      return apiFetch(path, options, { allowSessionRetry: false, attempt });
    }
    if (attempt < 2 && isRetryableResponse(res.status, json)) {
      await sleep(400 * (attempt + 1));
      return apiFetch(path, options, { allowSessionRetry, attempt: attempt + 1 });
    }
    const err = new Error(msg) as Error & { retryable?: boolean; code?: string };
    err.retryable = !!json.retryable;
    err.code = json.code as string | undefined;
    if (isSovereignError(err.code)) {
      reportSovereignClientAnomaly(path, err.code!, msg);
    }
    throw err;
  }
  return json;
}

/** Drop-in replacement for Electron ipcRenderer.invoke */
export async function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  const res = await apiFetch(`/api/invoke/${channel}`, {
    method: 'POST',
    body: JSON.stringify({ args }),
  });
  const oauthUrl = res.pendingOAuthUrl as string | undefined;
  if (oauthUrl && typeof window !== 'undefined') {
    window.open(oauthUrl, 'si_oauth', 'noopener,noreferrer,width=520,height=720');
  }
  const checkoutUrl = (res.data as { checkoutUrl?: string } | undefined)?.checkoutUrl;
  if (checkoutUrl && typeof window !== 'undefined') {
    window.location.href = checkoutUrl;
  }
  return res.data as T;
}

type SessionResponse = { token: string; project?: { id: string; name?: string } };

export const auth = {
  login: (email: string, password: string) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }) as Promise<SessionResponse>,
  register: (data: { email: string; password: string; name?: string; orgName?: string }) =>
    apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }) as Promise<SessionResponse>,
  me: () => apiFetch('/api/auth/me') as Promise<MeResponse>,
};