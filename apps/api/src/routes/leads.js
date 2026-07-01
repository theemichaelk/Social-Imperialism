const express = require('express');
const { captureLead } = require('../services/leadCaptureService');

const router = express.Router();

router.post('/capture', async (req, res) => {
  try {
    const { email, name, source, discountCode } = req.body || {};
    const result = await captureLead({ email, name, source, discountCode });
    res.json(result);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;