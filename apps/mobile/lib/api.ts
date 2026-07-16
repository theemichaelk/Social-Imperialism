import { Platform, Linking } from 'react-native';
import { storage } from '@/lib/storage';

const TOKEN_KEY = 'si_token';
const PROJECT_KEY = 'si_project_id';

export type BrandProject = {
  id: string;
  name?: string;
  brandName?: string;
  domain?: string;
  description?: string;
  isActive?: boolean;
  organizationId?: string;
};

export type MeResponse = {
  user?: { id: string; email?: string; name?: string; isAdmin?: boolean };
  project?: { id: string; name?: string };
  projects?: BrandProject[];
  allProjects?: BrandProject[];
  organization?: { id: string; name?: string; plan?: string };
  hasActiveSubscription?: boolean;
  needsPasswordSetup?: string | boolean;
  subscribeUrl?: string;
  setupUrl?: string;
  billing?: {
    plan?: string;
    planName?: string;
    status?: string;
    priceLabel?: string;
    billingEmail?: string;
    limits?: Record<string, unknown>;
  };
};

export type ApiError = Error & {
  code?: string;
  status?: number;
  subscribeUrl?: string;
  planLimit?: boolean;
};

function getApiBase(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_API_URL || 'https://api.socialimperialism.com';
}

function asError(message: string, extra: Partial<ApiError> = {}): ApiError {
  const err = new Error(message) as ApiError;
  Object.assign(err, extra);
  return err;
}

function safeString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (v == null) return fallback;
  try {
    return String(v);
  } catch {
    return fallback;
  }
}

export async function getToken() {
  return storage.getItem(TOKEN_KEY);
}

export async function getProjectId() {
  const id = await storage.getItem(PROJECT_KEY);
  if (!id || id.startsWith('camp_')) return null;
  return id;
}

export async function setSession(data: { token: string; project?: { id: string } }) {
  if (!data?.token || typeof data.token !== 'string') {
    throw asError('Invalid login response — missing token.');
  }
  await storage.setItem(TOKEN_KEY, data.token);
  if (data.project?.id && typeof data.project.id === 'string') {
    await storage.setItem(PROJECT_KEY, data.project.id);
  }
}

export async function clearSession() {
  await storage.removeItem(TOKEN_KEY);
  await storage.removeItem(PROJECT_KEY);
}

export async function setProjectId(id: string | null) {
  if (id) await storage.setItem(PROJECT_KEY, id);
  else await storage.removeItem(PROJECT_KEY);
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<Record<string, unknown>> {
  const token = await getToken();
  const projectId = await getProjectId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (projectId) headers['x-project-id'] = projectId;

  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, { ...options, headers });
  } catch (e) {
    throw asError(
      `Network error — check Wi-Fi and API reachability. (${safeString((e as Error)?.message, 'fetch failed')})`,
    );
  }

  let json: Record<string, unknown> = {};
  try {
    const text = await res.text();
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = {};
  }

  if (!res.ok) {
    const msg = safeString(json.error || json.message, res.statusText || 'Request failed');
    const planLimit =
      json.planLimit === true
      || safeString(json.code) === 'PLAN_BRAND_LIMIT'
      || /free plan|plan limit|1 brand|upgrade to create|brand limit/i.test(msg);
    if (retry && /project not found|no project/i.test(msg)) {
      await setProjectId(null);
      await repairSession().catch(() => undefined);
      return apiFetch(path, options, false);
    }
    throw asError(msg, {
      status: res.status,
      code: safeString(json.code) || undefined,
      subscribeUrl: safeString(json.subscribeUrl) || undefined,
      planLimit,
    });
  }

  return json;
}

/** Normalize projects list from /api/auth/me — never throw on shape drift. */
export function normalizeProjects(me: MeResponse | null | undefined): BrandProject[] {
  if (!me || typeof me !== 'object') return [];
  const raw = Array.isArray(me.projects)
    ? me.projects
    : Array.isArray(me.allProjects)
      ? me.allProjects
      : [];
  return raw
    .filter((p): p is BrandProject => !!p && typeof p === 'object' && typeof p.id === 'string')
    .map((p) => ({
      id: p.id,
      name: safeString(p.name || p.brandName, 'Untitled brand'),
      brandName: safeString(p.brandName || p.name, 'Untitled brand'),
      domain: safeString(p.domain),
      description: safeString(p.description),
      isActive: !!p.isActive,
      organizationId: p.organizationId,
    }));
}

export async function fetchMe(): Promise<MeResponse> {
  const me = (await apiFetch('/api/auth/me')) as MeResponse;
  return me && typeof me === 'object' ? me : {};
}

export async function repairSession(): Promise<MeResponse | null> {
  const token = await getToken();
  if (!token) return null;
  const me = await fetchMe();
  const projects = normalizeProjects(me);
  const active =
    me.project?.id
    || projects.find((p) => p.isActive)?.id
    || projects[0]?.id
    || null;
  await setProjectId(active);
  return me;
}

export async function listProjects(): Promise<BrandProject[]> {
  try {
    const res = await apiFetch('/api/orgs/projects');
    const list = Array.isArray(res.projects) ? res.projects : [];
    return list
      .filter((p): p is BrandProject => !!p && typeof p === 'object' && typeof (p as BrandProject).id === 'string')
      .map((p) => {
        const proj = p as BrandProject;
        return {
          id: proj.id,
          name: safeString(proj.name || proj.brandName, 'Untitled brand'),
          brandName: safeString(proj.brandName || proj.name, 'Untitled brand'),
          domain: safeString(proj.domain),
          description: safeString(proj.description),
          isActive: !!proj.isActive,
        };
      });
  } catch {
    // Fallback: brands from /me
    const me = await fetchMe();
    return normalizeProjects(me);
  }
}

export async function createProject(input: {
  name: string;
  brandName?: string;
  domain?: string;
  description?: string;
}): Promise<BrandProject> {
  const res = await apiFetch('/api/orgs/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const project = res.project as BrandProject | undefined;
  if (!project?.id) throw asError('Could not create brand — empty response.');
  return {
    id: project.id,
    name: safeString(project.name || project.brandName, input.name),
    brandName: safeString(project.brandName || project.name, input.name),
    domain: safeString(project.domain || input.domain),
    description: safeString(project.description || input.description),
    isActive: !!project.isActive,
  };
}

export async function activateProject(id: string): Promise<void> {
  await apiFetch(`/api/orgs/projects/${encodeURIComponent(id)}/activate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  await setProjectId(id);
}

export async function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  if (!channel || typeof channel !== 'string') {
    throw asError('Invalid invoke channel.');
  }
  const res = await apiFetch(`/api/invoke/${encodeURIComponent(channel)}`, {
    method: 'POST',
    body: JSON.stringify({ args }),
  });

  // Some handlers return envelopes; always prefer data when present.
  const data = ('data' in res ? res.data : res) as T;
  const checkoutUrl =
    (data as { checkoutUrl?: string } | null | undefined)?.checkoutUrl
    || (res.checkoutUrl as string | undefined);

  if (checkoutUrl && typeof checkoutUrl === 'string') {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(checkoutUrl, '_blank');
    } else {
      await Linking.openURL(checkoutUrl).catch(() => undefined);
    }
  }

  return data;
}

export const auth = {
  login: async (email: string, password: string) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (typeof res.token !== 'string') {
      throw asError('Login failed — server did not return a token.');
    }
    return res as { token: string; project?: { id: string }; user?: MeResponse['user'] };
  },
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
  me: fetchMe,
};

export function webUrl(path = '/'): string {
  const base = (process.env.EXPO_PUBLIC_WEB_URL || 'https://www.socialimperialism.com').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
