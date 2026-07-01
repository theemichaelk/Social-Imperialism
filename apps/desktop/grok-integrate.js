/**
 * Page-aware Grok + Infographic integration — woven into each section's content.
 * Never added as a sidebar nav item or floating edge button.
 */

const SKIP_PAGES = new Set(['account-hub', 'login', 'scheduler']);

function detectPageId() {
  const path = (typeof window !== 'undefined' && window.location?.pathname) || '';
  const file = path.split('/').pop() || 'dashboard.html';
  const base = file.replace('.html', '');
  const map = {
    dashboard: 'dashboard',
    onboarding: 'onboarding',
    engagement: 'engagement',
    history: 'history',
    keywords: 'keywords',
    'seo-tools': 'seo-tools',
    'quora-traffic-ops': 'quora-traffic',
    'reddit-ai-suite': 'reddit-ai',
    automations: 'automations',
    rules: 'rules',
    'account-hub': 'account-hub',
    'account-creator': 'account-creator',
    'content-hub': 'content-hub',
    calendar: 'calendar',
    settings: 'settings',
    scheduler: 'calendar',
  };
  if (typeof window !== 'undefined' && window.location?.hash === '#browse-posts') {
    return 'browse-posts';
  }
  return map[base] || 'dashboard';
}

const PAGE_PROFILES = {
  dashboard: {
    label: 'Post AI',
    hint: 'Use your project description — Grok drafts copy; Imagine or Infographic creates visuals for the feed.',
    anchor: '#projDesc',
    placement: 'after-block',
    blockSelector: 'div[style*="border: 1px solid #38bdf8"]',
    getText: () => window.getSelection?.()?.toString?.()?.trim()
      || document.getElementById('projDesc')?.value?.trim()
      || document.getElementById('projBrand')?.value?.trim()
      || '',
    setText: (text) => {
      const el = document.getElementById('projDesc');
      if (el) el.value = text;
      else if (typeof showToast === 'function') showToast('Copy ready — paste into your draft', 'info');
      window._grokLastText = text;
    },
    setMedia: (url) => { window._grokLastMedia = url; },
  },
  'browse-posts': {
    label: 'Browse AI',
    hint: 'Highlight a post — generate infographic or Grok caption from the selection.',
    anchor: '#browse-posts',
    placement: 'prepend',
    getText: () => window.getSelection?.()?.toString?.()?.trim()
      || document.querySelector('[data-post-content]')?.textContent?.trim()
      || '',
    setText: (t) => { window._grokLastText = t; },
    setMedia: (url) => { window._grokLastMedia = url; },
  },
  onboarding: {
    label: 'Brand AI',
    hint: 'Polish brand copy with Grok; Imagine creates launch visuals from your description.',
    anchor: '#brandDesc',
    placement: 'after-block',
    blockSelector: '#step1.panel, .panel.active',
    getText: () => document.getElementById('brandDesc')?.value
      || document.getElementById('brandName')?.value
      || '',
    setText: (t) => {
      const d = document.getElementById('brandDesc');
      if (d) d.value = t;
      const s = document.getElementById('brandSamples');
      if (s && t) s.value = (s.value ? `${s.value}\n\n` : '') + t;
    },
    setMedia: (url) => { window._grokBrandVisual = url; },
  },
  engagement: {
    label: 'Outreach AI',
    hint: 'Generate infographic DMs or Grok-personalized comments for the active list feed.',
    anchor: '#feedContainer',
    placement: 'prepend',
    getText: () => window.getSelection?.()?.toString?.()?.trim()
      || document.getElementById('profileUrls')?.value
      || document.getElementById('feedTitle')?.textContent
      || '',
    setText: (t) => {
      const box = document.querySelector('#feedContainer textarea, #feedContainer .textarea-field');
      if (box) box.value = t;
      else window._grokLastText = t;
    },
    setMedia: (url) => { window._grokLastMedia = url; },
  },
  history: {
    label: 'Reply AI',
    hint: 'Enhance the selected AI reply draft — Grok rewrite or infographic attachment.',
    anchor: '.history-header',
    placement: 'after',
    getText: () => {
      const edit = document.querySelector('.ai-draft[contenteditable="true"]');
      if (edit) return edit.textContent?.trim();
      const first = document.querySelector('.ai-draft');
      return first?.textContent?.trim() || '';
    },
    setText: (t) => {
      const el = document.querySelector('.ai-draft[contenteditable="true"]') || document.querySelector('.ai-draft');
      if (el) el.textContent = t;
    },
    setMedia: (url) => { window._grokReplyMedia = url; },
  },
  keywords: {
    label: 'Research AI',
    hint: 'Turn tracked keywords into infographic data stories or Grok research summaries.',
    anchor: '.add-keyword-section',
    placement: 'after',
    getText: () => {
      const titles = [...document.querySelectorAll('.keyword-title')].map((e) => e.textContent?.trim()).filter(Boolean);
      const manual = document.getElementById('manualKeywordInput')?.value || document.querySelector('textarea')?.value;
      return titles.join(', ') || manual || '';
    },
    setText: (t) => {
      const notes = document.getElementById('keywordNotes');
      if (notes) notes.value = t;
      else window._grokKeywordSummary = t;
    },
    setMedia: (url) => { window._grokKeywordVisual = url; },
  },
  automations: {
    label: 'Flow AI',
    variant: 'compact',
    hint: 'Generate copy or visuals for the selected flow node.',
    anchor: '.topbar > div:first-child',
    placement: 'append',
    getText: () => document.querySelector('#propBody textarea, #propBody input[type="text"]')?.value
      || document.getElementById('saveTemplateName')?.value
      || '',
    setText: (t) => {
      const ta = document.querySelector('#propBody textarea');
      if (ta) ta.value = t;
      else if (typeof updateNodeConfig === 'function') window._grokNodeCopy = t;
    },
    setMedia: (url) => { window._grokNodeMedia = url; },
  },
  rules: {
    label: 'Rules AI',
    hint: 'Draft worker messages or comment templates for auto-rules.',
    anchor: '#liveStatusPanel',
    placement: 'after',
    getText: () => document.querySelector('#taskLog')?.textContent?.slice(0, 200)
      || document.querySelector('.subtitle')?.textContent
      || '',
    setText: (t) => { window._grokRulesTemplate = t; },
    setMedia: (url) => { window._grokRulesMedia = url; },
  },
  'content-hub': {
    label: 'Profile AI',
    hint: 'Enhance bios and profile copy; Imagine generates avatar or banner concepts.',
    anchor: '#pwWizardMount',
    placement: 'prepend',
    getText: () => document.getElementById('pwPostContent')?.value?.trim()
      || document.getElementById('postContent')?.value?.trim()
      || '',
    setText: (t) => {
      const pw = document.getElementById('pwPostContent');
      const std = document.getElementById('postContent');
      if (document.getElementById('publish-wizard-tab')?.classList.contains('active') && pw) pw.value = t;
      else if (std) std.value = t;
      else if (pw) pw.value = t;
    },
    setMedia: (url) => {
      const mu = document.getElementById('mediaUrl');
      if (mu) mu.value = url;
      window._grokProfileMedia = url;
    },
  },
  'account-creator': {
    label: 'Kit AI',
    hint: 'Grok writes bios and taglines; Imagine creates profile kit images.',
    anchor: '#kitTagline, #kitEditor textarea',
    placement: 'after-block',
    blockSelector: '.panel, .kit-section, .container',
    getText: () => document.getElementById('kitTagline')?.value
      || document.querySelector('#kitEditor textarea')?.value
      || '',
    setText: (t) => {
      const el = document.getElementById('kitTagline') || document.querySelector('#kitEditor textarea');
      if (el) el.value = t;
    },
    setMedia: (url) => { window._grokKitAsset = url; },
  },
  calendar: {
    label: 'Schedule AI',
    hint: 'Open a scheduled post — generate infographic or Grok copy for that slot.',
    anchor: '.header, h1, .calendar-toolbar',
    placement: 'after',
    getText: () => document.getElementById('modalContentEdit')?.value
      || document.getElementById('igContent')?.value
      || '',
    setText: (t) => {
      const m = document.getElementById('modalContentEdit');
      if (m) m.value = t;
      const p = document.getElementById('postContent');
      if (p && !m) p.value = t;
    },
    setMedia: (url) => {
      const mu = document.getElementById('mediaUrl') || document.getElementById('modalMedia');
      if (mu) {
        if (mu.tagName === 'IMG') mu.src = url;
        else mu.value = url;
      }
    },
  },
  settings: {
    label: 'Preview AI',
    hint: 'Test Grok generation from campaign context — authorize in Grok Engine below.',
    anchor: '#grokConnectBtn',
    placement: 'before',
    getText: () => document.getElementById('brandName')?.value
      || document.getElementById('description')?.value
      || '',
    setText: (t) => { window._grokSettingsPreview = t; },
    setMedia: (url) => { window._grokSettingsPreviewMedia = url; },
  },
  'reddit-ai': {
    label: 'Growth AI',
    hint: 'Polish queue drafts with Grok or attach infographics before you approve.',
    anchor: '.queue-panel',
    placement: 'prepend',
    getText: () => window.getSelection?.()?.toString?.()?.trim()
      || document.querySelector('.queue-item strong')?.textContent
      || document.querySelector('.panel.open textarea')?.value
      || '',
    setText: (t) => {
      const ta = document.querySelector('.panel.open textarea');
      if (ta) ta.value = t;
      else window._grokRedditDraft = t;
    },
    setMedia: (url) => { window._grokRedditMedia = url; },
  },
};

let lastResult = null;
let hashListenerBound = false;
let grokStatusCache = null;
let ipcBridge = null;

function ensureIpc() {
  if (ipcBridge?.invoke) return ipcBridge;
  try {
    const { getIpcRenderer } = require('./renderer-ipc');
    ipcBridge = getIpcRenderer();
  } catch (e) {
    try {
      const electron = require('electron');
      ipcBridge = electron?.ipcRenderer || null;
    } catch (err) { /* ignore */ }
  }
  return ipcBridge;
}

function ensureGrokToastHost() {
  if (document.getElementById('grok-integrate-toasts')) return;
  const host = document.createElement('div');
  host.id = 'grok-integrate-toasts';
  host.className = 'grok-integrate-toasts';
  document.body.appendChild(host);
}

function toast(msg, type) {
  const kind = type || 'info';
  if (typeof window.showToast === 'function') {
    window.showToast(msg, kind);
    return;
  }
  if (typeof showToast === 'function') {
    showToast(msg, kind);
    return;
  }
  ensureGrokToastHost();
  const host = document.getElementById('grok-integrate-toasts');
  const el = document.createElement('div');
  el.className = `grok-integrate-toast ${kind}`;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), 5000);
  if (kind === 'error') console.error('[Post AI]', msg);
}

function queryFirst(selector) {
  if (!selector) return null;
  return selector.split(',').map((s) => s.trim()).reduce((found, sel) => {
    if (found) return found;
    try { return document.querySelector(sel); } catch (e) { return null; }
  }, null);
}

function getProfile(pageId) {
  if (pageId === 'browse-posts') return PAGE_PROFILES['browse-posts'];
  return PAGE_PROFILES[pageId] || {
    label: 'Visual AI',
    hint: 'Generate visuals and copy with Grok — applies to the active field on this page.',
    anchor: '.main-content, .main-area',
    placement: 'prepend',
    getText: () => window.getSelection?.()?.toString?.()?.trim() || document.querySelector('textarea')?.value || '',
    setText: (t) => {
      const ta = document.querySelector('textarea:focus') || document.querySelector('textarea');
      if (ta) ta.value = t;
    },
    setMedia: (url) => { window._grokLastMedia = url; },
  };
}

function resolveInsertTarget(profile) {
  if (profile.anchor) {
    const anchor = queryFirst(profile.anchor);
    if (!anchor) return null;

    switch (profile.placement) {
      case 'before':
        return { parent: anchor.parentNode, before: anchor };
      case 'after':
        return { parent: anchor.parentNode, after: anchor };
      case 'prepend':
        return { parent: anchor, prepend: true };
      case 'append':
        return { parent: anchor, append: true };
      case 'after-block': {
        const block = anchor.closest(profile.blockSelector || '.panel, .rule-box, .add-keyword-section, .hero, .history-section, .queue-panel')
          || anchor.parentElement;
        if (!block?.parentNode) return null;
        return { parent: block.parentNode, after: block };
      }
      default:
        return { parent: anchor.parentNode, after: anchor };
    }
  }

  const main = document.querySelector('.main-content') || document.querySelector('.main-area');
  if (!main) return null;
  return { parent: main, prepend: true };
}

function buildBarHtml(pageId, profile) {
  const id = `grok-bar-${pageId}`;
  const compact = profile.variant === 'compact';
  const cls = compact ? 'grok-integrate-bar compact' : 'grok-integrate-bar';
  const hintHtml = compact ? '' : `<span class="grok-integrate-hint">${profile.hint}</span>`;
  return `<div class="${cls}" id="${id}" data-page="${pageId}" title="${profile.hint}">
    <span class="grok-integrate-label"><i class="fas fa-chart-pie"></i> ${profile.label || 'Visual AI'}</span>
    ${hintHtml}
    <button type="button" class="grok-integrate-btn grok" data-action="grok-text"><i class="fas fa-comment"></i> Grok</button>
    <button type="button" class="grok-integrate-btn grok" data-action="grok-imagine"><i class="fas fa-image"></i> Imagine</button>
    <button type="button" class="grok-integrate-btn grok" data-action="grok-video"><i class="fas fa-video"></i> Video</button>
    <button type="button" class="grok-integrate-btn primary" data-action="infographic"><i class="fas fa-magic"></i> Infographic</button>
    <button type="button" class="grok-integrate-btn" data-action="apply"><i class="fas fa-paste"></i> Apply</button>
    <button type="button" class="grok-integrate-btn connect" data-action="connect"><i class="fas fa-plug"></i> Connect</button>
    <span class="grok-integrate-status warn" data-grok-status>Checking…</span>
    <div class="grok-integrate-preview" data-grok-preview></div>
  </div>`;
}

function insertBar(bar, target) {
  if (!target?.parent) return false;
  if (target.before) {
    target.parent.insertBefore(bar, target.before);
  } else if (target.after) {
    target.parent.insertBefore(bar, target.after.nextSibling);
  } else if (target.prepend) {
    target.parent.insertBefore(bar, target.parent.firstChild);
  } else if (target.append) {
    target.parent.appendChild(bar);
  } else {
    target.parent.insertBefore(bar, target.parent.firstChild);
  }
  return true;
}

function isGrokReady(st) {
  if (!st) return false;
  return !!(st.session?.loggedIn || st.settings?.sessionValid || st.profileReady);
}

async function pingGrokEngine(ipc) {
  try {
    const pong = await ipc.invoke('grok-ping');
    return !!(pong && pong.ok);
  } catch (e) {
    return false;
  }
}

async function fetchGrokStatus(ipc, retries = 3) {
  const pingOk = await pingGrokEngine(ipc);
  for (let i = 0; i <= retries; i += 1) {
    try {
      const st = await ipc.invoke('grok-get-status');
      if (st && typeof st === 'object') {
        grokStatusCache = st;
        return st;
      }
    } catch (e) {
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  if (!pingOk) {
    throw new Error('Grok engine not loaded — close ALL Social Imperialism windows, then run npm start in apps/desktop');
  }
  return grokStatusCache || { nodriverReady: true, puppeteerReady: true, settings: { sessionValid: false }, session: { loggedIn: false } };
}

function wireBar(bar, pageId) {
  const profile = getProfile(pageId);
  const statusEl = bar.querySelector('[data-grok-status]');
  const previewEl = bar.querySelector('[data-grok-preview]');
  const connectBtn = bar.querySelector('[data-action="connect"]');

  function paintStatus(st, errMsg) {
    if (!statusEl) return;
    if (errMsg) {
      const short = errMsg.includes('npm start')
        ? 'Run npm start'
        : (errMsg.includes('No handler') ? 'Reload app' : 'Click Connect');
      statusEl.textContent = short;
      statusEl.title = errMsg;
      statusEl.className = 'grok-integrate-status warn';
      if (connectBtn) connectBtn.disabled = false;
      return;
    }
    if (!st?.nodriverReady && !st?.puppeteerReady) {
      statusEl.textContent = 'Need nodriver';
      statusEl.title = 'Install Python 3 and nodriver: pip install -r apps/desktop/services/stealthBrowser/requirements.txt';
      statusEl.className = 'grok-integrate-status warn';
      return;
    }
    const ready = isGrokReady(st);
    statusEl.textContent = ready ? 'Grok ready' : 'Click Connect';
    statusEl.title = ready
      ? 'Grok browser session is available'
      : 'Connect Grok once — opens browser login (Settings → Grok Engine)';
    statusEl.className = `grok-integrate-status ${ready ? 'ok' : 'warn'}`;
    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.title = ready ? 'Re-authorize Grok session' : 'Open Grok browser to sign in';
    }
  }

  async function refreshStatus() {
    const ipc = ensureIpc();
    if (!ipc) {
      paintStatus(null, 'Not running in Electron — launch via npm start');
      return;
    }
    if (!statusEl) return;
    try {
      const st = await fetchGrokStatus(ipc);
      paintStatus(st);
    } catch (e) {
      paintStatus(null, e.message || 'IPC unavailable');
    }
  }

  async function ensureGrokReady(ipc) {
    let st = grokStatusCache;
    try {
      st = await ipc.invoke('grok-get-status');
      grokStatusCache = st;
    } catch (e) {
      throw new Error(e.message || 'Grok engine unreachable — close app windows and npm start');
    }
    if (isGrokReady(st)) return st;
    toast('Opening Grok browser — sign in if prompted…', 'info');
    const conn = await ipc.invoke('grok-connect');
    await refreshStatus();
    if (conn?.loggedIn || conn?.success) return grokStatusCache;
    throw new Error(conn?.error || conn?.message || 'Complete sign-in in the browser window, then click Connect');
  }

  function showPreview(result) {
    if (!previewEl || !result) return;
    previewEl.classList.add('open');
    const text = result.postText || result.caption || result.analysis || result.text || '';
    const asset = result.imageAsset || result.primaryAsset;
    const src = asset?.url || (asset?.path && !String(asset.path).match(/^[A-Za-z]:\\/) ? asset.path : null);
    let assetHtml = '';
    if (src) {
      assetHtml = asset?.type === 'video'
        ? `<video src="${src}" controls></video>`
        : `<img src="${src}" alt="">`;
    } else if (result.imageUrl) {
      assetHtml = `<img src="${result.imageUrl}" alt="">`;
    }
    previewEl.innerHTML = `${assetHtml}${text ? `<div class="preview-text">${text.slice(0, 200)}</div>` : ''}`;
  }

  async function runImagineFallback(ipc, content) {
    const thumb = await ipc.invoke('generate-viral-thumbnail', {
      topic: content,
      model: 'fal-fast-sdxl',
      style: 'viral-youtube',
      ratio: '16:9',
      autoHeadline: true,
    });
    if (thumb?.success && thumb.imageUrl) {
      return { success: true, imageUrl: thumb.imageUrl, localPath: thumb.localPath, postText: thumb.headline || '' };
    }
    const fal = await ipc.invoke('generate-image', `High-converting social visual for: ${content}`);
    if (fal?.success && fal.imageUrl) {
      return { success: true, imageUrl: fal.imageUrl, postText: '' };
    }
    throw new Error(thumb?.error || fal?.error || 'Image generation failed — add FAL key in Settings');
  }

  async function runInfographicFallback(ipc, content) {
    const thumb = await ipc.invoke('generate-viral-thumbnail', {
      topic: content,
      model: 'fal-flux-dev',
      style: 'minimal-clean',
      ratio: '1:1',
      autoHeadline: true,
    });
    if (thumb?.success) {
      return {
        success: true,
        postText: thumb.headline || content.slice(0, 120),
        caption: thumb.headline,
        imageAsset: { url: thumb.imageUrl, path: thumb.localPath },
      };
    }
    const fal = await ipc.invoke('generate-image', `Infographic-style data visual for: ${content}`);
    if (fal?.success) {
      return {
        success: true,
        postText: content.slice(0, 120),
        imageAsset: { url: fal.imageUrl },
      };
    }
    throw new Error(thumb?.error || fal?.error || 'Infographic fallback failed');
  }

  async function runAction(action) {
    const ipc = ensureIpc();
    if (!ipc) return toast('Electron IPC unavailable — run the desktop app with npm start', 'error');

    if (action === 'connect') {
      toast('Opening Grok browser…', 'info');
      try {
        const conn = await ipc.invoke('grok-connect');
        await refreshStatus();
        if (conn?.loggedIn || conn?.success) toast('Grok connected — try Grok / Imagine now', 'success');
        else toast(conn?.message || conn?.error || 'Sign in in the Chrome window, then click Connect again', 'error');
      } catch (e) {
        const msg = String(e.message || e);
        if (msg.includes('No handler')) {
          toast('Grok engine missing — close ALL app windows, then run: npm start', 'error');
        } else {
          toast(msg, 'error');
        }
      }
      return;
    }

    let content = profile.getText() || '';
    if (!content && action !== 'apply' && action !== 'connect') {
      content = prompt('Enter topic or paste content for Grok:', '') || '';
      if (!content) return;
    }

    const btn = bar.querySelector(`[data-action="${action}"]`);
    if (btn) btn.disabled = true;

    try {
      if (action === 'grok-text') {
        toast('Generating keyword-driven copy…', 'info');
        let text = '';
        try {
          await ensureGrokReady(ipc);
          const res = await ipc.invoke('grok-ask-text', {
            content,
            pageId,
            newChat: true,
          });
          if (res?.text) text = res.text;
          else if (!res?.success) throw new Error(res?.error || 'Grok returned no text');
          const kwNote = res.matchedKeywords?.length ? ` (${res.matchedKeywords.join(', ')})` : '';
          if (kwNote) toast(`Keywords used${kwNote}`, 'info');
        } catch (grokErr) {
          toast(`Grok unavailable — using app AI (${grokErr.message})`, 'info');
          text = await ipc.invoke('generate-ai', `Write engaging social post copy using campaign keywords for: ${content}`);
          text = String(text || '').trim();
          if (!text) throw new Error('AI copy generation failed');
        }
        lastResult = { postText: text, text };
        showPreview(lastResult);
        toast('Copy ready — click Apply', 'success');
      } else if (action === 'grok-imagine') {
        toast('Generating visual…', 'info');
        try {
          await ensureGrokReady(ipc);
          const res = await ipc.invoke('grok-imagine', { content, pageId });
          if (!res?.success) throw new Error(res?.error);
          lastResult = { imageAsset: res.primaryAsset, postText: '' };
        } catch (grokErr) {
          toast(`Grok unavailable (${grokErr.message}) — using FAL fallback…`, 'info');
          const fb = await runImagineFallback(ipc, content);
          lastResult = { imageAsset: { url: fb.imageUrl, path: fb.localPath }, imageUrl: fb.imageUrl, postText: fb.postText };
        }
        showPreview(lastResult);
        toast('Visual ready — click Apply', 'success');
      } else if (action === 'grok-video') {
        toast('Generating keyword video (wait + extend)…', 'info');
        await ensureGrokReady(ipc);
        const res = await ipc.invoke('grok-generate-video', { content, pageId, taskType: 'video' });
        if (!res?.success) throw new Error(res?.error || 'Video generation failed');
        const parts = res.totalParts ? ` · ${res.extendsClicked || 0} extend(s)` : '';
        lastResult = { imageAsset: res.primaryAsset, videoAsset: res.primaryAsset, postText: '' };
        showPreview(lastResult);
        toast(`Video ready${parts} — click Apply`, 'success');
      } else if (action === 'infographic') {
        toast('Generating infographic…', 'info');
        try {
          await ensureGrokReady(ipc);
          const res = await ipc.invoke('grok-generate-infographic', { content, style: 'modern', pageId });
          if (!res?.success && !res?.imageAsset) throw new Error(res?.error || 'Grok infographic incomplete');
          lastResult = res;
        } catch (grokErr) {
          toast(`Grok unavailable (${grokErr.message}) — using image fallback…`, 'info');
          lastResult = await runInfographicFallback(ipc, content);
        }
        showPreview(lastResult);
        toast(lastResult?.success !== false ? 'Infographic ready — click Apply' : (lastResult?.error || 'Partial result'), lastResult?.success !== false ? 'success' : 'error');
      } else if (action === 'apply') {
        if (!lastResult) return toast('Generate something first', 'error');
        const text = lastResult.postText || lastResult.caption || lastResult.analysis || lastResult.text || '';
        if (text) profile.setText(text);
        const asset = lastResult.imageAsset || lastResult.primaryAsset;
        let mediaUrl = lastResult.imageUrl || asset?.url;
        if (asset?.path) {
          mediaUrl = await ipc.invoke('upload-local-media', asset.path).catch(() => mediaUrl || asset.url);
        }
        if (mediaUrl) profile.setMedia(mediaUrl);
        toast('Applied to this page', 'success');
      }
    } catch (e) {
      toast(e.message || String(e), 'error');
    } finally {
      if (btn) btn.disabled = false;
      refreshStatus();
    }
  }

  bar.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => runAction(btn.dataset.action));
  });

  refreshStatus();
  setInterval(refreshStatus, 45000);
}

function removeExistingBar(pageId) {
  const existing = document.getElementById(`grok-bar-${pageId}`) || document.querySelector('.grok-integrate-bar');
  if (existing) existing.remove();
}

function ensureStyles() {
  if (document.querySelector('link[href="grok-integrate.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'grok-integrate.css';
  document.head.appendChild(link);
}

function bindHashNavigation() {
  if (hashListenerBound || typeof window === 'undefined') return;
  hashListenerBound = true;
  window.addEventListener('hashchange', () => {
    const pid = detectPageId();
    if (pid === 'browse-posts' || pid === 'dashboard') {
      removeExistingBar('dashboard');
      removeExistingBar('browse-posts');
      integrateGrokForPage(pid, 0);
    }
  });
}

function integrateGrokForPage(pageId, attempt = 0) {
  if (typeof document === 'undefined') return;

  const pid = pageId || detectPageId();
  if (SKIP_PAGES.has(pid)) return;

  const profile = getProfile(pid);
  const target = resolveInsertTarget(profile);

  if (!target) {
    if (attempt < 40) {
      setTimeout(() => integrateGrokForPage(pageId, attempt + 1), 100);
    }
    return;
  }

  if (document.getElementById(`grok-bar-${pid}`)) {
    if (pid === 'content-hub') {
      const bar = document.getElementById(`grok-bar-${pid}`);
      const mount = document.getElementById('pwWizardMount');
      if (bar && mount && !mount.contains(bar)) {
        mount.prepend(bar);
      }
    }
    return;
  }

  ensureStyles();
  bindHashNavigation();

  const wrap = document.createElement('div');
  wrap.innerHTML = buildBarHtml(pid, profile);
  const bar = wrap.firstElementChild;
  if (!insertBar(bar, target)) {
    if (attempt < 40) setTimeout(() => integrateGrokForPage(pageId, attempt + 1), 100);
    return;
  }
  wireBar(bar, pid);
}

module.exports = { integrateGrokForPage, PAGE_PROFILES, SKIP_PAGES, detectPageId };