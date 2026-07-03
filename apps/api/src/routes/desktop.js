const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  getDesktopReleaseMeta,
  getDesktopReleasePresignedUrl,
} = require('../desktopRelease');

const router = express.Router();

/** Metadata only — still requires login so release details stay gated. */
router.get('/info', requireAuth, (req, res) => {
  res.json({ ok: true, ...getDesktopReleaseMeta() });
});

/** Short-lived presigned S3 URL for the Windows installer. */
router.get('/download-url', requireAuth, async (req, res) => {
  try {
    const result = await getDesktopReleasePresignedUrl(3600);
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('desktop/download-url:', e.message);
    res.status(500).json({ ok: false, error: e.message || 'Could not generate download link' });
  }
});

/** Direct redirect to presigned installer (for bookmarked download links). */
router.get('/download', requireAuth, async (req, res) => {
  try {
    const result = await getDesktopReleasePresignedUrl(900);
    res.redirect(302, result.url);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'Could not start download' });
  }
});

module.exports = router;