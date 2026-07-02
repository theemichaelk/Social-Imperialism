/**
 * Social Imperialism Design Compositor — programmatic layouts + CSS compositor for /design-studio.
 * Adapted from Imperialism Center dual-render architecture (programmatic + canvas/CSS layers).
 */

const ASPECT_PRESETS = {
  '16:9': { id: '16:9', label: 'Landscape (16:9)', width: 1920, height: 1080, platforms: ['YouTube', 'LinkedIn'] },
  '9:16': { id: '9:16', label: 'Portrait (9:16)', width: 1080, height: 1920, platforms: ['TikTok', 'Instagram Stories', 'Reels'] },
  '1:1': { id: '1:1', label: 'Square (1:1)', width: 1080, height: 1080, platforms: ['Instagram', 'Facebook'] },
  '4:5': { id: '4:5', label: 'Portrait (4:5)', width: 1080, height: 1350, platforms: ['Instagram Feed'] },
};

const FILTER_PRESETS = [
  { id: 'none', label: 'None' },
  { id: 'warm', label: 'Warm tint', css: 'sepia(0.15) saturate(1.1)' },
  { id: 'cool', label: 'Cool tint', css: 'hue-rotate(15deg) saturate(0.95)' },
  { id: 'high-contrast', label: 'High contrast', css: 'contrast(1.15) brightness(1.05)' },
  { id: 'soft-blur-bg', label: 'Soft blur background', css: 'blur(4px)' },
];

const PII_PATTERNS = [
  { id: 'api_key', label: 'API keys', pattern: /\b(sk|pk|rk|api)[-_][a-zA-Z0-9]{16,}\b/gi },
  { id: 'bearer', label: 'Bearer tokens', pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/gi },
  { id: 'email', label: 'Email addresses', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { id: 'credit_card', label: 'Credit cards', pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
  { id: 'ssn', label: 'SSN patterns', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { id: 'password_field', label: 'Password assignments', pattern: /(?:password|passwd|secret)\s*[:=]\s*\S+/gi },
];

function projectsKey(store) {
  const activeId = store.getItem('activeCampaignId') || 'default';
  return `designProjects_${activeId}`;
}

function getProjects(store) {
  try {
    return JSON.parse(store.getItem(projectsKey(store)) || '[]');
  } catch (e) {
    return [];
  }
}

function saveProjects(store, projects) {
  store.setItem(projectsKey(store), JSON.stringify(projects.slice(0, 50)));
}

function scanTextForPii(text) {
  const findings = [];
  const src = String(text || '');
  for (const rule of PII_PATTERNS) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m;
    while ((m = re.exec(src)) !== null) {
      findings.push({
        type: rule.id,
        label: rule.label,
        match: m[0].slice(0, 80),
        start: m.index,
        end: m.index + m[0].length,
        redacted: m[0].replace(/[^\s]/g, '█'),
      });
    }
  }
  return findings;
}

function redactText(text) {
  let out = String(text || '');
  for (const rule of PII_PATTERNS) {
    out = out.replace(rule.pattern, (match) => match.replace(/[^\s]/g, '█'));
  }
  return out;
}

function buildLayoutSpec({ aspect = '1:1', imageUrl, headline, body, blurBackground = true, safeZone = 'center' }) {
  const preset = ASPECT_PRESETS[aspect] || ASPECT_PRESETS['1:1'];
  const focalMap = { center: '50% 50%', top: '50% 20%', bottom: '50% 80%' };
  return {
    success: true,
    engine: 'hyperframes-css',
    aspect: preset.id,
    dimensions: { width: preset.width, height: preset.height },
    platforms: preset.platforms,
    layers: [
      {
        id: 'background',
        type: imageUrl ? 'image' : 'gradient',
        url: imageUrl || null,
        style: {
          objectFit: 'cover',
          objectPosition: focalMap[safeZone] || focalMap.center,
          filter: blurBackground && imageUrl ? 'blur(12px) brightness(0.7)' : 'none',
        },
      },
      {
        id: 'foreground',
        type: imageUrl ? 'image' : 'none',
        url: imageUrl || null,
        style: {
          objectFit: 'contain',
          objectPosition: focalMap[safeZone] || focalMap.center,
          maxHeight: '72%',
        },
      },
      {
        id: 'text-overlay',
        type: 'text',
        headline: headline || '',
        body: body || '',
        style: { safeZone, padding: '8%', textShadow: '0 2px 12px rgba(0,0,0,0.45)' },
      },
    ],
    cssVars: {
      '--si-aspect-w': String(preset.width),
      '--si-aspect-h': String(preset.height),
      '--si-safe-zone': safeZone,
    },
  };
}

function wordsToVtt(words) {
  const lines = ['WEBVTT', ''];
  for (const w of words) {
    const start = msToVtt(w.startTimeMs || w.start_ms || 0);
    const end = msToVtt(w.endTimeMs || w.end_ms || (w.startTimeMs || 0) + 500);
    lines.push(`${start} --> ${end}`);
    lines.push(w.word_text || w.text || '');
    lines.push('');
  }
  return lines.join('\n');
}

function wordsToSrt(words) {
  return words.map((w, i) => {
    const start = msToSrt(w.startTimeMs || w.start_ms || 0);
    const end = msToSrt(w.endTimeMs || w.end_ms || (w.startTimeMs || 0) + 500);
    return `${i + 1}\n${start} --> ${end}\n${w.word_text || w.text || ''}\n`;
  }).join('\n');
}

function msToVtt(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const f = Math.floor(ms % 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${String(f).padStart(3, '0')}`;
}

function msToSrt(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const f = Math.floor(ms % 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(f).padStart(3, '0')}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

async function generateAtelierLayout(prompt, generateAI) {
  const base = {
    success: true,
    sceneId: `atelier_${Date.now()}`,
    prompt: String(prompt || '').slice(0, 500),
    slots: ['headline', 'subhead', 'body', 'cta', 'image'],
    layout: 'headline-image-cta',
    gradient: ['#0f172a', '#0284c7'],
    accent: '#38bdf8',
  };
  if (!generateAI || !prompt?.trim()) return base;

  try {
    const raw = await generateAI(
      `Convert this social design brief into a JSON layout config only (no markdown):
Brief: ${prompt}
Shape: { "headline": "", "subhead": "", "body": "", "cta": "", "layout": "headline-image-cta", "gradient": ["#hex","#hex"], "accent": "#hex" }`,
    );
    const match = String(raw).match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return { ...base, ...parsed, slots: ['headline', 'subhead', 'body', 'cta', 'image'] };
    }
  } catch (e) { /* fallback base */ }
  return base;
}

function registerDesignCompositorHandlers({ ipcMain, store, generateAI }) {
  ipcMain.handle('get-design-compositor-config', () => ({
    success: true,
    engines: {
      programmatic: { id: 'imperial-layout', label: 'Programmatic Layout Engine', channel: 'render-design-post' },
      compositor: { id: 'hyperframes-css', label: 'CSS Compositor (HyperFrames)', channel: 'compose-social-layout' },
    },
    aspects: Object.values(ASPECT_PRESETS),
    filters: FILTER_PRESETS,
    piiTypes: PII_PATTERNS.map((p) => ({ id: p.id, label: p.label })),
    subtitleFormats: ['vtt', 'srt'],
    storage: { type: 'local-store', sync: 'WAL-to-PostgreSQL via tenant jobs' },
  }));

  ipcMain.handle('compose-social-layout', (event, payload = {}) => {
    try {
      const spec = buildLayoutSpec(payload);
      return spec;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('scan-design-pii', (event, payload = {}) => {
    const texts = [
      payload.headline,
      payload.body,
      payload.caption,
      payload.content,
      ...(payload.fields ? Object.values(payload.fields) : []),
    ].filter(Boolean);
    const combined = texts.join('\n');
    const findings = scanTextForPii(combined);
    return {
      success: true,
      findingCount: findings.length,
      findings,
      redactedPreview: redactText(combined).slice(0, 2000),
      safe: findings.length === 0,
    };
  });

  ipcMain.handle('apply-design-filters', (event, payload = {}) => {
    const filter = FILTER_PRESETS.find((f) => f.id === payload.filterId) || FILTER_PRESETS[0];
    return {
      success: true,
      filterId: filter.id,
      label: filter.label,
      cssFilter: filter.css || 'none',
      playbackRate: payload.speed || 1,
      preview: {
        ...payload.preview,
        filter: filter.id,
      },
    };
  });

  ipcMain.handle('generate-atelier-layout', async (event, payload = {}) => {
    try {
      const layout = await generateAtelierLayout(payload.prompt || payload.brief, generateAI);
      return layout;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('export-design-subtitles', (event, payload = {}) => {
    const words = Array.isArray(payload.words) ? payload.words : [];
    if (!words.length) {
      return { success: false, error: 'No transcript words provided' };
    }
    const format = payload.format === 'srt' ? 'srt' : 'vtt';
    const content = format === 'srt' ? wordsToSrt(words) : wordsToVtt(words);
    return { success: true, format, content, wordCount: words.length };
  });

  ipcMain.handle('get-design-projects', () => ({
    success: true,
    projects: getProjects(store),
    count: getProjects(store).length,
  }));

  ipcMain.handle('save-design-project', (event, payload = {}) => {
    const projects = getProjects(store);
    const project = {
      id: payload.id || `proj_${Date.now()}`,
      name: payload.name || 'Untitled design',
      aspect: payload.aspect || '1:1',
      templateId: payload.templateId || null,
      fields: payload.fields || {},
      transcriptWords: payload.transcriptWords || [],
      layout: payload.layout || null,
      updatedAt: new Date().toISOString(),
      createdAt: payload.createdAt || new Date().toISOString(),
    };
    const idx = projects.findIndex((p) => p.id === project.id);
    if (idx >= 0) projects[idx] = { ...projects[idx], ...project };
    else projects.unshift(project);
    saveProjects(store, projects);
    return { success: true, project };
  });
}

module.exports = {
  registerDesignCompositorHandlers,
  ASPECT_PRESETS,
  FILTER_PRESETS,
  PII_PATTERNS,
  scanTextForPii,
  redactText,
  buildLayoutSpec,
};