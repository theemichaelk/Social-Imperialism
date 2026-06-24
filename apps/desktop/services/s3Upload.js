const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');

function getS3Config() {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const accessKeyId = process.env.AWS_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_S3_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const prefix = (process.env.AWS_S3_UPLOAD_PREFIX || 'social-imperialism/uploads').replace(/^\/|\/$/g, '');
  const publicBaseUrl = process.env.AWS_S3_PUBLIC_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`;

  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return { bucket, accessKeyId, secretAccessKey, region, prefix, publicBaseUrl };
}

function createClient(config) {
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;
  return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

function safeFilename(name) {
  return (name || 'upload.bin').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
}

async function uploadDataUrl(dataUrl, filename, folder) {
  const config = getS3Config();
  if (!config) throw new Error('S3 not configured — set AWS_S3_* in .env');

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error('Invalid data URL');

  const client = createClient(config);
  const key = `${config.prefix}/${folder || 'media'}/${Date.now()}-${safeFilename(filename)}`;

  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: parsed.buffer,
    ContentType: parsed.contentType,
  }));

  return {
    success: true,
    key,
    url: `${config.publicBaseUrl}/${key}`,
    bucket: config.bucket,
    contentType: parsed.contentType,
  };
}

async function listUploads({ prefix, limit = 100 } = {}) {
  const config = getS3Config();
  if (!config) throw new Error('S3 not configured');

  const client = createClient(config);
  const searchPrefix = prefix
    ? `${config.prefix}/${String(prefix).replace(/^\/|\/$/g, '')}`
    : `${config.prefix}/`;

  const res = await client.send(new ListObjectsV2Command({
    Bucket: config.bucket,
    Prefix: searchPrefix,
    MaxKeys: Math.min(limit, 1000),
  }));

  const items = (res.Contents || [])
    .filter((o) => o.Key && !o.Key.endsWith('/'))
    .map((o) => ({
      key: o.Key,
      size: o.Size,
      lastModified: o.LastModified?.toISOString?.() || o.LastModified,
      url: `${config.publicBaseUrl}/${o.Key}`,
    }))
    .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

  return { bucket: config.bucket, prefix: searchPrefix, count: items.length, items };
}

function getS3Status() {
  const config = getS3Config();
  if (!config) return { configured: false };
  return {
    configured: true,
    bucket: config.bucket,
    region: config.region,
    prefix: config.prefix,
    publicBaseUrl: config.publicBaseUrl,
  };
}

module.exports = { uploadDataUrl, listUploads, getS3Status };