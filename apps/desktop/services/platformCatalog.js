const PLATFORM_META = {
  Facebook: { icon: 'fab fa-facebook', color: '#1877f2', group: 'social' },
  Instagram: { icon: 'fab fa-instagram', color: '#e4405f', group: 'social' },
  WhatsApp: { icon: 'fab fa-whatsapp', color: '#25d366', group: 'social', note: 'Business API' },
  YouTube: { icon: 'fab fa-youtube', color: '#ff0000', group: 'social' },
  TikTok: { icon: 'fab fa-tiktok', color: '#f8fafc', group: 'social' },
  Twitter: { icon: 'fab fa-x-twitter', color: '#f8fafc', group: 'social', displayName: 'X (Twitter)' },
  X: { icon: 'fab fa-x-twitter', color: '#f8fafc', group: 'social', displayName: 'X (Twitter)' },
  Pinterest: { icon: 'fab fa-pinterest', color: '#bd081c', group: 'social' },
  Snapchat: { icon: 'fab fa-snapchat', color: '#fffc00', group: 'social' },
  Threads: { icon: 'fas fa-at', color: '#f8fafc', group: 'social' },
  Twitch: { icon: 'fab fa-twitch', color: '#9146ff', group: 'social' },
  LinkedIn: { icon: 'fab fa-linkedin', color: '#0a66c2', group: 'professional' },
  Reddit: { icon: 'fab fa-reddit-alien', color: '#ff4500', group: 'professional' },
  Quora: { icon: 'fab fa-quora', color: '#b92b27', group: 'professional', note: 'Q&A answers' },
  Discord: { icon: 'fab fa-discord', color: '#5865f2', group: 'professional', note: 'servers/channels' },
  Telegram: { icon: 'fab fa-telegram', color: '#26a5e4', group: 'messaging' },
};

const PLATFORM_GROUPS = [
  {
    label: 'Social & Content',
    platforms: ['Facebook', 'Instagram', 'WhatsApp', 'YouTube', 'TikTok', 'Twitter', 'Pinterest', 'Snapchat', 'Threads', 'Twitch'],
  },
  {
    label: 'Professional & Community',
    platforms: ['LinkedIn', 'Reddit', 'Quora', 'Discord'],
  },
  {
    label: 'Messaging & Other',
    platforms: ['Telegram'],
  },
];

const ALL_PLATFORMS = PLATFORM_GROUPS.flatMap((g) => g.platforms);

function normalizePlatform(name) {
  if (!name) return 'Unknown';
  const n = String(name).trim();
  if (n === 'X' || n.includes('Twitter')) return 'Twitter';
  return n.replace(/ Communities| Groups| Fanpages?/gi, '').trim() || n;
}

function getPlatformMeta(name) {
  const key = normalizePlatform(name);
  return PLATFORM_META[key] || { icon: 'fas fa-globe', color: '#94a3b8', group: 'other' };
}

function getPlatformDisplayName(name) {
  const meta = getPlatformMeta(name);
  return meta.displayName || normalizePlatform(name);
}

function platformIconHtml(name, size = '') {
  const meta = getPlatformMeta(name);
  const style = size ? `font-size:${size};` : '';
  return `<i class="${meta.icon}" style="color:${meta.color};${style}margin-right:6px;"></i>`;
}

function renderGroupedPlatformCheckboxes(selected = [], inputAttrs = '') {
  return PLATFORM_GROUPS.map((group) => {
    const chips = group.platforms.map((p) => {
      const meta = PLATFORM_META[p];
      const checked = selected.includes(p) ? 'checked' : '';
      const note = meta?.note ? ` <span style="opacity:0.6;font-size:0.7em;">(${meta.note})</span>` : '';
      const label = meta?.displayName || p;
      return `<label class="platform-toggle"><input type="checkbox" value="${p}" ${checked} ${inputAttrs}> ${platformIconHtml(p)}${label}${note}</label>`;
    }).join('');
    return `<div class="platform-group" style="margin-bottom:0.75rem;"><div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.35rem;font-weight:600;">${group.label}</div><div style="display:flex;flex-wrap:wrap;gap:0.75rem;">${chips}</div></div>`;
  }).join('');
}

module.exports = {
  PLATFORM_GROUPS,
  PLATFORM_META,
  ALL_PLATFORMS,
  normalizePlatform,
  getPlatformMeta,
  getPlatformDisplayName,
  platformIconHtml,
  renderGroupedPlatformCheckboxes,
};