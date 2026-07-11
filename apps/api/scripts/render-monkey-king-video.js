/**
 * Render "The Last Monkey King" — OpenMontage-layout + FFmpeg compose.
 * Usage: node apps/api/scripts/render-monkey-king-video.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const { composeMonkeyKingVideo } = require('../../../packages/core/src/imperialVideoComposer');
const { getOpenMontageStatus } = require('../../../packages/core/src/openMontageBridge');

async function main() {
  const status = getOpenMontageStatus();
  console.log('OpenMontage:', status.connected ? 'cloned' : 'missing', '| FFmpeg:', status.ffmpeg ? 'ok' : 'missing');
  if (!status.ffmpeg) {
    console.error('Install FFmpeg: winget install Gyan.FFmpeg');
    process.exit(1);
  }

  const publicDir = path.join(__dirname, '../../web/public/videos');
  const keys = {
    falKey: process.env.FAL_KEY || process.env.falKey,
    unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY,
  };

  console.log('Rendering The Last Monkey King (60s, 6 scenes)…');
  const result = await composeMonkeyKingVideo({ keys, publicCopyDir: publicDir });
  console.log(JSON.stringify(result, null, 2));
  if (!result.success) process.exit(1);
  console.log('\nDone:', result.outputPath);
  if (result.publicUrl) console.log('Public URL:', result.publicUrl);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});