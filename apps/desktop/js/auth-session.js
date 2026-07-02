/**
 * Desktop authentication — session guard, validation, login, logout.
 */
const AUTH_TIMEOUT_MS = 15000;
const PUBLIC_PAGES = new Set(['login.html']);

function currentPageName() {
  if (typeof window === 'undefined') return '';
  const path = window.location.pathname || '';
  const file = path.split('/').pop() || 'login.html';
  return file.split('?')[0].split('#')[0];
}

function isPublicPage() {
  return PUBLIC_PAGES.has(currentPageName());
}

function validateEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    return { ok: false, message: 'Email is required.' };
  }
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  if (!emailRegex.test(normalized)) {
    return { ok: false, message: 'Enter a valid email address.' };
  }
  return { ok: true, email: normalized };
}

function validatePassword(password) {
  const value = String(password || '');
  if (!value) {
    return { ok: false, message: 'Password is required.' };
  }
  if (value.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters.' };
  }
  if (!/[a-zA-Z]/.test(value)) {
    return { ok: false, message: 'Password must include at least one letter.' };
  }
  if (!/[0-9]/.test(value)) {
    return { ok: false, message: 'Password must include at least one number.' };
  }
  return { ok: true };
}

function getIpcRenderer() {
  try {
    return require('electron').ipcRenderer;
  } catch (e) {
    return null;
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error('Connection timed out. Check your internet and try again.');
    }
    throw new Error('Could not reach the authentication server. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
}

async function getApiUrl() {
  const ipc = getIpcRenderer();
  if (!ipc) return null;
  return ipc.invoke('get-saas-api-url');
}

async function getStoredSession() {
  const ipc = getIpcRenderer();
  if (!ipc) return { token: null, projectId: null, email: null };
  return ipc.invoke('get-saas-session');
}

async function clearStoredSession() {
  const ipc = getIpcRenderer();
  if (!ipc) return;
  await ipc.invoke('clear-saas-session');
}

async function saveStoredSession(data) {
  const ipc = getIpcRenderer();
  if (!ipc) return;
  await ipc.invoke('save-saas-session', data);
}

async function verifySessionToken(token) {
  if (!token) return false;
  try {
    const apiUrl = await getApiUrl();
    if (!apiUrl) return false;
    const response = await fetchWithTimeout(
      `${apiUrl}/api/auth/me`,
      { headers: { Authorization: `Bearer ${token}` } },
      AUTH_TIMEOUT_MS,
    );
    if (!response.ok) return false;
    const data = await response.json().catch(() => ({}));
    if (data.user?.isAdmin) return true;
    if (data.needsPasswordSetup) return false;
    return data.hasActiveSubscription !== false;
  } catch (e) {
    return false;
  }
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const target = 'login.html';
  if (currentPageName() === target) return;
  window.location.replace(target);
}

let guardRunning = false;
let guardComplete = false;
let logoutInProgress = false;

async function requireAuth() {
  if (isPublicPage()) return true;
  if (guardComplete) return true;
  if (guardRunning) return false;
  guardRunning = true;

  try {
    const session = await getStoredSession();
    if (!session?.token) {
      await clearStoredSession();
      redirectToLogin();
      return false;
    }
    const valid = await verifySessionToken(session.token);
    if (!valid) {
      await clearStoredSession();
      redirectToLogin();
      return false;
    }
    guardComplete = true;
    return true;
  } catch (e) {
    await clearStoredSession();
    redirectToLogin();
    return false;
  } finally {
    guardRunning = false;
  }
}

async function login(email, password) {
  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) {
    return { ok: false, error: emailCheck.message };
  }
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) {
    return { ok: false, error: passwordCheck.message };
  }

  try {
    const apiUrl = await getApiUrl();
    const response = await fetchWithTimeout(
      `${apiUrl}/api/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailCheck.email, password }),
      },
      AUTH_TIMEOUT_MS,
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        error: data.error || 'Sign in failed.',
        setupUrl: data.setupUrl || null,
        subscribeUrl: data.subscribeUrl || null,
      };
    }
    await saveStoredSession(data);
    guardComplete = true;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message || 'Sign in failed.' };
  }
}

async function logout() {
  if (logoutInProgress) return;
  logoutInProgress = true;
  guardComplete = false;

  try {
    const session = await getStoredSession();
    if (session?.token) {
      try {
        const apiUrl = await getApiUrl();
        await fetchWithTimeout(
          `${apiUrl}/api/auth/logout`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.token}`,
              'Content-Type': 'application/json',
            },
          },
          AUTH_TIMEOUT_MS,
        );
      } catch (e) {
        /* still clear local session */
      }
    }
    await clearStoredSession();
    if (typeof window !== 'undefined') {
      window.location.replace('login.html');
    }
  } finally {
    logoutInProgress = false;
  }
}

function bindBackButtonGuard() {
  if (typeof window === 'undefined' || isPublicPage()) return;

  window.addEventListener('popstate', async () => {
    const session = await getStoredSession();
    if (!session?.token) {
      redirectToLogin();
      return;
    }
    const valid = await verifySessionToken(session.token);
    if (!valid) {
      await clearStoredSession();
      redirectToLogin();
    }
  });

  try {
    window.history.pushState({ siAuthGuard: true }, '', window.location.href);
  } catch (e) {
    /* ignore */
  }
}

function bindLogoutButton() {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('siSignOutBtn');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', async (event) => {
    event.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Signing out…';
    await logout();
  });
}

async function initAuthSession() {
  if (isPublicPage()) return;
  const allowed = await requireAuth();
  if (!allowed) return;
  bindBackButtonGuard();
  bindLogoutButton();
}

module.exports = {
  PUBLIC_PAGES,
  isPublicPage,
  validateEmail,
  validatePassword,
  requireAuth,
  login,
  logout,
  initAuthSession,
  bindLogoutButton,
  bindBackButtonGuard,
  verifySessionToken,
  getStoredSession,
  clearStoredSession,
};