const express = require('express');
const { resolveActiveProject } = require('../projectEnsure');
const {
  researchBrandFromDomain,
  propagateBrandToModules,
  getOnboardingModuleContext,
} = require('../onboarding/brandResearchOrchestrator');

const router = express.Router();

router.get('/context', async (req, res) => {
  try {
    const project = await resolveActiveProject(req.user.orgId, req.query?.projectId || req.headers['x-project-id']);
    const result = await getOnboardingModuleContext(project.id, req.user.orgId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/research-brand', async (req, res) => {
  try {
    const { domain, brandName, tone, persist } = req.body || {};
    if (!String(domain || '').trim()) {
      return res.status(400).json({ success: false, error: 'Domain is required for brand research' });
    }
    const project = await resolveActiveProject(req.user.orgId, req.body?.projectId || req.headers['x-project-id']);
    const result = await researchBrandFromDomain(project.id, req.user.orgId, { domain, brandName, tone, persist });
    res.json(result);
  } catch (e) {
    console.error('onboarding/research-brand:', e.message);
    const msg = e.message || 'Brand research failed';
    const status = /domain is required|invalid domain/i.test(msg) ? 400 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

router.post('/propagate', async (req, res) => {
  try {
    const payload = req.body || {};
    const project = await resolveActiveProject(req.user.orgId, payload.projectId || req.headers['x-project-id']);
    const result = await propagateBrandToModules(project.id, req.user.orgId, payload);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;