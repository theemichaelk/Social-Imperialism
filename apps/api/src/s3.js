const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

function getS3Config() {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const accessKeyId = process.env.AWS_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_S3_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const prefix = (process.env.AWS_S3_UPLOAD_PREFIX || 'social-imperialism/uploads').replace(/^\/|\/$/g, '');
  const publicBaseUrl = process.env.AWS_S3_PUBLIC_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`;

  if (!bucket) return null;

  if (accessKeyId && secretAccessKey) {
    return { bucket, accessKeyId, secretAccessKey, region, prefix, publicBaseUrl, useIam: false };
  }

  // App Runner / EC2 instance role (IAM default credential chain)
  return { bucket, region, prefix, publicBaseUrl, useIam: true };
}

function createClient(config) {
  if (config.useIam) {
    return new S3Client({ region: config.region });
  }
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
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function safeFilename(name) {
  return (name || 'upload.bin')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 180);
}

async function uploadBuffer({ buffer, contentType, filename, folder }) {
  try {
    const r2 = require('./r2');
    if (r2.getR2Config()) {
      return r2.uploadBuffer({ buffer, contentType, filename, folder });
    }
  } catch (e) { /* fall through to S3 */ }

  const config = getS3Config();
  if (!config) throw new Error('S3 not configured — set AWS_S3_* in apps/api/.env');

  const client = createClient(config);
  const stamp = Date.now();
  const key = `${config.prefix}/${folder || 'media'}/${stamp}-${safeFilename(filename)}`;

  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
  }));

  const url = `${config.publicBaseUrl}/${key}`;
  return { key, url, bucket: config.bucket, contentType };
}

async function uploadDataUrl(dataUrl, filename, folder) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error('Invalid data URL');
  return uploadBuffer({
    buffer: parsed.buffer,
    contentType: parsed.contentType,
    filename,
    folder,
  });
}

async function listUploads({ prefix, limit = 100 } = {}) {
  const config = getS3Config();
  if (!config) throw new Error('S3 not configured — set AWS_S3_* in apps/api/.env');

  const client = createClient(config);
  const searchPrefix = prefix
    ? `${config.prefix}/${prefix.replace(/^\/|\/$/g, '')}`
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

  return {
    bucket: config.bucket,
    prefix: searchPrefix,
    count: items.length,
    items,
  };
}

function getS3Status() {
  const config = getS3Config();
  if (!config) {
    return { configured: false, message: 'Missing AWS_S3_BUCKET_NAME or credentials' };
  }
  return {
    configured: true,
    bucket: config.bucket,
    region: config.region,
    prefix: config.prefix,
    publicBaseUrl: config.publicBaseUrl,
  };
}

async function getPresignedDownloadUrl(key, { expiresIn = 3600, filename } = {}) {
  const config = getS3Config();
  if (!config) throw new Error('S3 not configured — set AWS_S3_* in apps/api/.env');

  const client = createClient(config);
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ...(filename ? {
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
    } : {}),
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return { url, bucket: config.bucket, key, expiresIn };
}

module.exports = {
  getS3Config,
  getS3Status,
  createClient,
  uploadDataUrl,
  uploadBuffer,
  listUploads,
  getPresignedDownloadUrl,
};