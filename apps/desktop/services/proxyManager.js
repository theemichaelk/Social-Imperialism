/**
 * Proxy / IP pool for assigning unique network identities per social profile kit.
 */
const STORAGE_KEY = 'proxyPool';

function getProxyPool(store) {
  try {
    return JSON.parse(store.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveProxyPool(store, proxies) {
  store.setItem(STORAGE_KEY, JSON.stringify(proxies));
}

function makeProxyId() {
  return `proxy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeProxy(input = {}) {
  const host = String(input.host || '').trim();
  const port = parseInt(input.port, 10);
  if (!host || Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error('Proxy requires a valid host and port (1–65535).');
  }
  return {
    id: input.id || makeProxyId(),
    label: String(input.label || `${host}:${port}`).trim(),
    host,
    port,
    protocol: ['http', 'https', 'socks5'].includes(input.protocol) ? input.protocol : 'http',
    username: String(input.username || '').trim() || null,
    password: String(input.password || '').trim() || null,
    country: String(input.country || '').trim() || null,
    status: input.status === 'inactive' ? 'inactive' : 'active',
    assignedKitId: input.assignedKitId || null,
    notes: String(input.notes || '').trim() || null,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastCheckedAt: input.lastCheckedAt || null,
  };
}

function formatProxyUrl(proxy) {
  if (!proxy?.host || !proxy?.port) return null;
  const auth = proxy.username
    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password || '')}@`
    : '';
  return `${proxy.protocol || 'http'}://${auth}${proxy.host}:${proxy.port}`;
}

function addProxy(store, proxyInput) {
  const proxies = getProxyPool(store);
  const proxy = normalizeProxy(proxyInput);
  proxies.push(proxy);
  saveProxyPool(store, proxies);
  return proxy;
}

function updateProxy(store, id, updates) {
  const proxies = getProxyPool(store);
  const idx = proxies.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error('Proxy not found.');
  const merged = normalizeProxy({ ...proxies[idx], ...updates, id });
  proxies[idx] = merged;
  saveProxyPool(store, proxies);
  return merged;
}

function deleteProxy(store, id) {
  const proxies = getProxyPool(store).filter((p) => p.id !== id);
  saveProxyPool(store, proxies);
  return { success: true };
}

function assignProxyToKit(store, proxyId, kitId) {
  const proxies = getProxyPool(store);
  proxies.forEach((p) => {
    if (p.assignedKitId === kitId && p.id !== proxyId) {
      p.assignedKitId = null;
      p.updatedAt = new Date().toISOString();
    }
  });
  const idx = proxies.findIndex((p) => p.id === proxyId);
  if (idx >= 0) {
    proxies[idx].assignedKitId = kitId || null;
    proxies[idx].updatedAt = new Date().toISOString();
  }
  saveProxyPool(store, proxies);
  return proxies[idx] || null;
}

function getAvailableProxies(store) {
  return getProxyPool(store).filter((p) => p.status === 'active' && !p.assignedKitId);
}

function findProxyById(store, id) {
  return getProxyPool(store).find((p) => p.id === id) || null;
}

module.exports = {
  STORAGE_KEY,
  getProxyPool,
  saveProxyPool,
  makeProxyId,
  normalizeProxy,
  formatProxyUrl,
  addProxy,
  updateProxy,
  deleteProxy,
  assignProxyToKit,
  getAvailableProxies,
  findProxyById,
};