/**
 * Cloudflare R2 edge storage (S3-compatible API).
 * Account: ba963879a02685a50956ea17870c2f32
 */
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const DEFAULT_ACCOUNT_ID = 'ba963879a02685a50956ea17870c2f32';

function getR2Config() {
  // Local Floci / explicit S3 mode must not silently send traffic to paid R2.
  const provider = String(process.env.STORAGE_PROVIDER || process.env.SI_STORAGE_PROVIDER || 'auto').toLowerCase();
  if (provider === 'floci' || provider === 's3' || provider === 'none') return null;
  if (process.env.FLOCI_ENDPOINT || process.env.AWS_S3_ENDPOINT) {
    // Emulator endpoints win for local free storage unless STORAGE_PROVIDER=r2
    if (provider !== 'r2') return null;
  }

  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID || DEFAULT_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET || process.env.AWS_S3_BUCKET_NAME || 'social-imperialism';
  const prefix = (process.env.CLOUDFLARE_R2_UPLOAD_PREFIX || process.env.AWS_S3_UPLOAD_PREFIX || 'uploads').replace(/^\/|\/$/g, '');
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || process.env.AWS_S3_PUBLIC_BASE_URL;

  if (!accessKeyId || !secretAccessKey) return null;

  return {
    accountId,
    bucket,
    prefix,
    accessKeyId,
    secretAccessKey,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    publicBaseUrl: publicBaseUrl || `https://${bucket}.${accountId}.r2.cloudflarestorage.com`,
  };
}

function createR2Client(config) {
  return new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function getR2Status() {
  const config = getR2Config();
  if (!config) {
    return { configured: false, provider: 'r2', accountId: DEFAULT_ACCOUNT_ID };
  }
  return {
    configured: true,
    provider: 'r2',
    accountId: config.accountId,
    bucket: config.bucket,
    prefix: config.prefix,
    endpoint: 'https://cloudflarestorage.com',
    publicBaseUrl: config.publicBaseUrl,
  };
}

function safeFilename(name) {
  return (name || 'upload.bin').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
}

async function uploadBuffer({ buffer, contentType, filename, folder }) {
  const config = getR2Config();
  if (!config) throw new Error('R2 not configured — set CLOUDFLARE_R2_ACCESS_KEY_ID and CLOUDFLARE_R2_SECRET_ACCESS_KEY');

  const client = createR2Client(config);
  const key = `${config.prefix}/${folder || 'media'}/${Date.now()}-${safeFilename(filename)}`;

  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
  }));

  return { key, url: `${config.publicBaseUrl}/${key}`, bucket: config.bucket, provider: 'r2', contentType };
}

module.exports = { getR2Config, getR2Status, uploadBuffer, createR2Client };