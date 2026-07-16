/**
 * Desktop S3-compatible uploads — mirrors apps/api/src/s3.js Floci support.
 */
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  HeadBucketCommand,
} = require('@aws-sdk/client-s3');

function resolveStorageProvider() {
  const explicit = String(process.env.STORAGE_PROVIDER || process.env.SI_STORAGE_PROVIDER || 'auto').toLowerCase();
  if (explicit === 'floci' || explicit === 's3' || explicit === 'r2' || explicit === 'none') return explicit;
  if (process.env.FLOCI_ENDPOINT || process.env.AWS_S3_ENDPOINT) return 'floci';
  if (process.env.AWS_S3_BUCKET_NAME) return 's3';
  return 'none';
}

function getS3Config() {
  const provider = resolveStorageProvider();
  if (provider === 'none' || provider === 'r2') return null;

  const endpoint = (
    process.env.AWS_S3_ENDPOINT
    || process.env.FLOCI_ENDPOINT
    || (provider === 'floci' ? 'http://127.0.0.1:4566' : '')
  ).replace(/\/$/, '');

  const isFloci = provider === 'floci' || /localhost|127\.0\.0\.1|:4566|floci/i.test(endpoint);
  const bucket = process.env.AWS_S3_BUCKET_NAME
    || (isFloci ? (process.env.FLOCI_S3_BUCKET || 'social-imperialism') : '');
  const accessKeyId = process.env.AWS_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || (isFloci ? 'test' : '');
  const secretAccessKey = process.env.AWS_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || (isFloci ? 'test' : '');
  const region = process.env.AWS_S3_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const prefix = (process.env.AWS_S3_UPLOAD_PREFIX || 'social-imperialism/uploads').replace(/^\/|\/$/g, '');

  if (!bucket || !accessKeyId || !secretAccessKey) return null;

  let publicBaseUrl = process.env.AWS_S3_PUBLIC_BASE_URL || process.env.FLOCI_PUBLIC_BASE_URL || '';
  if (!publicBaseUrl) {
    publicBaseUrl = isFloci && endpoint
      ? `${endpoint}/${bucket}`
      : `https://${bucket}.s3.${region}.amazonaws.com`;
  }

  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
    prefix,
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ''),
    endpoint: endpoint || null,
    forcePathStyle: isFloci || process.env.AWS_S3_FORCE_PATH_STYLE === '1',
    provider: isFloci ? 'floci' : 's3',
  };
}

function createClient(config) {
  const opts = {
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  };
  if (config.endpoint) {
    opts.endpoint = config.endpoint;
    opts.forcePathStyle = config.forcePathStyle !== false;
  }
  return new S3Client(opts);
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;
  return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

function safeFilename(name) {
  return (name || 'upload.bin').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
}

async function ensureBucket(config) {
  if (!config || config.provider !== 'floci') return;
  const client = createClient(config);
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch {
    try {
      await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
    } catch (e) {
      if (!/BucketAlready|already exist|owned by you/i.test(e.message || '')) {
        console.warn('[s3Upload] ensureBucket:', e.message);
      }
    }
  }
}

async function uploadDataUrl(dataUrl, filename, folder) {
  const config = getS3Config();
  if (!config) throw new Error('S3 not configured — set STORAGE_PROVIDER=floci or AWS_S3_* in .env');

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error('Invalid data URL');

  await ensureBucket(config);
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
    provider: config.provider,
  };
}

async function listUploads({ prefix, limit = 100 } = {}) {
  const config = getS3Config();
  if (!config) throw new Error('S3 not configured');

  await ensureBucket(config);
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

  return {
    bucket: config.bucket,
    prefix: searchPrefix,
    count: items.length,
    items,
    provider: config.provider,
  };
}

function getS3Status() {
  const config = getS3Config();
  if (!config) return { configured: false, provider: resolveStorageProvider() };
  return {
    configured: true,
    provider: config.provider,
    bucket: config.bucket,
    region: config.region,
    prefix: config.prefix,
    publicBaseUrl: config.publicBaseUrl,
    endpoint: config.endpoint || null,
  };
}

module.exports = { uploadDataUrl, listUploads, getS3Status, getS3Config };
