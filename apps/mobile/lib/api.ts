import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { storage } from '@/lib/storage';

// Native Expo Go: direct API. Web/Safari: same-origin proxy via Metro (metro.config.js).
function getApiBase(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_API_URL || 'https://api.socialimperialism.com';
}

const TOKEN_KEY = 'si_token';
const PROJECT_KEY = 'si_project_id';

export async function getToken() {
  return storage.getItem(TOKEN_KEY);
}

export async function getProjectId() {
  const id = await storage.getItem(PROJECT_KEY);
  if (id?.startsWith('camp_')) return null;
  return id;
}

export async function setSession(data: { token: string; project?: { id: string } }) {
  await storage.setItem(TOKEN_KEY, data.token);
  if (data.project?.id) await storage.setItem(PROJECT_KEY, data.project.id);
}

export async function clearSession() {
  await storage.removeItem(TOKEN_KEY);
  await storage.removeItem(PROJECT_KEY);
}

export async function setProjectId(id: string | null) {
  if (id) await storage.setItem(PROJECT_KEY, id);
  else await storage.removeItem(PROJECT_KEY);
}

type MeResponse = {
  project?: { id: string };
  projects?: Array<{ id: string; isActive?: boolean }>;
};

export async function apiFetch(path: string, options: RequestInit = {}, retry = true): Promise<Record<string, unknown>> {
  const token = await getToken();
  const projectId = await getProjectId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (projectId) headers['x-project-id'] = projectId;

  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, { ...options, headers });
  } catch (e) {
    throw new Error(`Network error — check Wi-Fi and that the dev server is running. (${(e as Error).message})`);
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.error as string) || res.statusText;
    if (retry && /project not found/i.test(msg)) {
      await setProjectId(null);
      await repairSession();
      return apiFetch(path, options, false);
    }
    throw new Error(msg);
  }
  return json;
}

export async function repairSession() {
  const token = await getToken();
  if (!token) return;
  const me = (await apiFetch('/api/auth/me')) as MeResponse;
  const active =
    me.project?.id
    || me.projects?.find((p) => p.isActive)?.id
    || me.projects?.[0]?.id;
  await setProjectId(active ?? null);
}

export async function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  const res = await apiFetch(`/api/invoke/${channel}`, {
    method: 'POST',
    body: JSON.stringify({ args }),
  });
  const data = res.data as T;
  const checkoutUrl = (res.data as { checkoutUrl?: string } | undefined)?.checkoutUrl;
  if (checkoutUrl) {
    if (Platform.OS === 'web') window.open(checkoutUrl, '_blank');
    else await WebBrowser.openBrowserAsync(checkoutUrl);
  }
  return data;
}

export const auth = {
  login: (email: string, password: string) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }) as Promise<{ token: string; project?: { id: string } }>,
  setupPassword: (email: string, password: string) =>
    apiFetch('/api/auth/setup-password', { method: 'POST', body: JSON.stringify({ email, password }) }) as Promise<{ token: string; project?: { id: string } }>,
  forgotPassword: (email: string) =>
    apiFetch('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }) as Promise<{ success: boolean; message: string }>,
  resetPassword: (token: string, password: string) =>
    apiFetch('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }) as Promise<{ success: boolean; message: string }>,
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
};