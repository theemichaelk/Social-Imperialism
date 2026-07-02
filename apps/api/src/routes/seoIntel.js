const express = require('express');
const { invoke } = require('@si/core');
const { resolveActiveProject } = require('../projectEnsure');
const {
  buildIntelligenceBrief,
  fetchLivePulse,
  listFrameworks,
  isSeoQuery,
  resolveProjectKeys,
} = require('../seo/seoIntelligenceEngine');

const router = express.Router();

async function getProjectContext(req) {
  const project = await resolveActiveProject(req.user.orgId, req.body?.projectId || req.headers['x-project-id']);
  const keys = await resolveProjectKeys(project.id, req.user.orgId);
  return { project, keys };
}

router.get('/frameworks', (_req, res) => {
  res.json({ success: true, ...listFrameworks() });
});

router.get('/detect', (req, res) => {
  const query = String(req.query.q || '');
  res.json({
    success: true,
    query,
    isSeo: isSeoQuery(query),
  });
});

router.post('/intelligence/brief', async (req, res) => {
  try {
    const { query, pathname } = req.body || {};
    const q = String(query || '').trim();
    if (!q) return res.status(400).json({ error: 'query is required' });

    const { project, keys } = await getProjectContext(req);
    const brief = await buildIntelligenceBrief(q, {
      pathname,
      keys,
      invoke,
      projectId: project.id,
      organizationId: req.user.orgId,
    });

    res.json({
      success: true,
      isSeo: isSeoQuery(q),
      brief: {
        query: brief.query,
        intents: brief.intents,
        keyword: brief.keyword,
        location: brief.location,
        frameworks: brief.frameworks,
        engineSnapshots: brief.engineSnapshots,
        recommendations: brief.recommendations,
        pulse: brief.pulse,
        toolInsights: brief.toolInsights,
        promptAppend: brief.promptAppend,
        liveData: brief.liveData,
        fromCache: brief.fromCache || false,
        generatedAt: brief.generatedAt,
      },
    });
  } catch (e) {
    console.error('seo/intelligence/brief:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/intelligence/live-pulse', async (req, res) => {
  try {
    const topic = String(req.body?.topic || req.body?.query || 'SEO trends').trim();
    const { keys } = await getProjectContext(req);
    const pulse = await fetchLivePulse(topic, keys);
    res.json({ success: true, pulse });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;