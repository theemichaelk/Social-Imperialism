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
  return localStorage.getItem('si_project_id');
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
  return /project not found/i.test(msg);
}

export async function apiFetch(path: string, options: RequestInit = {}, allowRetry = true) {
  const token = getToken();
  const projectId = getProjectId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (projectId) headers['x-project-id'] = projectId;

  const res = await fetch(`${getApiBase()}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: string }).error || res.statusText;
    if (allowRetry && typeof window !== 'undefined' && isStaleProjectError(msg)) {
      setProjectId(null);
      await repairSession();
      return apiFetch(path, options, false);
    }
    throw new Error(msg);
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

export const auth = {
  login: (email: string, password: string) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data: { email: string; password: string; name?: string; orgName?: string }) =>
    apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me: () => apiFetch('/api/auth/me'),
};