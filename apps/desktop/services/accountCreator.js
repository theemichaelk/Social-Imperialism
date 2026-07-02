/**
 * Social Profile Account Creator — identity, assets, and schedule generation.
 */
const SUPPORTED_PLATFORMS = [
  'Twitter', 'LinkedIn', 'Facebook', 'Instagram', 'YouTube', 'TikTok',
  'Pinterest', 'Reddit', 'Threads', 'Twitch', 'Telegram', 'Discord',
];

const VARIANT_SETTINGS = [
  { id: 'studio', label: 'Studio headshot', promptSuffix: 'professional studio headshot, neutral background, sharp focus' },
  { id: 'office', label: 'Office professional', promptSuffix: 'in a modern office, business attire, natural window light' },
  { id: 'outdoor', label: 'Casual outdoor', promptSuffix: 'casual outdoor setting, golden hour, approachable smile' },
  { id: 'conference', label: 'Conference speaker', promptSuffix: 'speaking at a conference, stage lighting, confident pose' },
  { id: 'coffee', label: 'Lifestyle café', promptSuffix: 'lifestyle photo in a coffee shop, relaxed professional look' },
  { id: 'workspace', label: 'Creative workspace', promptSuffix: 'creative workspace with laptop, focused working mood' },
];

const COVER_QUERIES = {
  Twitter: 'minimal abstract gradient social media header',
  LinkedIn: 'professional business skyline cover photo',
  Facebook: 'brand community cover banner abstract',
  Instagram: 'aesthetic brand mood board collage',
  YouTube: 'cinematic channel banner technology brand',
  TikTok: 'vibrant energetic social media banner',
  Pinterest: 'inspirational lifestyle brand banner',
  Reddit: 'community banner abstract pattern',
  Threads: 'modern social header gradient',
  Twitch: 'gaming stream channel banner neon',
  Telegram: 'clean messaging app channel banner',
  Discord: 'community server banner dark theme',
};

function kitsStorageKey(campaignId) {
  return `profileKits_${campaignId || 'default'}`;
}

function getProfileKits(store, campaignId) {
  try {
    return JSON.parse(store.getItem(kitsStorageKey(campaignId)) || '[]');
  } catch {
    return [];
  }
}

function saveProfileKits(store, campaignId, kits) {
  store.setItem(kitsStorageKey(campaignId), JSON.stringify(kits));
}

function makeKitId() {
  return `kit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function extractYouTubeVideoId(url) {
  if (!url) return null;
  const str = String(url).trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const re of patterns) {
    const m = str.match(re);
    if (m) return m[1];
  }
  return null;
}

function buildIdentityPrompt(campaign, options = {}) {
  const platforms = options.platforms || SUPPORTED_PLATFORMS.slice(0, 6);
  const personaHint = options.personaName ? `Suggested persona name: ${options.personaName}` : 'Invent a credible persona name.';
  const styleHint = options.personaStyle || 'professional, trustworthy, on-brand';

  return `You are a social media brand strategist. Create a complete multi-platform social identity kit.

Campaign brand: ${campaign.brandName || 'Brand'}
Domain: ${campaign.domain || ''}
Description: ${campaign.description || ''}
Tone: ${campaign.tone || 'professional'}
Audience: ${campaign.audience || 'general'}
${personaHint}
Persona style: ${styleHint}
Platforms to create accounts for: ${platforms.join(', ')}

Return ONLY valid JSON (no markdown) with this exact structure:
{
  "displayName": "Full display name",
  "tagline": "Short tagline under 80 chars",
  "longDescription": "2-3 sentence brand/persona description",
  "handleSuggestions": { "Twitter": "@handle", "LinkedIn": "handle", ... },
  "bios": { "Twitter": "bio max 160 chars", "LinkedIn": "headline", "Instagram": "bio", "YouTube": "channel description", ... },
  "profileImagePrompt": "detailed prompt for AI portrait matching brand",
  "coverSearchQueries": { "Twitter": "unsplash search query", ... },
  "youtube": {
    "channelName": "name",
    "channelDescription": "description",
    "featuredVideoTitle": "title for featured video"
  }
}`;
}

function parseJsonFromAi(text) {
  if (!text) throw new Error('AI returned empty response.');
  const cleaned = String(text).replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI response did not contain JSON.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function buildSchedulePrompt(campaign, identity, options = {}) {
  const platforms = options.platforms || [];
  const weeks = options.scheduleWeeks || 4;
  const postsPerWeek = options.postsPerWeek || 3;
  const youtubeUrl = options.youtubeVideoUrl || '';

  return `Create a ${weeks}-week content schedule for a new social media persona.

Brand: ${campaign.brandName}
Persona: ${identity.displayName}
Tagline: ${identity.tagline}
Platforms: ${platforms.join(', ')}
Posts per week (total across platforms): ~${postsPerWeek}
${youtubeUrl ? `Include YouTube video URL in at least 2 posts: ${youtubeUrl}` : ''}

Return ONLY valid JSON array (no markdown):
[
  {
    "platform": "Twitter",
    "dayOffset": 0,
    "time": "09:00",
    "contentType": "post",
    "content": "post text",
    "mediaHint": "optional image description or null",
    "youtubeUrl": null
  }
]

Rules:
- dayOffset is days from launch (0 = day 1)
- time is HH:MM 24h format
- contentType: post | video | story | reel
- Spread posts across platforms and days
- Match brand tone: ${campaign.tone || 'professional'}
- Include intro/welcome posts in first 3 days`;
}

function parseScheduleFromAi(text) {
  const cleaned = String(text).replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('AI schedule response was not a JSON array.');
  const items = JSON.parse(cleaned.slice(start, end + 1));
  return Array.isArray(items) ? items : [];
}

function fallbackSchedule(platforms, identity, options = {}) {
  const weeks = options.scheduleWeeks || 4;
  const postsPerWeek = options.postsPerWeek || 3;
  const total = weeks * postsPerWeek;
  const schedule = [];
  const youtubeUrl = options.youtubeVideoUrl || null;
  const templates = [
    `Welcome! I'm ${identity.displayName}. ${identity.tagline || ''}`.trim(),
    `Excited to share insights about ${options.brandName || 'our brand'}. Follow for updates!`,
    `New content dropping soon. What topics should we cover?`,
    `Behind the scenes — building something great for our community.`,
    `Quick tip of the day from ${identity.displayName}.`,
  ];

  for (let i = 0; i < total; i++) {
    const platform = platforms[i % platforms.length];
    const dayOffset = Math.floor(i / postsPerWeek) * 2 + (i % 2);
    const hour = 9 + (i % 4) * 2;
    const isVideo = platform === 'YouTube' && youtubeUrl && i % 3 === 0;
    schedule.push({
      platform,
      dayOffset,
      time: `${String(hour).padStart(2, '0')}:00`,
      contentType: isVideo ? 'video' : 'post',
      content: templates[i % templates.length],
      mediaHint: null,
      youtubeUrl: isVideo ? youtubeUrl : null,
    });
  }
  return schedule;
}

function scheduleToCalendarPosts(schedule, kit, campaignId, launchDate, accountMap = null) {
  const base = launchDate ? new Date(launchDate) : new Date();
  base.setHours(0, 0, 0, 0);
  const map = accountMap || kit.accountMap || {};

  return schedule.map((item, idx) => {
    const [hh, mm] = String(item.time || '09:00').split(':').map((n) => parseInt(n, 10));
    const scheduled = new Date(base);
    scheduled.setDate(scheduled.getDate() + (item.dayOffset || 0));
    scheduled.setHours(hh || 9, mm || 0, 0, 0);

    const ytId = extractYouTubeVideoId(item.youtubeUrl);
    const isVideo = item.contentType === 'video' || !!ytId;
    const accountId = map[item.platform] || null;

    return {
      id: `sched_kit_${kit.id}_${idx}_${Date.now()}`,
      campaignId,
      platform: item.platform,
      accountId: accountId && typeof accountId === 'object' ? accountId.id : accountId,
      content: item.content,
      mediaUrl: ytId ? `https://www.youtube.com/watch?v=${ytId}` : (item.mediaUrl || null),
      hasMedia: !!(ytId || item.mediaUrl),
      isVideo,
      rules: { sourceKitId: kit.id, contentType: item.contentType || 'post' },
      timestamp: scheduled.toISOString(),
      dateIndex: scheduled.getDate(),
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };
  });
}

function createEmptyKit(campaignId, options = {}) {
  return {
    id: makeKitId(),
    campaignId,
    name: options.personaName || 'New Persona',
    status: 'draft',
    platforms: options.platforms || [],
    proxyId: options.proxyId || null,
    accountMap: options.accountMap || {},
    identity: null,
    assets: {
      profilePic: null,
      variantPics: [],
      covers: {},
      banners: {},
    },
    youtube: {
      featuredVideoUrl: options.youtubeVideoUrl || null,
      videoId: extractYouTubeVideoId(options.youtubeVideoUrl),
    },
    contentSchedule: [],
    launchDate: options.launchDate || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function saveKit(store, kit) {
  const kits = getProfileKits(store, kit.campaignId);
  const idx = kits.findIndex((k) => k.id === kit.id);
  kit.updatedAt = new Date().toISOString();
  if (idx >= 0) kits[idx] = kit;
  else kits.unshift(kit);
  saveProfileKits(store, kit.campaignId, kits);
  return kit;
}

function deleteKit(store, campaignId, kitId) {
  const kits = getProfileKits(store, campaignId).filter((k) => k.id !== kitId);
  saveProfileKits(store, campaignId, kits);
  return { success: true };
}

function getKitById(store, campaignId, kitId) {
  return getProfileKits(store, campaignId).find((k) => k.id === kitId) || null;
}

function isQaTestKit(kit) {
  const name = String(kit?.name || kit?.identity?.displayName || '').trim();
  if (!name) return false;
  if (/^qa(\s|$|brand|lite|-)/i.test(name)) return true;
  if (name === 'QA Lite') return true;
  const tags = kit?.tags || [];
  return Array.isArray(tags) && tags.some((t) => String(t).toLowerCase() === 'qa');
}

function kitFingerprint(kit) {
  const name = String(kit?.name || kit?.identity?.displayName || '').trim().toLowerCase();
  const platforms = [...(kit?.platforms || [])].sort().join(',');
  const bio = String(kit?.identity?.shortBio || kit?.identity?.tagline || '').trim().toLowerCase().slice(0, 120);
  return `${name}::${platforms}::${bio}`;
}

function dedupeProfileKits(kits) {
  const seen = new Set();
  const kept = [];
  let removed = 0;
  (kits || []).forEach((kit) => {
    const fp = kitFingerprint(kit);
    if (seen.has(fp)) {
      removed += 1;
      return;
    }
    seen.add(fp);
    kept.push(kit);
  });
  return { kits: kept, removed };
}

function filterProfileKitsForDisplay(kits, { hideQa = true } = {}) {
  let list = [...(kits || [])];
  if (hideQa) list = list.filter((k) => !isQaTestKit(k));
  return list;
}

module.exports = {
  SUPPORTED_PLATFORMS,
  VARIANT_SETTINGS,
  COVER_QUERIES,
  kitsStorageKey,
  getProfileKits,
  saveProfileKits,
  makeKitId,
  extractYouTubeVideoId,
  buildIdentityPrompt,
  parseJsonFromAi,
  buildSchedulePrompt,
  parseScheduleFromAi,
  fallbackSchedule,
  scheduleToCalendarPosts,
  createEmptyKit,
  saveKit,
  deleteKit,
  getKitById,
  isQaTestKit,
  kitFingerprint,
  dedupeProfileKits,
  filterProfileKitsForDisplay,
};