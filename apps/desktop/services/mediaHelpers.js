const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function downloadImageToTemp(imageUrl, prefix = 'si_asset') {
  if (!imageUrl) throw new Error('No image URL provided.');
  if (imageUrl.startsWith('file://')) {
    return imageUrl.replace('file:///', '').replace('file://', '');
  }
  if (fs.existsSync(imageUrl)) return imageUrl;

  const res = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 60000 });
  const ext = imageUrl.includes('.png') ? '.png' : '.jpg';
  const filePath = path.join(os.tmpdir(), `${prefix}_${Date.now()}${ext}`);
  fs.writeFileSync(filePath, Buffer.from(res.data));
  return filePath;
}

async function fetchImageBuffer(imageUrl) {
  if (!imageUrl) throw new Error('No image URL provided.');
  if (fs.existsSync(imageUrl)) {
    return { buffer: fs.readFileSync(imageUrl), mimeType: imageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg' };
  }
  const res = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 60000 });
  const mimeType = res.headers['content-type'] || 'image/jpeg';
  return { buffer: Buffer.from(res.data), mimeType };
}

module.exports = { downloadImageToTemp, fetchImageBuffer };