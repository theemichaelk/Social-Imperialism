/**
 * Live connection audit — runs real API probes (not just key presence).
 */
const axios = require('axios');
const path = require('path');

const PROBE_DEFS = [
  { id: 'news', label: 'NewsAPI Headlines', metric: 'NewsAPI', category: 'Feed', channel: 'get-live-news', args: ['technology'] },
  { id: 'trending', label: 'Trending Topics', category: 'Feed', channel: 'get-trending-topics', args: [] },
  { id: 'stock', label: 'Stock Photo Search', metric: 'Unsplash', category: 'Media', channel: 'search-stock-photo', args: ['business technology'] },
  { id: 'serp', label: 'SerpAPI Research', metric: 'SerpAPI', category: 'SEO', channel: 'serp-search', args: ['social media automation'] },
  { id: 'domain', label: 'DomDetailer Metrics', metric: 'DomDetailer', category: 'SEO', channel: 'get-domain-metrics', args: ['google.com'] },
  { id: 'youtube', label: 'YouTube Channels', metric: 'YouTube', category: 'Social', channel: 'get-youtube-channels', args: [] },
  { id: 'tinyurl', label: 'TinyURL Shorten', metric: 'TinyURL', category: 'Utility', channel: 'shorten-url', args: ['https://example.com/test'] },
  { id: 'email', label: 'Email Providers', category: 'Email', channel: 'test-email-connections', args: [] },
  { id: 'deepl', label: 'DeepL Translate', metric: 'DeepL', category: 'Utility', channel: 'deepl-translate', args: ['Hello world', 'ES'] },
  { id: 'contentful', label: 'Contentful CMS', metric: 'Contentful', category: 'Media', channel: 'contentful-fetch', args: [] },
  { id: 'keyword', label: 'Keyword Research', metric: 'SerpAPI', category: 'SEO', channel: 'research-keyword', args: ['content marketing'] },
  { id: 'payment', label: 'Payment Gateways', category: 'Billing', channel: 'test-payment-connections', args: [] },
  { id: 'grok', label: 'Grok Session', category: 'AI', channel: 'grok-get-status', args: [] },
];

function probeStatus(id, data) {
  if (data == null) return { status: 'fail', summary: 'No response' };
  const d = data;
  const err = String(d.error || '');
  if (err.includes('429') || err.includes('403') || err.includes('rate')) {
    return { status: 'warn', summary: err.slice(0, 80) };
  }
  switch (id) {
    case 'news':
      return Array.isArray(d) && d.length > 0
        ? { status: 'pass', summary: `${d.length} headlines` }
        : { status: 'warn', summary: err || 'No headlines' };
    case 'trending':
      return Array.isArray(d) ? { status: 'pass', summary: `${d.length} topics` } : { status: 'fail', summary: err || 'Failed' };
    case 'stock':
      return (d.imageUrl || d.success !== false)
        ? { status: 'pass', summary: d.imageUrl ? 'Image found' : 'OK' }
        : { status: 'warn', summary: err || 'No image' };
    case 'serp':
      return d.success !== false ? { status: 'pass', summary: 'Results OK' } : { status: 'warn', summary: err || 'Failed' };
    case 'domain':
      return d.success !== false && !d.error ? { status: 'pass', summary: 'Metrics OK' } : { status: 'warn', summary: err || 'Failed' };
    case 'youtube':
      return d.success !== false || err.includes('429')
        ? { status: err.includes('429') ? 'warn' : 'pass', summary: err.includes('429') ? 'Rate limited' : 'OK' }
        : { status: 'warn', summary: err || 'Failed' };
    case 'tinyurl':
      return d.shortUrl ? { status: 'pass', summary: String(d.shortUrl) } : { status: 'warn', summary: 'No short URL' };
    case 'email': {
      const ok = d.vbout?.ok || d.mailchimp?.ok || d.ses?.ok;
      const parts = [];
      if (d.acumbamail) parts.push(`Acumbamail:${d.acumbamail.ok ? 'ok' : 'auth fail'}`);
      if (d.ses?.ok) parts.push('SES:ok');
      if (d.vbout?.ok) parts.push('VBout:ok');
      if (d.mailchimp?.ok) parts.push('MailChimp:ok');
      return {
        status: ok ? 'pass' : 'warn',
        summary: parts.join(' · ') || (d.acumbamail?.error || 'No email provider live'),
      };
    }
    case 'deepl':
      return d.success !== false ? { status: 'pass', summary: d.translated ? String(d.translated).slice(0, 40) : 'OK' } : { status: 'warn', summary: err || 'Failed' };
    case 'contentful':
      return d.success !== false ? { status: 'pass', summary: `${(d.entries || []).length} entries` } : { status: 'warn', summary: err || 'Failed' };
    case 'keyword':
      return typeof d === 'object' && !d.error ? { status: 'pass', summary: 'Research OK' } : { status: 'warn', summary: err || 'Failed' };
    case 'payment': {
      const stripe = d.stripe?.ok;
      const paypal = d.paypal?.ok;
      return {
        status: stripe || paypal ? 'pass' : 'warn',
        summary: `Stripe:${stripe ? 'ok' : '—'} PayPal:${paypal ? 'ok' : '—'}`,
      };
    }
    case 'grok': {
      const logged = d.session?.loggedIn || d.settings?.sessionValid;
      return { status: logged ? 'pass' : 'warn', summary: logged ? 'Authorized' : 'Not authorized' };
    }
    default:
      return { status: 'pass', summary: 'OK' };
  }
}

function enrichKeyMetrics(keyMetrics, emailProbe) {
  const out = { ...keyMetrics };
  if (emailProbe?.acumbamail) {
    out.Acumbamail = emailProbe.acumbamail.ok
      ? 'Connected'
      : (emailProbe.configured?.acumbamail ? 'Auth failed — enable SMTP relay' : 'Not configured');
  }
  return out;
}

async function runLiveConnectionAudit(handlers, buildApiMetrics, keys) {
  const keyMetrics = buildApiMetrics(keys);
  const probes = [];
  let emailResult = null;

  for (const def of PROBE_DEFS) {
    const start = Date.now();
    const fn = handlers[def.channel];
    if (!fn) {
      probes.push({ ...def, status: 'fail', ms: 0, summary: `Handler missing: ${def.channel}` });
      continue;
    }
    try {
      const data = await fn(null, ...(def.args || []));
      if (def.id === 'email') emailResult = data;
      const { status, summary } = probeStatus(def.id, data);
      probes.push({ ...def, status, ms: Date.now() - start, summary, data });
    } catch (e) {
      probes.push({ ...def, status: 'fail', ms: Date.now() - start, summary: e.message });
    }
  }

  const pass = probes.filter((p) => p.status === 'pass').length;
  const warn = probes.filter((p) => p.status === 'warn').length;
  const fail = probes.filter((p) => p.status === 'fail').length;
  const liveMetrics = enrichKeyMetrics(keyMetrics, emailResult);

  return {
    success: fail === 0,
    apiMetrics: liveMetrics,
    output: liveMetrics,
    probes,
    summary: { pass, warn, fail, total: probes.length },
    auditedAt: new Date().toISOString(),
  };
}

module.exports = { PROBE_DEFS, probeStatus, runLiveConnectionAudit, enrichKeyMetrics };