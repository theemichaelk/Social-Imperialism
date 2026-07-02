const express = require('express');
const { resolveActiveProject } = require('../projectEnsure');
const {
  runProjectSelfAudit,
  getSelfHealStatus,
} = require('../selfHeal/selfHealEngine');

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    const project = await resolveActiveProject(req.user.orgId, req.headers['x-project-id']);
    const status = await getSelfHealStatus(project.id, req.user.orgId);
    res.json({ success: true, ...status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/journal', async (req, res) => {
  try {
    const project = await resolveActiveProject(req.user.orgId, req.headers['x-project-id']);
    const status = await getSelfHealStatus(project.id, req.user.orgId);
    res.json({
      success: true,
      journal: status.journal,
      learning: status.learning,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/recommendations/daily', async (req, res) => {
  try {
    const project = await resolveActiveProject(req.user.orgId, req.headers['x-project-id']);
    const status = await getSelfHealStatus(project.id, req.user.orgId);
    res.json({
      success: true,
      recommendations: status.recommendations,
      lastAudit: status.lastAudit,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/audit/run', async (req, res) => {
  try {
    const project = await resolveActiveProject(req.user.orgId, req.body?.projectId || req.headers['x-project-id']);
    const result = await runProjectSelfAudit(project.id, req.user.orgId, {
      skipAutoFix: !!req.body?.skipAutoFix,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('self-heal/audit/run:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;