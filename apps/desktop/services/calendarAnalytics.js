const { normalizePlatform } = require('./platformCatalog');

function loadJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function analyzeEngagementPatterns(store, campaignId = null) {
  const history = loadJson(store, 'postHistory', []);
  const replies = loadJson(store, 'aiRepliesHistory', []);
  const scoped = history.filter((p) => !campaignId || !p.campaignId || p.campaignId === campaignId);

  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, engagement: 0, posts: 0 }));
  const byDay = Array.from({ length: 7 }, (_, d) => ({ day: d, engagement: 0, posts: 0 }));
  const byPlatform = {};

  const addEngagement = (entry, platform) => {
    const ts = entry.timestamp || entry.publishedAt;
    if (!ts) return;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return;
    const hour = d.getHours();
    const day = d.getDay();
    const eng = (entry.stats?.likes || 0) + (entry.stats?.comments || 0) * 2
      + (entry.stats?.shares || 0) * 3 + (entry.stats?.views || 0) * 0.01;

    byHour[hour].engagement += eng;
    byHour[hour].posts += 1;
    byDay[day].engagement += eng;
    byDay[day].posts += 1;

    const plat = normalizePlatform(platform || entry.platform || 'Unknown');
    if (!byPlatform[plat]) byPlatform[plat] = { platform: plat, engagement: 0, posts: 0, hours: {} };
    byPlatform[plat].engagement += eng;
    byPlatform[plat].posts += 1;
    byPlatform[plat].hours[hour] = (byPlatform[plat].hours[hour] || 0) + eng;
  };

  scoped.forEach((p) => addEngagement(p, p.platform));
  replies.filter((r) => r.status === 'Published' || r.status === 'published')
    .forEach((r) => addEngagement({ ...r, stats: { likes: 5, comments: 1 } }, r.platform));

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const topHours = [...byHour]
    .map((h) => ({ ...h, avg: h.posts ? h.engagement / h.posts : 0 }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);

  const topDays = [...byDay]
    .map((d) => ({ ...d, dayName: dayNames[d.day], avg: d.posts ? d.engagement / d.posts : 0 }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3);

  const platformBestTimes = Object.values(byPlatform).map((p) => {
    const bestHour = Object.entries(p.hours).sort((a, b) => b[1] - a[1])[0];
    return {
      platform: p.platform,
      posts: p.posts,
      totalEngagement: Math.round(p.engagement),
      bestHour: bestHour ? parseInt(bestHour[0], 10) : 10,
      bestHourLabel: bestHour ? formatHour(parseInt(bestHour[0], 10)) : '10:00 AM',
    };
  });

  const defaultSuggestions = [
    { day: 'Tuesday', hour: 10, label: 'Tuesday 10:00 AM', score: 85, reason: 'Industry benchmark — peak B2B engagement' },
    { day: 'Wednesday', hour: 14, label: 'Wednesday 2:00 PM', score: 82, reason: 'Mid-week afternoon visibility' },
    { day: 'Thursday', hour: 11, label: 'Thursday 11:00 AM', score: 80, reason: 'Pre-weekend decision window' },
  ];

  const suggestions = topHours.length >= 2
    ? topHours.slice(0, 3).map((h, i) => {
        const bestDay = topDays[i] || topDays[0] || { dayName: 'Wednesday' };
        return {
          day: bestDay.dayName,
          hour: h.hour,
          label: `${bestDay.dayName} ${formatHour(h.hour)}`,
          score: Math.round(70 + h.avg),
          reason: `Based on ${h.posts} post(s) averaging ${Math.round(h.avg)} engagement at this hour`,
        };
      })
    : defaultSuggestions;

  const hourlyEngagement = byHour.map((h) => ({
    hour: h.hour,
    engagement: Math.round(h.engagement),
    posts: h.posts,
    avg: h.posts ? Math.round(h.engagement / h.posts) : 0,
  }));

  return {
    dataPoints: scoped.length,
    topHours,
    hourlyEngagement,
    topDays,
    platformBestTimes,
    suggestions,
    timezoneNote: 'Times based on local post timestamps in your history',
  };
}

function formatHour(h) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:00 ${ampm}`;
}

function groupScheduledByPlatform(posts) {
  const groups = {};
  posts.forEach((p) => {
    const plat = normalizePlatform(p.platform || 'Unknown');
    if (!groups[plat]) groups[plat] = [];
    groups[plat].push(p);
  });
  Object.values(groups).forEach((arr) => {
    arr.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  });
  return groups;
}

function getUpcomingByPlatform(posts, daysAhead = 14) {
  const now = Date.now();
  const cutoff = now + daysAhead * 86400000;
  const upcoming = posts.filter((p) => {
    const t = new Date(p.timestamp).getTime();
    return !Number.isNaN(t) && t >= now && t <= cutoff;
  });
  return groupScheduledByPlatform(upcoming);
}

module.exports = {
  analyzeEngagementPatterns,
  groupScheduledByPlatform,
  getUpcomingByPlatform,
  formatHour,
};