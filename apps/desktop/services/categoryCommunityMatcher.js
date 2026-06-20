/**
 * Match RSS categories to the most relevant linked communities, groups, and subreddits.
 */
const { getLinkedAccounts } = require('./accountAutomation');
const { getAutomationTargets } = require('./accountAutomation');

const GROUP_TYPES = new Set(['Group', 'Server', 'Subreddit', 'Community']);

const TOPIC_KEYWORDS = {
  technology: ['tech', 'technology', 'gadget', 'software', 'programming', 'developer', 'coding', 'ai', 'artificial intelligence', 'startup', 'digital', 'cyber', 'hardware', 'innovation', 'silicon'],
  business: ['business', 'finance', 'entrepreneur', 'marketing', 'economy', 'startup', 'investing', 'commerce', 'sales', 'leadership'],
  health: ['health', 'fitness', 'wellness', 'medical', 'nutrition', 'diet', 'workout', 'mental health', 'medicine'],
  sports: ['sports', 'football', 'basketball', 'soccer', 'baseball', 'athletics', 'nfl', 'nba', 'fitness'],
  entertainment: ['entertainment', 'movies', 'music', 'celebrity', 'tv', 'film', 'gaming', 'games', 'pop culture'],
  science: ['science', 'research', 'physics', 'biology', 'space', 'astronomy', 'climate', 'environment'],
  politics: ['politics', 'news', 'government', 'election', 'policy', 'world news'],
  food: ['food', 'recipe', 'cooking', 'restaurant', 'cuisine', 'culinary', 'baking'],
  travel: ['travel', 'tourism', 'vacation', 'destination', 'adventure', 'backpacking'],
  fashion: ['fashion', 'style', 'beauty', 'clothing', 'design', 'lifestyle'],
  education: ['education', 'learning', 'school', 'university', 'teaching', 'students'],
  crypto: ['crypto', 'bitcoin', 'blockchain', 'ethereum', 'defi', 'web3'],
  automotive: ['auto', 'automotive', 'cars', 'vehicles', 'motor', 'driving'],
  parenting: ['parenting', 'family', 'kids', 'children', 'mom', 'dad', 'baby'],
  real_estate: ['real estate', 'property', 'housing', 'mortgage', 'home', 'rent'],
};

const PLATFORM_COMMUNITY_HINTS = {
  Reddit: ['subreddit', 'r/'],
  Facebook: ['group', 'community'],
  Discord: ['server', 'community'],
  LinkedIn: ['group'],
};

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s/+_-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function expandCategoryKeywords(categoryLabel, categorySlug) {
  const base = [
    ...tokenize(categoryLabel),
    ...tokenize(categorySlug?.replace(/-/g, ' ')),
  ];
  const expanded = new Set(base);
  Object.entries(TOPIC_KEYWORDS).forEach(([topic, words]) => {
    const topicTokens = tokenize(topic.replace(/_/g, ' '));
    const overlap = base.some((b) => topicTokens.includes(b) || words.includes(b));
    if (overlap) words.forEach((w) => expanded.add(w));
  });
  return Array.from(expanded);
}

function scoreTarget(categoryKeywords, target) {
  const name = [
    target.name,
    target.handle,
    target.subreddit,
    target.id,
    target.platform,
    target.type,
  ].filter(Boolean).join(' ').toLowerCase();

  const nameTokens = tokenize(name);
  let score = 0;
  const matched = [];

  categoryKeywords.forEach((kw) => {
    if (name.includes(kw)) {
      score += kw.length > 5 ? 18 : 12;
      matched.push(kw);
    }
    nameTokens.forEach((nt) => {
      if (nt === kw || nt.includes(kw) || kw.includes(nt)) {
        score += 8;
        matched.push(kw);
      }
    });
  });

  if (target.type === 'Subreddit' && /r\//i.test(target.name || '')) {
    const sub = (target.subreddit || target.name || '').replace(/^r\//i, '').toLowerCase();
    categoryKeywords.forEach((kw) => {
      if (sub === kw || sub.includes(kw)) {
        score += 25;
        matched.push(kw);
      }
    });
  }

  if (target.type === 'Group' && /group|community/i.test(target.name || '')) {
    categoryKeywords.forEach((kw) => {
      if ((target.name || '').toLowerCase().includes(kw)) score += 15;
    });
  }

  const platform = target.platform || '';
  if (PLATFORM_COMMUNITY_HINTS[platform]) {
    score += 3;
  }

  return { score, matched: [...new Set(matched)] };
}

function collectAllTargets(store, campaignId) {
  const accounts = getLinkedAccounts(store, campaignId);
  const targets = [];
  const seen = new Set();

  accounts.forEach((account) => {
    getAutomationTargets(account, accounts).forEach((t) => {
      const isGroup = GROUP_TYPES.has(t.type) || t.source === 'group';
      if (!isGroup && t.type !== 'Page' && t.type !== 'Channel') return;
      const key = `${t.platform}:${t.id}:${t.source || 'account'}`;
      if (seen.has(key)) return;
      seen.add(key);
      targets.push({
        ...t,
        accountId: account.id,
        rootAccountId: account.id,
        platform: t.platform || account.platform,
      });
    });
  });

  return targets;
}

function matchCategoryToTargets({ categoryLabel, categorySlug, store, campaignId, minScore = 20, limit = 8 }) {
  const keywords = expandCategoryKeywords(categoryLabel, categorySlug);
  const targets = collectAllTargets(store, campaignId);

  const ranked = targets
    .map((target) => {
      const { score, matched } = scoreTarget(keywords, target);
      return {
        accountId: target.accountId || target.rootAccountId,
        targetId: String(target.id),
        targetName: target.name || target.handle || target.subreddit || String(target.id),
        platform: target.platform,
        targetType: target.type,
        subreddit: target.subreddit || (target.type === 'Subreddit' ? (target.name || '').replace(/^r\//i, '') : null),
        source: target.source || 'account',
        relevanceScore: Math.min(100, score),
        matchedKeywords: matched,
        autoPost: score >= minScore,
      };
    })
    .filter((r) => r.relevanceScore >= minScore)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);

  return {
    category: categoryLabel,
    categorySlug,
    keywords,
    matches: ranked,
    totalTargetsScanned: targets.length,
  };
}

function autoMapFeedsToTargets(store, campaignId, feeds) {
  return feeds.map((feed) => {
    const result = matchCategoryToTargets({
      categoryLabel: feed.category,
      categorySlug: feed.categorySlug,
      store,
      campaignId,
    });
    return {
      ...feed,
      targetMappings: result.matches,
      suggestedKeywords: result.keywords,
    };
  });
}

module.exports = {
  expandCategoryKeywords,
  matchCategoryToTargets,
  autoMapFeedsToTargets,
  collectAllTargets,
};