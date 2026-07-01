const express = require('express');
const { captureLead } = require('../services/leadCaptureService');
const { leadRateLimit } = require('../middleware/leadRateLimit');

const router = express.Router();

router.post('/capture', leadRateLimit, async (req, res) => {
  try {
    const { email, name, source, discountCode } = req.body || {};
    const result = await captureLead({ email, name, source, discountCode });
    res.json(result);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;