/**
 * DNS site registry + record management with optional AWS Route53 apply.
 */
const dns = require('dns').promises;
const crypto = require('crypto');

const STORE_KEY = 'org_dnsStore';
const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'];

function loadJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJson(store, key, value) {
  store.setItem(key, JSON.stringify(value));
}

function normalizeDomain(raw) {
  if (!raw) return '';
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
}

function siteIdFor(domain) {
  return `site_${normalizeDomain(domain).replace(/[^a-z0-9]/g, '_')}`;
}

function recordId() {
  return `rec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || process.env.SEED_EMAIL || 'theesaintmichael@gmail.com,michaelk@tsbrenterprises.com';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function getInvokeContext(store) {
  return store._invokeContext || {};
}

async function getUserRole(email, orgId) {
  if (!email || !orgId) return 'member';
  try {
    const { prisma } = require('@si/db');
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return 'member';
    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
    });
    return membership?.role || 'member';
  } catch (e) {
    return 'member';
  }
}

function isPlatformAdmin(email) {
  return getAdminEmails().includes(String(email || '').toLowerCase());
}

function emptyStore() {
  return { sites: [], records: {}, updatedAt: new Date().toISOString() };
}

function loadDnsStore(store) {
  return loadJson(store, STORE_KEY, emptyStore());
}

function saveDnsStore(store, data) {
  saveJson(store, STORE_KEY, { ...data, updatedAt: new Date().toISOString() });
}

function upsertSite(store, site) {
  const data = loadDnsStore(store);
  const domain = normalizeDomain(site.domain);
  if (!domain) return null;
  const id = site.id || siteIdFor(domain);
  const existing = data.sites.find((s) => s.id === id || normalizeDomain(s.domain) === domain);
  const next = {
    id,
    domain,
    name: site.name || domain,
    source: site.source || 'manual',
    projectId: site.projectId || null,
    organizationId: site.organizationId || store.organizationId || null,
    scope: site.scope || (site.source === 'admin' ? 'admin' : 'client'),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hostedZoneId: site.hostedZoneId || existing?.hostedZoneId || process.env.ROUTE53_HOSTED_ZONE_ID || null,
    status: site.status || 'active',
  };
  if (existing) {
    Object.assign(existing, next);
  } else {
    data.sites.push(next);
    if (!data.records[id]) data.records[id] = defaultRecordsForSite(next);
  }
  saveDnsStore(store, data);
  return next;
}

function defaultRecordsForSite(site) {
  const domain = site.domain;
  const cf = process.env.DEFAULT_CLOUDFRONT_DOMAIN || 'd1azg31w2pn0x4.cloudfront.net';
  if (domain === 'socialimperialism.com') {
    return [
      { id: recordId(), type: 'A', name: '@', value: cf, ttl: 300, alias: true, status: 'draft' },
      { id: recordId(), type: 'CNAME', name: 'www', value: cf, ttl: 300, status: 'draft' },
      { id: recordId(), type: 'CNAME', name: 'api', value: 'd2cu5rkstjz0rg.cloudfront.net', ttl: 300, status: 'draft' },
    ];
  }
  return [
    { id: recordId(), type: 'A', name: '@', value: 'YOUR_SERVER_IP', ttl: 300, status: 'draft' },
    { id: recordId(), type: 'CNAME', name: 'www', value: domain, ttl: 300, status: 'draft' },
  ];
}

function syncSitesFromProject(store) {
  let campaigns = [];
  try { campaigns = JSON.parse(store.getItem('campaigns') || '[]'); } catch (e) {}
  const synced = [];
  for (const c of campaigns) {
    const domain = normalizeDomain(c.domain);
    if (!domain) continue;
    synced.push(upsertSite(store, {
      domain,
      name: c.brandName || c.name || domain,
      source: 'project',
      projectId: c.id,
      organizationId: store.organizationId,
      scope: 'client',
    }));
  }
  return synced.filter(Boolean);
}

function syncSitesFromQuantum(store) {
  const jobs = loadJson(store, 'quantumPagesJobs', []);
  const campaign = (() => {
    try {
      const activeId = store.getItem('activeCampaignId') || 'default';
      return JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeId) || {};
    } catch (e) { return {}; }
  })();
  const domain = normalizeDomain(campaign.domain);
  if (!domain) return [];
  return [upsertSite(store, {
    domain,
    name: `${campaign.brandName || 'Quantum Pages'} (AI Site)`,
    source: 'quantum',
    projectId: campaign.id,
    organizationId: store.organizationId,
    scope: 'admin',
  })].filter(Boolean);
}

function seedAdminSites(store) {
  const adminDomains = [
    { domain: 'socialimperialism.com', name: 'Social Imperialism (Platform)', source: 'admin' },
    { domain: 'www.socialimperialism.com', name: 'Social Imperialism WWW', source: 'admin' },
  ];
  return adminDomains.map((s) => upsertSite(store, { ...s, scope: 'admin', source: 'admin' })).filter(Boolean);
}

async function syncAllSites(store, { includeAdmin = false } = {}) {
  syncSitesFromProject(store);
  syncSitesFromQuantum(store);
  if (includeAdmin) seedAdminSites(store);
  return loadDnsStore(store).sites;
}

function canAccessSite(store, site, ctx) {
  const email = ctx.email;
  const orgId = ctx.orgId || store.organizationId;
  if (isPlatformAdmin(email)) return true;
  if (site.organizationId && site.organizationId !== orgId) return false;
  if (site.scope === 'admin' && !isPlatformAdmin(email)) return false;
  return true;
}

async function listSites(store, ctx = {}) {
  const invokeCtx = { ...getInvokeContext(store), ...ctx };
  const isAdmin = isPlatformAdmin(invokeCtx.email) || ['owner', 'admin'].includes(await getUserRole(invokeCtx.email, invokeCtx.orgId));

  if (isAdmin) {
    await syncAllSites(store, { includeAdmin: true });
    try {
      const { prisma } = require('@si/db');
      const allSettings = await prisma.orgSetting.findMany({ where: { key: STORE_KEY } });
      const merged = { sites: [], records: {} };
      for (const row of allSettings) {
        let parsed = emptyStore();
        try { parsed = JSON.parse(row.value || '{}'); } catch (e) {}
        for (const site of parsed.sites || []) {
          if (!merged.sites.find((s) => normalizeDomain(s.domain) === normalizeDomain(site.domain))) {
            merged.sites.push(site);
          }
          if (parsed.records?.[site.id]) merged.records[site.id] = parsed.records[site.id];
        }
      }
      const local = loadDnsStore(store);
      for (const site of local.sites) {
        if (!merged.sites.find((s) => s.id === site.id)) merged.sites.push(site);
      }
      Object.assign(local.records, merged.records);
      local.sites = merged.sites.sort((a, b) => a.name.localeCompare(b.name));
      saveDnsStore(store, local);
    } catch (e) {
      await syncAllSites(store, { includeAdmin: true });
    }
  } else {
    await syncAllSites(store, { includeAdmin: false });
  }

  const data = loadDnsStore(store);
  const sites = data.sites.filter((s) => canAccessSite(store, s, invokeCtx));
  return { sites, isAdmin, total: sites.length };
}

function getRecords(store, siteId) {
  const data = loadDnsStore(store);
  return data.records[siteId] || [];
}

function saveRecord(store, siteId, record) {
  const data = loadDnsStore(store);
  const site = data.sites.find((s) => s.id === siteId);
  if (!site) throw new Error('Site not found');

  const type = String(record.type || 'A').toUpperCase();
  if (!RECORD_TYPES.includes(type)) throw new Error(`Invalid record type: ${type}`);
  if (!record.name?.trim()) throw new Error('Record name required');
  if (!record.value?.trim()) throw new Error('Record value required');

  const records = data.records[siteId] || [];
  const idx = records.findIndex((r) => r.id === record.id);
  const next = {
    id: record.id || recordId(),
    type,
    name: record.name.trim(),
    value: record.value.trim(),
    ttl: parseInt(record.ttl || '300', 10),
    priority: record.priority != null ? parseInt(record.priority, 10) : undefined,
    alias: !!record.alias,
    status: record.status || 'draft',
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) records[idx] = { ...records[idx], ...next };
  else records.push(next);
  data.records[siteId] = records;
  saveDnsStore(store, data);
  return next;
}

function deleteRecord(store, siteId, recordId) {
  const data = loadDnsStore(store);
  const records = data.records[siteId] || [];
  data.records[siteId] = records.filter((r) => r.id !== recordId);
  saveDnsStore(store, data);
  return { success: true };
}

function fqdn(name, domain) {
  if (!name || name === '@') return domain;
  if (name.endsWith(domain)) return name;
  return `${name}.${domain}`;
}

async function verifyRecord(site, record) {
  const domain = site.domain;
  const host = fqdn(record.name, domain);
  try {
    if (record.type === 'A') {
      const res = await dns.resolve4(host).catch(() => []);
      return { ok: res.length > 0, resolved: res, host };
    }
    if (record.type === 'AAAA') {
      const res = await dns.resolve6(host).catch(() => []);
      return { ok: res.length > 0, resolved: res, host };
    }
    if (record.type === 'CNAME') {
      const res = await dns.resolveCname(host).catch(() => []);
      const target = record.value.replace(/\.$/, '').toLowerCase();
      const ok = res.some((r) => r.replace(/\.$/, '').toLowerCase().includes(target) || target.includes(r.replace(/\.$/, '').toLowerCase()));
      return { ok, resolved: res, host };
    }
    if (record.type === 'MX') {
      const res = await dns.resolveMx(host).catch(() => []);
      return { ok: res.length > 0, resolved: res, host };
    }
    if (record.type === 'TXT') {
      const res = await dns.resolveTxt(host).catch(() => []);
      const flat = res.map((r) => r.join('')).join(' ');
      const ok = flat.includes(record.value.replace(/^"|"$/g, ''));
      return { ok, resolved: res, host };
    }
    return { ok: false, error: 'Verification not supported for this type', host };
  } catch (e) {
    return { ok: false, error: e.message, host };
  }
}

function getRoute53Client() {
  const key = process.env.AWS_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_S3_REGION || process.env.AWS_REGION || 'us-east-1';
  if (!key || !secret) return null;
  const { Route53Client } = require('@aws-sdk/client-route-53');
  return new Route53Client({ region, credentials: { accessKeyId: key, secretAccessKey: secret } });
}

async function findHostedZone(domain) {
  const client = getRoute53Client();
  if (!client) return null;
  const { ListHostedZonesByNameCommand } = require('@aws-sdk/client-route-53');
  const res = await client.send(new ListHostedZonesByNameCommand({ DNSName: domain, MaxItems: '10' }));
  const zones = res.HostedZones || [];
  const match = zones.find((z) => normalizeDomain(z.Name) === domain || domain.endsWith(normalizeDomain(z.Name)));
  return match ? { id: match.Id.replace('/hostedzone/', ''), name: normalizeDomain(match.Name) } : null;
}

async function applyRecordsToRoute53(store, siteId) {
  const client = getRoute53Client();
  if (!client) throw new Error('AWS credentials not configured for Route53');

  const data = loadDnsStore(store);
  const site = data.sites.find((s) => s.id === siteId);
  if (!site) throw new Error('Site not found');

  const records = data.records[siteId] || [];
  if (!records.length) throw new Error('No DNS records to apply');

  let zoneId = site.hostedZoneId || process.env.ROUTE53_HOSTED_ZONE_ID;
  if (!zoneId) {
    const zone = await findHostedZone(site.domain);
    if (!zone) throw new Error(`No Route53 hosted zone found for ${site.domain}`);
    zoneId = zone.id;
    site.hostedZoneId = zoneId;
  }

  const { ChangeResourceRecordSetsCommand } = require('@aws-sdk/client-route-53');
  const changes = records.map((rec) => {
    const name = fqdn(rec.name, site.domain);
    const isAlias = rec.alias && rec.type === 'A';
    if (isAlias) {
      return {
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: name.endsWith('.') ? name : `${name}.`,
          Type: rec.type,
          AliasTarget: {
            HostedZoneId: 'Z2FDTNDATAQYW2',
            DNSName: rec.value.endsWith('.') ? rec.value : `${rec.value}.`,
            EvaluateTargetHealth: false,
          },
        },
      };
    }
    const rr = { Value: rec.type === 'TXT' && !rec.value.startsWith('"') ? `"${rec.value}"` : rec.value };
    const set = {
      Name: name.endsWith('.') ? name : `${name}.`,
      Type: rec.type,
      TTL: rec.ttl || 300,
      ResourceRecords: [rr],
    };
    return { Action: 'UPSERT', ResourceRecordSet: set };
  });

  const result = await client.send(new ChangeResourceRecordSetsCommand({
    HostedZoneId: zoneId,
    ChangeBatch: { Comment: `Social Imperialism DNS apply for ${site.domain}`, Changes: changes },
  }));

  records.forEach((r) => { r.status = 'applied'; r.appliedAt = new Date().toISOString(); });
  data.records[siteId] = records;
  saveDnsStore(store, data);

  return {
    success: true,
    changeId: result.ChangeInfo?.Id,
    status: result.ChangeInfo?.Status,
    zoneId,
    applied: records.length,
  };
}

function exportRecords(site, records) {
  return {
    domain: site.domain,
    exportedAt: new Date().toISOString(),
    records: records.map((r) => ({
      type: r.type,
      name: fqdn(r.name, site.domain),
      value: r.value,
      ttl: r.ttl,
      priority: r.priority,
    })),
    route53: {
      Changes: records.map((r) => ({
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: `${fqdn(r.name, site.domain)}.`,
          Type: r.type,
          TTL: r.ttl || 300,
          ResourceRecords: [{ Value: r.value }],
        },
      })),
    },
  };
}

module.exports = {
  RECORD_TYPES,
  normalizeDomain,
  loadDnsStore,
  listSites,
  syncAllSites,
  upsertSite,
  getRecords,
  saveRecord,
  deleteRecord,
  verifyRecord,
  applyRecordsToRoute53,
  exportRecords,
  isPlatformAdmin,
};