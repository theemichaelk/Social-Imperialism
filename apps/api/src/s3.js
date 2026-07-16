/**
 * S3-compatible object storage.
 *
 * Modes (STORAGE_PROVIDER or auto-detect):
 *   floci  — local Floci AWS emulator (http://localhost:4566) — zero AWS $ for dev
 *   s3     — real AWS S3
 *   r2     — Cloudflare R2 (preferred in production when R2 keys set)
 *   auto   — floci if FLOCI_ENDPOINT/AWS_S3_ENDPOINT set; else r2 if keys; else s3
 */
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

function resolveStorageProvider() {
  const explicit = String(process.env.STORAGE_PROVIDER || process.env.SI_STORAGE_PROVIDER || 'auto').toLowerCase();
  if (explicit === 'floci' || explicit === 's3' || explicit === 'r2' || explicit === 'none') return explicit;
  // auto
  if (process.env.FLOCI_ENDPOINT || process.env.AWS_S3_ENDPOINT) return 'floci';
  if (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID && process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) return 'r2';
  if (process.env.AWS_S3_BUCKET_NAME) return 's3';
  return 'none';
}

function isLocalEmulatorEndpoint(endpoint) {
  if (!endpoint) return false;
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|:4566|floci/i.test(endpoint);
}

function getS3Config() {
  const provider = resolveStorageProvider();
  if (provider === 'none' || provider === 'r2') return null;

  const endpoint = (
    process.env.AWS_S3_ENDPOINT
    || process.env.FLOCI_ENDPOINT
    || (provider === 'floci' ? 'http://127.0.0.1:4566' : '')
  ).replace(/\/$/, '');

  const isFloci = provider === 'floci' || isLocalEmulatorEndpoint(endpoint);
  const bucket = process.env.AWS_S3_BUCKET_NAME
    || (isFloci ? (process.env.FLOCI_S3_BUCKET || 'social-imperialism') : '');
  const accessKeyId = process.env.AWS_S3_ACCESS_KEY_ID
    || process.env.AWS_ACCESS_KEY_ID
    || (isFloci ? 'test' : '');
  const secretAccessKey = process.env.AWS_S3_SECRET_ACCESS_KEY
    || process.env.AWS_SECRET_ACCESS_KEY
    || (isFloci ? 'test' : '');
  const region = process.env.AWS_S3_REGION || process.env.AWS_DEFAULT_REGION || process.env.FLOCI_DEFAULT_REGION || 'us-east-1';
  const prefix = (process.env.AWS_S3_UPLOAD_PREFIX || process.env.FLOCI_S3_PREFIX || 'social-imperialism/uploads')
    .replace(/^\/|\/$/g, '');

  if (!bucket) return null;

  let publicBaseUrl = process.env.AWS_S3_PUBLIC_BASE_URL || process.env.FLOCI_PUBLIC_BASE_URL || '';
  if (!publicBaseUrl) {
    if (isFloci && endpoint) {
      // Path-style public URLs against the emulator
      publicBaseUrl = `${endpoint}/${bucket}`;
    } else {
      publicBaseUrl = `https://${bucket}.s3.${region}.amazonaws.com`;
    }
  }

  const forcePathStyle = process.env.AWS_S3_FORCE_PATH_STYLE === '1'
    || process.env.AWS_S3_FORCE_PATH_STYLE === 'true'
    || isFloci;

  if (accessKeyId && secretAccessKey) {
    return {
      bucket,
      accessKeyId,
      secretAccessKey,
      region,
      prefix,
      publicBaseUrl: publicBaseUrl.replace(/\/$/, ''),
      endpoint: endpoint || null,
      forcePathStyle,
      useIam: false,
      provider: isFloci ? 'floci' : 's3',
    };
  }

  // App Runner / EC2 instance role (real AWS only)
  if (!isFloci) {
    return {
      bucket,
      region,
      prefix,
      publicBaseUrl: publicBaseUrl.replace(/\/$/, ''),
      endpoint: null,
      forcePathStyle: false,
      useIam: true,
      provider: 's3',
    };
  }

  return null;
}

function createClient(config) {
  const opts = {
    region: config.region,
  };
  if (config.endpoint) {
    opts.endpoint = config.endpoint;
    opts.forcePathStyle = config.forcePathStyle !== false;
  }
  if (!config.useIam) {
    opts.credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };
  }
  return new S3Client(opts);
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

function shouldPreferR2() {
  const provider = resolveStorageProvider();
  if (provider === 'floci' || provider === 's3') return false;
  if (provider === 'r2') return true;
  // auto: only when R2 keys exist and no floci endpoint
  return !!(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID && process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY)
    && !process.env.FLOCI_ENDPOINT
    && !process.env.AWS_S3_ENDPOINT;
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
      // BucketAlreadyOwnedByYou / AlreadyExists
      if (!/BucketAlready|already exist|owned by you/i.test(e.message || '')) {
        console.warn('[s3] ensureBucket:', e.message);
      }
    }
  }
}

async function uploadBuffer({ buffer, contentType, filename, folder }) {
  if (shouldPreferR2()) {
    try {
      const r2 = require('./r2');
      if (r2.getR2Config()) {
        return r2.uploadBuffer({ buffer, contentType, filename, folder });
      }
    } catch (e) { /* fall through to S3/floci */ }
  }

  const config = getS3Config();
  if (!config) throw new Error('S3 not configured — set STORAGE_PROVIDER=floci (local) or AWS_S3_* / R2 keys');

  await ensureBucket(config);
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
  return { key, url, bucket: config.bucket, contentType, provider: config.provider };
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
  if (!config) throw new Error('S3 not configured — set STORAGE_PROVIDER=floci or AWS_S3_*');

  await ensureBucket(config);
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
    provider: config.provider,
  };
}

function getS3Status() {
  const provider = resolveStorageProvider();
  const config = getS3Config();
  if (!config) {
    return {
      configured: false,
      provider: provider === 'r2' ? 'r2-preferred' : provider,
      message: provider === 'r2'
        ? 'Using Cloudflare R2 (see r2 status)'
        : 'Missing AWS_S3_BUCKET_NAME / Floci — set STORAGE_PROVIDER=floci for local free storage',
    };
  }
  return {
    configured: true,
    provider: config.provider,
    bucket: config.bucket,
    region: config.region,
    prefix: config.prefix,
    publicBaseUrl: config.publicBaseUrl,
    endpoint: config.endpoint || null,
    forcePathStyle: !!config.forcePathStyle,
  };
}

async function getPresignedDownloadUrl(key, { expiresIn = 3600, filename } = {}) {
  const config = getS3Config();
  if (!config) throw new Error('S3 not configured — set STORAGE_PROVIDER=floci or AWS_S3_*');

  const client = createClient(config);
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ...(filename ? {
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
    } : {}),
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return { url, bucket: config.bucket, key, expiresIn, provider: config.provider };
}

module.exports = {
  getS3Config,
  getS3Status,
  createClient,
  uploadDataUrl,
  uploadBuffer,
  listUploads,
  getPresignedDownloadUrl,
  resolveStorageProvider,
  ensureBucket,
};
