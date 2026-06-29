const axios = require('axios');
const { normalizePlatform } = require('./platformCatalog');

const PLATFORM_LIMITS = {
  Twitter: { max: 280, hashtags: ['#marketing', '#tips'] },
  LinkedIn: { max: 3000, hashtags: ['#business', '#growth'] },
  Facebook: { max: 5000, hashtags: ['#community'] },
  Instagram: { max: 2200, hashtags: ['#insta', '#brand'] },
  Reddit: { max: 40000, hashtags: [] },
  TikTok: { max: 2200, hashtags: ['#fyp', '#tips'] },
  YouTube: { max: 5000, hashtags: ['#shorts'] },
  default: { max: 2000, hashtags: ['#content'] },
};

function loadJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function formatPostForPlatform(content, platform) {
  const key = normalizePlatform(platform);
  const rules = PLATFORM_LIMITS[key] || PLATFORM_LIMITS.default;
  let text = String(content || '').trim();
  if (text.length > rules.max) {
    text = `${text.substring(0, rules.max - 20)}… ${rules.hashtags.slice(0, 2).join(' ')}`;
  } else if (rules.hashtags.length && !text.includes('#')) {
    text += ` ${rules.hashtags.slice(0, 3).join(' ')}`;
  }
  return text;
}

async function parseRssItems(rssUrl, limit = 5) {
  const res = await axios.get(rssUrl, { timeout: 12000 });
  const xml = res.data;
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) && items.length < limit) {
    const itemXml = match[1];
    const title = (itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || 'Untitled';
    const link = (itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '';
    const desc = (itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1]
      || (itemXml.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i) || [])[1] || '';
    const cleanDesc = desc.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').replace(/<[^>]+>/g, '').trim().substring(0, 400);
    const guid = (itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1] || link;
    items.push({
      title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
      link: link.trim(),
      description: cleanDesc,
      guid: guid.trim(),
    });
  }
  return items;
}

function getSeenRssGuids(store) {
  return new Set(loadJson(store, 'rssSeenGuids', []));
}

function markRssGuidSeen(store, guid) {
  const seen = getSeenRssGuids(store);
  seen.add(guid);
  store.setItem('rssSeenGuids', JSON.stringify(Array.from(seen).slice(-500)));
}

async function generateFalImage(prompt, falKey) {
  if (!falKey) return null;
  try {
    const res = await axios.post('https://fal.run/fal-ai/fast-sdxl', {
      prompt,
      num_images: 1,
      image_size: 'square_hd',
    }, {
      headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
      timeout: 60000,
    });
    return res.data?.images?.[0]?.url || null;
  } catch (e) {
    console.error('FAL image error:', e.message);
    return null;
  }
}

async function generateCarouselSlides({ generateAI, falKey, topic, campaign, count = 4 }) {
  const prompt = `Create exactly ${count} carousel slide texts for ${campaign.brandName} about: "${topic}".
Return JSON array: [{"caption":"...","imagePrompt":"..."}]`;
  let slides = [];
  try {
    const raw = await generateAI(prompt);
    const match = raw.match(/\[[\s\S]*\]/);
    slides = match ? JSON.parse(match[0]) : [];
  } catch (e) {
    slides = Array.from({ length: count }, (_, i) => ({
      caption: `Slide ${i + 1}: ${topic}`,
      imagePrompt: `Professional carousel slide ${i + 1} for ${campaign.brandName}`,
    }));
  }

  const results = [];
  for (const slide of slides.slice(0, count)) {
    const imageUrl = await generateFalImage(slide.imagePrompt || slide.caption, falKey);
    results.push({ caption: slide.caption, imageUrl });
  }
  return results;
}

function queueContent(store, post) {
  const queue = loadJson(store, 'contentReviewQueue', []);
  queue.unshift({
    ...post,
    id: `queue_${Date.now()}`,
    queuedAt: new Date().toISOString(),
    status: 'pending_review',
  });
  store.setItem('contentReviewQueue', JSON.stringify(queue.slice(0, 100)));
  return queue[0];
}

async function curateRssItem({ item, campaign, generateAI, targetPlatform, falKey }) {
  const curatePrompt = `Create an engaging ${targetPlatform} post for ${campaign.brandName} (${campaign.domain}) from this RSS item.
Tone: ${campaign.tone || 'professional'}. Audience: ${campaign.audience || 'professionals'}.
Title: ${item.title}
Summary: ${item.description}
Link: ${item.link}
Return ONLY post text with CTA and hashtags.`;
  const postText = (await generateAI(curatePrompt)).trim();
  const formatted = formatPostForPlatform(postText, targetPlatform);
  const imagePrompt = `Eye-catching social image for ${campaign.brandName}: ${item.title}`;
  const mediaUrl = await generateFalImage(imagePrompt, falKey);
  return {
    title: item.title,
    originalLink: item.link,
    content: formatted,
    rawContent: postText,
    mediaUrl,
    platform: targetPlatform,
    curatedFor: campaign.brandName,
    source: 'rss',
  };
}

async function runContentScheduler({
  store, generateAI, falKey, publishFn, campaign,
}) {
  const settings = loadJson(store, 'autoContentSettings', {
    enabled: false, rssUrls: [], targetAccountIds: [], frequency: 'daily',
    publishMode: 'queue', targetPlatforms: ['Facebook'],
    formatIntelligenceEnabled: false, formatTemplateIds: [], formatKeywords: [],
    formatKeywordSource: 'both', formatPostsPerRun: 1, formatGenerateImages: true,
  });

  const rssActive = settings.enabled && settings.rssUrls?.length;
  const formatActive = settings.formatIntelligenceEnabled;
  if (!rssActive && !formatActive) {
    return { processed: 0, skipped: true, reason: 'RSS and format intelligence both disabled' };
  }

  const seen = getSeenRssGuids(store);
  let rssProcessed = 0;
  const results = [];
  let formatResult = { processed: 0, results: [] };

  if (rssActive) for (const rssUrl of settings.rssUrls) {
    let items = [];
    try {
      items = await parseRssItems(rssUrl, 3);
    } catch (e) {
      console.error(`RSS parse failed ${rssUrl}:`, e.message);
      continue;
    }

    for (const item of items) {
      const guid = item.guid || item.link;
      if (!guid || seen.has(guid)) continue;

      for (const platform of (settings.targetPlatforms || ['Facebook'])) {
        try {
          const curated = await curateRssItem({
            item, campaign, generateAI, targetPlatform: platform, falKey,
          });

          if (settings.publishMode === 'auto') {
            await publishFn(curated, settings.targetAccountIds || []);
            results.push({ action: 'published', platform, title: item.title });
          } else {
            queueContent(store, curated);
            results.push({ action: 'queued', platform, title: item.title });
          }
          rssProcessed += 1;
        } catch (e) {
          console.error('Curate/publish error:', e.message);
        }
      }
      markRssGuidSeen(store, guid);
    }
  }

  if (formatActive) {
    const { runFormatIntelligenceScheduler } = require('./imageFormatIntelligence');
    const generateImage = falKey
      ? async (prompt) => {
        const url = await generateFalImage(prompt, falKey);
        return url ? { success: true, imageUrl: url } : { success: false, error: 'Image generation failed' };
      }
      : null;
    formatResult = await runFormatIntelligenceScheduler({
      store,
      generateAI,
      generateImage,
      campaign,
      settings,
      publishFn,
      queueContentFn: queueContent,
    });
    if (formatResult.results?.length) results.push(...formatResult.results);
  }

  const processed = rssProcessed + (formatResult.processed || 0);
  store.setItem('autoContentLastRun', String(Date.now()));
  return {
    processed,
    results,
    rssProcessed,
    formatProcessed: formatResult.processed || 0,
    formatIntelligence: formatResult,
    message: formatResult.processed
      ? `Format intelligence: ${formatResult.processed} post(s) ${settings.publishMode === 'auto' ? 'published' : 'queued'}`
      : undefined,
  };
}

function reuseAnswerAsContent(answer, campaign, format = 'blog') {
  if (format === 'blog') {
    return `# ${campaign.brandName} Expert Answer\n\n${answer}\n\n---\n*Originally answered on social Q&A. Visit ${campaign.domain || 'our site'} for more.*`;
  }
  if (format === 'social') {
    const excerpt = answer.split('\n').filter(Boolean).slice(0, 2).join(' ');
    return formatPostForPlatform(`${excerpt} — More at ${campaign.domain || ''}`, 'Twitter');
  }
  if (format === 'thread') {
    const sentences = answer.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
    return sentences.slice(0, 8).map((s, i) => `${i + 1}/ ${s}`).join('\n\n');
  }
  return answer;
}

module.exports = {
  PLATFORM_LIMITS,
  formatPostForPlatform,
  parseRssItems,
  generateCarouselSlides,
  queueContent,
  curateRssItem,
  runContentScheduler,
  reuseAnswerAsContent,
};