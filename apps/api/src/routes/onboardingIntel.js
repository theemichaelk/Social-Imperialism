const express = require('express');
const { resolveActiveProject } = require('../projectEnsure');
const {
  researchBrandFromDomain,
  propagateBrandToModules,
} = require('../onboarding/brandResearchOrchestrator');

const router = express.Router();

router.post('/research-brand', async (req, res) => {
  try {
    const { domain, brandName, tone } = req.body || {};
    const project = await resolveActiveProject(req.user.orgId, req.body?.projectId || req.headers['x-project-id']);
    const result = await researchBrandFromDomain(project.id, req.user.orgId, { domain, brandName, tone });
    res.json(result);
  } catch (e) {
    console.error('onboarding/research-brand:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/propagate', async (req, res) => {
  try {
    const { brand } = req.body || {};
    const project = await resolveActiveProject(req.user.orgId, req.body?.projectId || req.headers['x-project-id']);
    const result = await propagateBrandToModules(project.id, req.user.orgId, brand || {});
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;