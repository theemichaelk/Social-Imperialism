export function getApiBase(): string {
  // Browser: same-origin /api proxy (Next.js rewrites → production API, no CORS issues).
  if (typeof window !== 'undefined') return '';
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('si_token');
}

export function setSession(data: { token: string; project?: { id: string } }) {
  localStorage.setItem('si_token', data.token);
  if (data.project?.id) localStorage.setItem('si_project_id', data.project.id);
}

export function clearSession() {
  localStorage.removeItem('si_token');
  localStorage.removeItem('si_project_id');
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const projectId = typeof window !== 'undefined' ? localStorage.getItem('si_project_id') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (projectId) headers['x-project-id'] = projectId;

  const res = await fetch(`${getApiBase()}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

/** Drop-in replacement for Electron ipcRenderer.invoke */
export async function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  const res = await apiFetch(`/api/invoke/${channel}`, {
    method: 'POST',
    body: JSON.stringify({ args }),
  });
  return res.data as T;
}

export const auth = {
  login: (email: string, password: string) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data: { email: string; password: string; name?: string; orgName?: string }) =>
    apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me: () => apiFetch('/api/auth/me'),
};