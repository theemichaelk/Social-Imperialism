/**
 * Email delivery — Acumbamail SMTP, Amazon SES SMTP, VBout API, MailChimp Marketing API.
 */
const axios = require('axios');
const nodemailer = require('nodemailer');

const VBOUT_BASE = 'https://api.vbout.com/1';

function mailchimpDc(apiKey) {
  if (!apiKey) return 'us1';
  const parts = String(apiKey).split('-');
  return parts[parts.length - 1] || 'us1';
}

function mailchimpBase(apiKey) {
  return `https://${mailchimpDc(apiKey)}.api.mailchimp.com/3.0`;
}

function resolveEmailConfig(keys = {}) {
  return {
    vboutApiKey: keys.vboutApiKey || process.env.VBOUT_API_KEY || null,
    mailchimpApiKey: keys.mailchimpApiKey || process.env.MAILCHIMP_API_KEY || null,
    smtpHost: keys.smtpHost || process.env.SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com',
    smtpPort: parseInt(keys.smtpPort || process.env.SMTP_PORT || '587', 10),
    smtpUser: keys.smtpUser || process.env.SMTP_USER || null,
    smtpPass: keys.smtpPass || process.env.SMTP_PASS || null,
    smtpFrom: keys.smtpFrom || process.env.SMTP_FROM || 'michaelk@tsbrenterprises.com',
    smtpFromName: keys.smtpFromName || process.env.SMTP_FROM_NAME || 'Social Imperialism',
    acumbamailHost: keys.acumbamailHost || process.env.ACUMBAMAIL_SMTP_HOST || 'smtp.acumbamail.com',
    acumbamailPort: parseInt(keys.acumbamailPort || process.env.ACUMBAMAIL_SMTP_PORT || '587', 10),
    acumbamailUser: keys.acumbamailUser || process.env.ACUMBAMAIL_SMTP_USER || null,
    acumbamailPass: keys.acumbamailPass || process.env.ACUMBAMAIL_SMTP_PASS || process.env.ACUMBAMAIL_AUTH_TOKEN || null,
    acumbamailFrom: keys.acumbamailFrom || process.env.ACUMBAMAIL_SMTP_FROM || keys.acumbamailUser || process.env.ACUMBAMAIL_SMTP_USER || null,
    tinyurlApiKey: keys.tinyurlApiKey || process.env.TINYURL_API_KEY || null,
  };
}

function hasSmtpConfig(cfg) {
  return !!(cfg.smtpHost && cfg.smtpUser && cfg.smtpPass);
}

function hasAcumbamailConfig(cfg) {
  return !!(cfg.acumbamailHost && cfg.acumbamailUser && cfg.acumbamailPass);
}

function hasVboutConfig(cfg) {
  return !!cfg.vboutApiKey;
}

function hasMailchimpConfig(cfg) {
  return !!cfg.mailchimpApiKey;
}

function createSmtpTransport(profile) {
  const port = profile.port || 587;
  return nodemailer.createTransport({
    host: profile.host,
    port,
    secure: port === 465,
    requireTLS: port === 587 || port === 25252 || port === 2587,
    auth: { user: profile.user, pass: profile.pass },

    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });
}

function sesSmtpProfile(cfg) {
  return {
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    user: cfg.smtpUser,
    pass: cfg.smtpPass,
    from: cfg.smtpFrom,
    fromName: cfg.smtpFromName,
  };
}

function acumbamailSmtpProfile(cfg) {
  return {
    host: cfg.acumbamailHost,
    port: cfg.acumbamailPort,
    user: cfg.acumbamailUser,
    pass: cfg.acumbamailPass,
    from: cfg.acumbamailFrom || cfg.acumbamailUser,
    fromName: cfg.smtpFromName,
  };
}

async function shortenUrl(url, tinyKey) {
  if (!tinyKey || !url?.startsWith('http')) return url;
  try {
    const res = await axios.get(
      `https://api.tinyurl.com/create?api_token=${tinyKey}&url=${encodeURIComponent(url)}`,
      { timeout: 8000 },
    );
    return res.data?.data?.tiny_url || url;
  } catch (e) {
    return url;
  }
}

async function shortenLinksInText(text, tinyKey) {
  if (!text || !tinyKey) return text;
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
  const urls = [...new Set(text.match(urlRegex) || [])];
  let out = text;
  for (const url of urls) {
    const short = await shortenUrl(url, tinyKey);
    if (short !== url) out = out.split(url).join(short);
  }
  return out;
}

function renderTemplate(template, vars = {}) {
  let out = String(template || '');
  for (const [key, val] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), String(val ?? ''));
  }
  return out;
}

async function testVbout(cfg) {
  if (!hasVboutConfig(cfg)) return { ok: false, error: 'VBout API key not configured' };
  try {
    const res = await axios.get(`${VBOUT_BASE}/user.json`, {
      params: { key: cfg.vboutApiKey },
      timeout: 12000,
    });
    const user = res.data?.response?.item || res.data?.item || res.data;
    return {
      ok: true,
      provider: 'vbout',
      account: user?.email || user?.username || 'connected',
    };
  } catch (e) {
    const msg = e.response?.data?.response?.error?.message || e.message;
    return { ok: false, provider: 'vbout', error: msg };
  }
}

async function testMailchimp(cfg) {
  if (!hasMailchimpConfig(cfg)) return { ok: false, error: 'MailChimp API key not configured' };
  try {
    const res = await axios.get(`${mailchimpBase(cfg.mailchimpApiKey)}/ping`, {
      auth: { username: 'any', password: cfg.mailchimpApiKey },
      timeout: 12000,
    });
    return { ok: true, provider: 'mailchimp', health: res.data?.health_status || 'ok' };
  } catch (e) {
    const msg = e.response?.data?.detail || e.response?.data?.title || e.message;
    return { ok: false, provider: 'mailchimp', error: msg };
  }
}

async function testSmtp(cfg) {
  if (!hasSmtpConfig(cfg)) return { ok: false, error: 'Amazon SES SMTP credentials not configured' };
  try {
    const transport = createSmtpTransport(sesSmtpProfile(cfg));
    await transport.verify();
    return { ok: true, provider: 'ses', host: cfg.smtpHost, port: cfg.smtpPort };
  } catch (e) {
    return { ok: false, provider: 'ses', error: e.message };
  }
}

async function testAcumbamail(cfg) {
  if (!hasAcumbamailConfig(cfg)) return { ok: false, error: 'Acumbamail SMTP not configured' };
  try {
    const transport = createSmtpTransport(acumbamailSmtpProfile(cfg));
    await transport.verify();
    return {
      ok: true,
      provider: 'acumbamail',
      host: cfg.acumbamailHost,
      port: cfg.acumbamailPort,
      user: cfg.acumbamailUser,
    };
  } catch (e) {
    return { ok: false, provider: 'acumbamail', error: e.message };
  }
}

async function testAllConnections(keys) {
  const cfg = resolveEmailConfig(keys);
  const [vbout, mailchimp, ses, acumbamail] = await Promise.all([
    testVbout(cfg),
    testMailchimp(cfg),
    testSmtp(cfg),
    testAcumbamail(cfg),
  ]);
  return {
    success: vbout.ok || mailchimp.ok || ses.ok || acumbamail.ok,
    vbout,
    mailchimp,
    ses,
    acumbamail,
    configured: {
      vbout: hasVboutConfig(cfg),
      mailchimp: hasMailchimpConfig(cfg),
      ses: hasSmtpConfig(cfg),
      acumbamail: hasAcumbamailConfig(cfg),
      tinyurl: !!cfg.tinyurlApiKey,
    },
  };
}

async function sendViaSmtpProfile(profile, provider, { to, subject, html, text }) {
  const transport = createSmtpTransport(profile);
  const info = await transport.sendMail({
    from: `"${profile.fromName || 'Social Imperialism'}" <${profile.from}>`,
    to,
    subject,
    html,
    text: text || html?.replace(/<[^>]+>/g, ' '),
  });
  return { success: true, provider, messageId: info.messageId };
}

async function sendViaSmtp(cfg, payload) {
  return sendViaSmtpProfile(sesSmtpProfile(cfg), 'ses', payload);
}

async function sendViaAcumbamail(cfg, payload) {
  return sendViaSmtpProfile(acumbamailSmtpProfile(cfg), 'acumbamail', payload);
}

async function getVboutLists(cfg) {
  const res = await axios.get(`${VBOUT_BASE}/emailmarketing/getlists.json`, {
    params: { key: cfg.vboutApiKey },
    timeout: 12000,
  });
  const lists = res.data?.response?.data?.lists?.items
    || res.data?.response?.data?.items
    || res.data?.response?.items
    || [];
  return lists;
}

async function sendViaVbout(cfg, { to, subject, html, text, listId }) {
  const body = text || html?.replace(/<[^>]+>/g, ' ') || subject;
  const lists = await getVboutLists(cfg);
  const targetList = listId || lists[0]?.id;
  if (!targetList) throw new Error('No VBout email list found');

  await axios.post(`${VBOUT_BASE}/emailmarketing/addcontact.json`, null, {
    params: {
      key: cfg.vboutApiKey,
      listid: targetList,
      email: to,
      status: 'active',
    },
    timeout: 12000,
  });

  let campaignId = null;
  try {
    const campRes = await axios.post(`${VBOUT_BASE}/emailmarketing/addcampaign.json`, null, {
      params: {
        key: cfg.vboutApiKey,
        listid: targetList,
        name: subject.slice(0, 80),
        subject,
        body,
        type: 'standard',
        fromemail: cfg.smtpFrom,
        from_name: cfg.smtpFromName,
        reply_to: cfg.smtpFrom,
      },
      timeout: 20000,
    });
    campaignId = campRes.data?.response?.data?.id
      || campRes.data?.response?.item?.id
      || campRes.data?.data?.id;
  } catch (e) {
    const existing = await axios.get(`${VBOUT_BASE}/emailmarketing/getcampaigns.json`, {
      params: { key: cfg.vboutApiKey },
      timeout: 12000,
    });
    const items = existing.data?.response?.data || [];
    campaignId = items.find((c) => c.subject === subject)?.id || items[0]?.id;
  }

  if (!campaignId) {
    return {
      success: true,
      provider: 'vbout',
      queued: true,
      listId: targetList,
      message: 'Contact added to VBout list; launch campaign from VBout dashboard.',
    };
  }

  const sendActions = ['sendcampaigntolist', 'sendcampaigntocontacts', 'sendcampaigntolistcontacts'];
  for (const action of sendActions) {
    try {
      const sendRes = await axios.post(`${VBOUT_BASE}/emailmarketing/${action}.json`, null, {
        params: { key: cfg.vboutApiKey, campaignid: campaignId, listid: targetList },
        timeout: 20000,
      });
      if (sendRes.data?.response?.header?.status !== 'error') {
        return { success: true, provider: 'vbout', campaignId, listId: targetList, action };
      }
    } catch (e) {
      /* try next action */
    }
  }

  return {
    success: true,
    provider: 'vbout',
    queued: true,
    campaignId,
    listId: targetList,
    message: 'VBout campaign created and contact added; send from VBout if auto-send action unavailable.',
  };
}

async function ensureMailchimpList(cfg) {
  const base = mailchimpBase(cfg.mailchimpApiKey);
  const auth = { username: 'any', password: cfg.mailchimpApiKey };
  const listsRes = await axios.get(`${base}/lists`, {
    auth,
    params: { count: 50 },
    timeout: 12000,
  });
  const existing = (listsRes.data?.lists || []).find((l) => l.name === 'Social Imperialism');
  if (existing) return existing.id;

  const created = await axios.post(`${base}/lists`, {
    name: 'Social Imperialism',
    contact: {
      company: 'Social Imperialism',
      address1: 'Online',
      city: 'Remote',
      state: 'NA',
      zip: '00000',
      country: 'US',
    },
    permission_reminder: 'You opted in via Social Imperialism automation.',
    campaign_defaults: {
      from_name: cfg.smtpFromName,
      from_email: cfg.smtpFrom,
      subject: 'Update from Social Imperialism',
      language: 'en',
    },
    email_type_option: false,
  }, { auth, timeout: 15000 });
  return created.data?.id;
}

async function sendViaMailchimp(cfg, { to, subject, html, text }) {
  const base = mailchimpBase(cfg.mailchimpApiKey);
  const auth = { username: 'any', password: cfg.mailchimpApiKey };
  const listId = await ensureMailchimpList(cfg);
  const emailHash = require('crypto').createHash('md5').update(to.toLowerCase()).digest('hex');

  await axios.put(`${base}/lists/${listId}/members/${emailHash}`, {
    email_address: to,
    status_if_new: 'subscribed',
    status: 'subscribed',
  }, { auth, timeout: 12000 });

  const campRes = await axios.post(`${base}/campaigns`, {
    type: 'regular',
    recipients: { list_id: listId },
    settings: {
      subject_line: subject,
      title: subject.slice(0, 80),
      from_name: cfg.smtpFromName,
      reply_to: cfg.smtpFrom,
    },
  }, { auth, timeout: 15000 });

  const campaignId = campRes.data?.id;
  if (!campaignId) throw new Error('MailChimp campaign not created');

  await axios.put(`${base}/campaigns/${campaignId}/content`, {
    html: html || `<p>${text || subject}</p>`,
  }, { auth, timeout: 15000 });

  try {
    await axios.post(`${base}/campaigns/${campaignId}/actions/send`, {}, { auth, timeout: 20000 });
  } catch (e) {
    const detail = e.response?.data?.detail || e.message;
    if (String(detail).toLowerCase().includes('account disabled')) {
      throw new Error('MailChimp account disabled for sending — reactivate in MailChimp dashboard');
    }
    throw e;
  }
  return { success: true, provider: 'mailchimp', campaignId, listId };
}

async function sendEmail(keys, payload = {}) {
  const cfg = resolveEmailConfig(keys);
  const {
    to,
    subject,
    html,
    text,
    provider,
    shortenLinks = true,
  } = payload;

  if (!to || !to.includes('@')) throw new Error('Valid recipient email required');
  if (!subject) throw new Error('Subject required');

  let finalHtml = html || `<p>${text || subject}</p>`;
  let finalText = text || finalHtml.replace(/<[^>]+>/g, ' ');

  if (shortenLinks && cfg.tinyurlApiKey) {
    finalHtml = await shortenLinksInText(finalHtml, cfg.tinyurlApiKey);
    finalText = await shortenLinksInText(finalText, cfg.tinyurlApiKey);
  }

  const order = provider
    ? [provider]
    : (payload.providerPriority || ['acumbamail', 'ses', 'vbout', 'mailchimp']);

  const errors = [];
  const mailPayload = { to, subject, html: finalHtml, text: finalText };
  for (const p of order) {
    try {
      if (p === 'acumbamail' && hasAcumbamailConfig(cfg)) {
        return await sendViaAcumbamail(cfg, mailPayload);
      }
      if (p === 'ses' && hasSmtpConfig(cfg)) {
        return await sendViaSmtp(cfg, mailPayload);
      }
      if (p === 'vbout' && hasVboutConfig(cfg)) {
        return await sendViaVbout(cfg, { to, subject, html: finalHtml, text: finalText, listId: payload.vboutListId });
      }
      if (p === 'mailchimp' && hasMailchimpConfig(cfg)) {
        return await sendViaMailchimp(cfg, { to, subject, html: finalHtml, text: finalText });
      }
    } catch (e) {
      errors.push(`${p}: ${e.message}`);
    }
  }

  throw new Error(errors.length ? errors.join(' | ') : 'No email provider configured');
}

function buildDefaultCampaigns(brand = 'Acme Growth Labs', domain = 'acmegrowth.com') {
  return [
    {
      id: 'email_camp_mention_digest',
      name: 'Social Mention Auto-Reply Digest',
      description: 'Sends email digest when AI drafts a social auto-reply (mirrors Auto-Engagement Flow).',
      provider: 'auto',
      trigger: 'reply.generated',
      enabled: true,
      autoReply: true,
      shortenLinks: true,
      subject: '{{brandName}} — AI Reply Drafted on {{platform}}',
      html: `<p>Hi,</p>
<p>Your auto-reply engine drafted a new response for <strong>{{platform}}</strong>:</p>
<blockquote>{{preview}}</blockquote>
<p>Original post by <strong>{{author}}</strong>:</p>
<p>{{originalPost}}</p>
<p><a href="{{dashboardUrl}}">Review in Social Imperialism</a> · <a href="{{brandUrl}}">{{brandName}}</a></p>`,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'email_camp_keyword_nurture',
      name: 'Keyword Match Lead Nurture',
      description: 'Auto-email when a monitored keyword matches a high-intent post (mirrors keyword trigger).',
      provider: 'auto',
      trigger: 'keyword.matched',
      enabled: true,
      autoReply: true,
      shortenLinks: true,
      subject: '{{brandName}} — Keyword Match: {{matchedKeyword}}',
      html: `<p>New keyword opportunity detected on <strong>{{platform}}</strong>.</p>
<p><strong>Keyword:</strong> {{matchedKeyword}}</p>
<p><strong>Post:</strong> {{topic}}</p>
<p>We've queued nurture follow-up. Explore {{brandName}} at <a href="{{brandUrl}}">{{brandUrl}}</a>.</p>`,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'email_camp_welcome',
      name: 'Brand Welcome & Onboarding',
      description: 'Welcome email for new leads captured from social engagement.',
      provider: 'auto',
      trigger: 'lead.captured',
      enabled: true,
      autoReply: true,
      shortenLinks: true,
      subject: 'Welcome to {{brandName}} — Your growth automation is live',
      html: `<p>Welcome!</p>
<p>Thanks for connecting with <strong>{{brandName}}</strong>. Your social automation, keyword monitoring, and AI reply engine are active.</p>
<p>Visit <a href="{{brandUrl}}">{{domain}}</a> to learn more.</p>
<p>— Social Imperialism</p>`,
      createdAt: new Date().toISOString(),
    },
  ].map((c) => ({
    ...c,
    brandName: brand,
    domain,
    brandUrl: `https://${domain}`,
  }));
}

function loadEmailCampaigns(store) {
  try {
    return JSON.parse(store.getItem('emailCampaigns') || '{}');
  } catch (e) {
    return {};
  }
}

function ensureEmailCampaigns(store, campaign = {}) {
  const existing = loadEmailCampaigns(store);
  if (existing.campaigns?.length) return existing;

  const brand = campaign.brandName || campaign.name || 'Acme Growth Labs';
  const domain = campaign.domain || 'acmegrowth.com';
  const seeded = {
    settings: {
      defaultProvider: 'auto',
      providerPriority: ['acumbamail', 'ses', 'vbout', 'mailchimp'],
      fromEmail: process.env.SMTP_FROM || 'theesaintmichael@gmail.com',
      fromName: 'Social Imperialism',
      alertEmail: process.env.SMTP_FROM || 'theesaintmichael@gmail.com',
      shortenLinks: true,
      enabled: true,
    },
    campaigns: buildDefaultCampaigns(brand, domain),
    log: [],
  };
  store.setItem('emailCampaigns', JSON.stringify(seeded));
  return seeded;
}

function resolveRecipient(store, settings) {
  const notif = (() => {
    try { return JSON.parse(store.getItem('notificationSettings') || '{}'); } catch (e) { return {}; }
  })();
  const globalKeys = (() => {
    try { return JSON.parse(store.getItem('globalApiKeys') || '{}'); } catch (e) { return {}; }
  })();
  return settings?.alertEmail || notif.email || globalKeys.alertEmail || process.env.SMTP_FROM || null;
}

async function runEmailAutoReply(store, keys, { trigger, data = {} } = {}) {
  const emailState = ensureEmailCampaigns(store);
  if (!emailState.settings?.enabled) return { skipped: true, reason: 'email campaigns disabled' };

  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const brandCampaign = (() => {
    try {
      return JSON.parse(store.getItem('campaigns') || '[]').find((c) => c.id === activeCampaignId) || {};
    } catch (e) { return {}; }
  })();

  const matching = (emailState.campaigns || []).filter(
    (c) => c.enabled && c.autoReply && c.trigger === trigger,
  );
  if (!matching.length) return { skipped: true, reason: 'no matching campaigns', trigger };

  const recipient = resolveRecipient(store, emailState.settings);
  if (!recipient) return { skipped: true, reason: 'no alert email configured' };

  const vars = {
    brandName: brandCampaign.brandName || brandCampaign.name || 'Your Brand',
    domain: brandCampaign.domain || 'yourbrand.com',
    brandUrl: brandCampaign.domain ? `https://${brandCampaign.domain}` : 'https://socialimperialism.com',
    dashboardUrl: 'https://www.socialimperialism.com/history',
    platform: data.platform || 'Social',
    author: data.author || 'Unknown',
    preview: (data.preview || data.replyContent || '').slice(0, 500),
    originalPost: (data.originalPost || data.content || data.topic || '').slice(0, 500),
    matchedKeyword: data.matchedKeyword || data.topic || '',
    topic: (data.topic || data.content || '').slice(0, 300),
  };

  const results = [];
  for (const camp of matching) {
    const subject = renderTemplate(camp.subject, vars);
    const html = renderTemplate(camp.html, vars);
    try {
      const sent = await sendEmail(keys, {
        to: recipient,
        subject,
        html,
        provider: camp.provider === 'auto' ? undefined : camp.provider,
        shortenLinks: camp.shortenLinks !== false,
        providerPriority: emailState.settings.providerPriority,
      });
      results.push({ campaignId: camp.id, name: camp.name, ...sent });
    } catch (e) {
      results.push({ campaignId: camp.id, name: camp.name, success: false, error: e.message });
    }
  }

  const log = emailState.log || [];
  log.unshift({
    trigger,
    at: new Date().toISOString(),
    recipient,
    results,
  });
  store.setItem('emailCampaigns', JSON.stringify({
    ...emailState,
    log: log.slice(0, 50),
  }));

  return { success: results.some((r) => r.success), trigger, results };
}

module.exports = {
  resolveEmailConfig,
  hasSmtpConfig,
  hasAcumbamailConfig,
  hasVboutConfig,
  hasMailchimpConfig,
  testAllConnections,
  testVbout,
  testMailchimp,
  testSmtp,
  testAcumbamail,
  sendEmail,
  shortenUrl,
  shortenLinksInText,
  renderTemplate,
  buildDefaultCampaigns,
  ensureEmailCampaigns,
  loadEmailCampaigns,
  runEmailAutoReply,
};