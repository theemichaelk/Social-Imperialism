/**
 * Drop-in replacement for node-localstorage — backs desktop services with Prisma.
 * Maps all desktop localStorage keys to ProjectSetting + OrgSetting rows.
 */
const { prisma } = require('@si/db');

const ORG_KEYS = new Set(['globalApiKeys', 'billingPlan', 'paymentHistory']);

class PrismaStore {
  constructor({ projectId, organizationId }) {
    this.projectId = projectId;
    this.organizationId = organizationId;
    this._cache = new Map();
  }

  _isOrgKey(key) {
    return ORG_KEYS.has(key) || key.startsWith('org_');
  }

  async _load(key) {
    if (this._cache.has(key)) return this._cache.get(key);

    let value = null;
    if (this._isOrgKey(key)) {
      const row = await prisma.orgSetting.findUnique({
        where: { organizationId_key: { organizationId: this.organizationId, key } },
      });
      value = row?.value ?? null;
    } else {
      const row = await prisma.projectSetting.findUnique({
        where: { projectId_key: { projectId: this.projectId, key } },
      });
      value = row?.value ?? null;
    }
    this._cache.set(key, value);
    return value;
  }

  async _persist(key, value) {
    this._cache.set(key, value);
    if (this._isOrgKey(key)) {
      await prisma.orgSetting.upsert({
        where: { organizationId_key: { organizationId: this.organizationId, key } },
        update: { value: value ?? '' },
        create: { organizationId: this.organizationId, key, value: value ?? '' },
      });
    } else {
      await prisma.projectSetting.upsert({
        where: { projectId_key: { projectId: this.projectId, key } },
        update: { value: value ?? '' },
        create: { projectId: this.projectId, key, value: value ?? '' },
      });
    }
  }

  getItem(key) {
    if (this._cache.has(key)) return this._cache.get(key);
    // Sync facade: block until loaded (desktop services expect sync API)
    const { execSync } = require('child_process');
    throw new Error(`PrismaStore.getItem("${key}") called synchronously — use AsyncPrismaStore or preload()`);
  }

  setItem(key, value) {
    this._cache.set(key, String(value));
    this._pending = this._pending || new Map();
    this._pending.set(key, String(value));
    this._scheduleFlush();
    return undefined;
  }

  removeItem(key) {
    this._cache.delete(key);
    this._pending = this._pending || new Map();
    this._pending.set(key, null);
    this._scheduleFlush();
  }

  _scheduleFlush() {
    if (this._flushTimer) return;
    this._flushTimer = setImmediate(() => this.flush());
  }

  async flush() {
    this._flushTimer = null;
    if (!this._pending?.size) return;
    const batch = new Map(this._pending);
    this._pending.clear();
    for (const [key, value] of batch) {
      if (value === null) {
        if (this._isOrgKey(key)) {
          await prisma.orgSetting.deleteMany({ where: { organizationId: this.organizationId, key } });
        } else {
          await prisma.projectSetting.deleteMany({ where: { projectId: this.projectId, key } });
        }
        this._cache.delete(key);
      } else {
        await this._persist(key, value);
      }
    }
  }

  async preload(keys) {
    const projectRows = await prisma.projectSetting.findMany({
      where: { projectId: this.projectId, key: { in: keys.filter((k) => !this._isOrgKey(k)) } },
    });
    projectRows.forEach((r) => this._cache.set(r.key, r.value));

    const orgKeys = keys.filter((k) => this._isOrgKey(k));
    if (orgKeys.length) {
      const orgRows = await prisma.orgSetting.findMany({
        where: { organizationId: this.organizationId, key: { in: orgKeys } },
      });
      orgRows.forEach((r) => this._cache.set(r.key, r.value));
    }
  }

  async preloadAll() {
    const [projectRows, orgRows] = await Promise.all([
      prisma.projectSetting.findMany({ where: { projectId: this.projectId } }),
      prisma.orgSetting.findMany({ where: { organizationId: this.organizationId } }),
    ]);
    projectRows.forEach((r) => this._cache.set(r.key, r.value));
    orgRows.forEach((r) => this._cache.set(r.key, r.value));
  }

  clear() {
    this._cache.clear();
  }
}

/** Sync-compatible store — preloads all settings then serves from memory with async flush */
async function createPrismaStore({ projectId, organizationId }) {
  const store = new PrismaStore({ projectId, organizationId });
  await store.preloadAll();

  // Patch sync getItem to use cache only
  store.getItem = function getItem(key) {
    return this._cache.has(key) ? this._cache.get(key) : null;
  };

  return store;
}

module.exports = { PrismaStore, createPrismaStore, ORG_KEYS };