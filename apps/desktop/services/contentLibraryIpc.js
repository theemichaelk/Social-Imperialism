const axios = require('axios');

function libraryKey(store) {
  const activeId = store.getItem('activeCampaignId') || 'default';
  return `contentLibrary_${activeId}`;
}

function getLibrary(store) {
  try {
    return JSON.parse(store.getItem(libraryKey(store)) || '[]');
  } catch (e) {
    return [];
  }
}

function saveLibrary(store, assets) {
  store.setItem(libraryKey(store), JSON.stringify(assets));
}

function newAsset(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: partial.id || `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: partial.name || 'Untitled',
    type: partial.type || 'image',
    url: partial.url || '',
    text: partial.text || '',
    tags: partial.tags || [],
    source: partial.source || 'upload',
    createdAt: partial.createdAt || now,
    updatedAt: now,
  };
}

async function importWebsiteToLibrary(store, generateAI, { url } = {}) {
  const raw = String(url || '').trim().replace(/\/$/, '');
  if (!raw) return { success: false, error: 'Enter a website URL' };
  const target = raw.startsWith('http') ? raw : `https://${raw}`;
  try {
    const res = await axios.get(target, {
      timeout: 15000,
      headers: { 'User-Agent': 'SocialImperialism/1.0' },
      maxRedirects: 5,
    });
    const html = String(res.data || '');
    const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1]?.trim() || '';
    const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || [])[1]?.trim()
      || (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || [])[1]?.trim()
      || '';
    const ogImage = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || [])[1]?.trim() || '';
    const bodyText = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);

    const lib = getLibrary(store);
    const domain = new URL(target).hostname.replace(/^www\./, '');
    const assets = [];

    if (title || desc) {
      assets.push(newAsset({
        name: `${domain} — brand summary`,
        type: 'copy',
        text: [title, desc].filter(Boolean).join('\n\n'),
        tags: ['website', 'brand', domain],
        source: 'website',
      }));
    }
    if (ogImage) {
      assets.push(newAsset({
        name: `${domain} — og image`,
        type: 'image',
        url: ogImage,
        tags: ['website', 'image', domain],
        source: 'website',
      }));
    }
    if (bodyText.length > 80) {
      assets.push(newAsset({
        name: `${domain} — page excerpt`,
        type: 'copy',
        text: bodyText.slice(0, 1200),
        tags: ['website', 'excerpt', domain],
        source: 'website',
      }));
    }

    if (generateAI && assets.length) {
      try {
        const summary = await generateAI(
          `Summarize brand voice, audience, and 5 content topics for website ${target}. Title: ${title}. Description: ${desc}. Return concise bullets.`,
        );
        assets.unshift(newAsset({
          name: `${domain} — AI brand voice`,
          type: 'copy',
          text: String(summary || '').trim(),
          tags: ['website', 'brand-voice', domain],
          source: 'website-ai',
        }));
      } catch (e) { /* optional */ }
    }

    saveLibrary(store, [...assets, ...lib].slice(0, 500));
    return { success: true, assets, count: getLibrary(store).length, domain, title };
  } catch (e) {
    return { success: false, error: e.message || 'Could not fetch website' };
  }
}

function registerContentLibraryHandlers({ ipcMain, store, generateAI }) {
  const channels = [
    'get-content-library',
    'save-content-asset',
    'delete-content-asset',
    'import-website-to-library',
    'import-rss-to-library',
    'import-text-to-library',
  ];
  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* noop */ }
  });

  ipcMain.handle('get-content-library', () => ({
    success: true,
    assets: getLibrary(store),
    count: getLibrary(store).length,
  }));

  ipcMain.handle('save-content-asset', (event, payload = {}) => {
    const lib = getLibrary(store);
    const existing = lib.findIndex((a) => a.id === payload.id);
    const asset = newAsset({
      ...(existing >= 0 ? lib[existing] : {}),
      ...payload,
      updatedAt: new Date().toISOString(),
    });
    if (existing >= 0) lib[existing] = asset;
    else lib.unshift(asset);
    saveLibrary(store, lib.slice(0, 500));
    return { success: true, asset, count: lib.length };
  });

  ipcMain.handle('delete-content-asset', (event, { id } = {}) => {
    const lib = getLibrary(store).filter((a) => a.id !== id);
    saveLibrary(store, lib);
    return { success: true, count: lib.length };
  });

  ipcMain.handle('import-text-to-library', (event, { text, name, tags, source } = {}) => {
    if (!text?.trim()) return { success: false, error: 'No text provided' };
    const lib = getLibrary(store);
    const asset = newAsset({
      name: name || 'Imported copy',
      type: 'copy',
      text: text.trim(),
      tags: tags || ['import'],
      source: source || 'paste',
    });
    lib.unshift(asset);
    saveLibrary(store, lib);
    return { success: true, asset, count: lib.length };
  });

  ipcMain.handle('import-website-to-library', async (event, payload) => importWebsiteToLibrary(store, generateAI, payload));

  ipcMain.handle('import-rss-to-library', async (event, { feedUrl, limit = 5 } = {}) => {
    const url = String(feedUrl || '').trim();
    if (!url) return { success: false, error: 'Enter an RSS feed URL' };
    try {
      const res = await axios.get(url, { timeout: 15000 });
      const xml = String(res.data || '');
      const items = [];
      const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
      for (const block of itemBlocks.slice(0, limit)) {
        const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1]?.trim() || '';
        const link = (block.match(/<link[^>]*>([^<]+)<\/link>/i) || block.match(/<link[^>]+href=["']([^"']+)["']/i) || [])[1]?.trim() || '';
        const desc = (block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) || [])[1]?.trim() || '';
        if (title) {
          items.push(newAsset({
            name: title.slice(0, 80),
            type: 'copy',
            text: [title, desc.replace(/<[^>]+>/g, '').trim(), link].filter(Boolean).join('\n\n'),
            tags: ['rss', 'import'],
            source: 'rss',
            url: link || '',
          }));
        }
      }
      if (!items.length) return { success: false, error: 'No RSS items found' };
      const lib = getLibrary(store);
      saveLibrary(store, [...items, ...lib].slice(0, 500));
      return { success: true, assets: items, count: getLibrary(store).length };
    } catch (e) {
      return { success: false, error: e.message || 'RSS import failed' };
    }
  });
}

module.exports = { registerContentLibraryHandlers, getLibrary, libraryKey, importWebsiteToLibrary };