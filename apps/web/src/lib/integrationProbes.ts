import { LIVE_INTEGRATION_TESTS } from '@/lib/integrationCatalog';

export type ProbeResult = {
  id: string;
  label: string;
  status: 'idle' | 'running' | 'pass' | 'fail' | 'warn';
  ms?: number;
  summary?: string;
  metric?: string;
  category?: string;
};

export function summarizeProbe(data: unknown): string {
  if (data == null) return 'No data';
  if (Array.isArray(data)) return `${data.length} items`;
  if (typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (d.error) return String(d.error).slice(0, 80);
    if (d.success === false) return String(d.error || 'Failed').slice(0, 80);
    if (d.shortUrl) return String(d.shortUrl);
    if (d.imageUrl) return 'Image found';
    if (d.summary && typeof d.summary === 'object') {
      const s = d.summary as { pass?: number; warn?: number; fail?: number };
      return `${s.pass ?? 0} pass · ${s.warn ?? 0} warn · ${s.fail ?? 0} fail`;
    }
    if (d.probes && Array.isArray(d.probes)) {
      const pass = d.probes.filter((p: { status?: string }) => p.status === 'pass').length;
      return `${pass}/${d.probes.length} probes live`;
    }
    if (d.apiMetrics) {
      const m = d.apiMetrics as Record<string, string>;
      return `${Object.values(m).filter((v) => v === 'Connected').length}/${Object.keys(m).length} connected`;
    }
    if (d.data && Array.isArray(d.data)) return `${d.data.length} results`;
    if (d.translated) return String(d.translated).slice(0, 50);
    return 'OK';
  }
  return String(data).slice(0, 60);
}

export function validateProbe(id: string, data: unknown): 'pass' | 'fail' | 'warn' {
  if (data == null) return 'fail';
  const d = data as Record<string, unknown>;
  const err = String(d.error || '');
  if (err.includes('429') || err.includes('403') || err.includes('rate')) return 'warn';
  switch (id) {
    case 'status': {
      const m = (d.apiMetrics || d.output) as Record<string, string> | undefined;
      const s = d.summary as { pass?: number } | undefined;
      if (s?.pass && s.pass >= 5) return 'pass';
      return m && Object.values(m).filter((v) => v === 'Connected').length >= 5 ? 'pass' : 'warn';
    }
    case 'news': return Array.isArray(data) && data.length > 0 ? 'pass' : 'warn';
    case 'trending': return Array.isArray(data) ? 'pass' : 'fail';
    case 'stock': return !!(d.imageUrl || d.success) ? 'pass' : 'warn';
    case 'serp': return d.success !== false ? 'pass' : 'warn';
    case 'domain': return d.success !== false && !d.error ? 'pass' : 'warn';
    case 'youtube': return d.success !== false || err.includes('429') ? (err.includes('429') ? 'warn' : 'pass') : 'warn';
    case 'tinyurl': return !!(d.shortUrl) ? 'pass' : 'warn';
    case 'email': {
      const e = d as { vbout?: { ok?: boolean }; mailchimp?: { ok?: boolean }; ses?: { ok?: boolean }; acumbamail?: { ok?: boolean } };
      return (e.vbout?.ok || e.mailchimp?.ok || e.ses?.ok) ? 'pass' : 'warn';
    }
    case 'email-send': return d.success === true ? 'pass' : 'warn';
    case 'deepl': return d.success !== false ? 'pass' : 'warn';
    case 'contentful': return d.success !== false ? 'pass' : 'warn';
    case 'keyword': return typeof data === 'object' && !d.error ? 'pass' : 'warn';
    case 'streaming': return typeof data === 'object' ? 'pass' : 'fail';
    case 'payment': {
      const p = d as { stripe?: { ok?: boolean }; paypal?: { ok?: boolean } };
      return p.stripe?.ok || p.paypal?.ok ? 'pass' : 'warn';
    }
    case 'grok':
    case 'grok-imagine': {
      const g = d as { session?: { loggedIn?: boolean }; settings?: { sessionValid?: boolean } };
      return g.session?.loggedIn || g.settings?.sessionValid ? 'pass' : 'warn';
    }
    default: return 'pass';
  }
}

export function initialProbeResults(): ProbeResult[] {
  return LIVE_INTEGRATION_TESTS.map((t) => ({
    id: t.id,
    label: t.label,
    status: 'idle',
    metric: t.metric,
    category: t.category,
  }));
}

export function probesFromAudit(audit: {
  probes?: Array<{ id: string; label: string; status: string; ms?: number; summary?: string; metric?: string; category?: string }>;
}): ProbeResult[] {
  if (!audit.probes?.length) return initialProbeResults();
  return audit.probes.map((p) => ({
    id: p.id,
    label: p.label,
    status: (p.status === 'pass' || p.status === 'warn' || p.status === 'fail' ? p.status : 'idle') as ProbeResult['status'],
    ms: p.ms,
    summary: p.summary,
    metric: p.metric,
    category: p.category,
  }));
}