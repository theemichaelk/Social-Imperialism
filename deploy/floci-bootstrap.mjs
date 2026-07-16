/**
 * Create SI bucket + smoke put/list against local Floci (or any S3 endpoint).
 * Usage: node deploy/floci-bootstrap.mjs
 */
const {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');

const endpoint = (process.env.AWS_S3_ENDPOINT || process.env.FLOCI_ENDPOINT || 'http://127.0.0.1:4566').replace(/\/$/, '');
const bucket = process.env.AWS_S3_BUCKET_NAME || process.env.FLOCI_S3_BUCKET || 'social-imperialism';
const region = process.env.AWS_S3_REGION || 'us-east-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_S3_ACCESS_KEY_ID || 'test';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_S3_SECRET_ACCESS_KEY || 'test';
const prefix = (process.env.AWS_S3_UPLOAD_PREFIX || 'social-imperialism/uploads').replace(/^\/|\/$/g, '');

const client = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
});

async function main() {
  console.log(`[floci-bootstrap] endpoint=${endpoint} bucket=${bucket}`);

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`[floci-bootstrap] bucket exists: ${bucket}`);
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`[floci-bootstrap] created bucket: ${bucket}`);
  }

  const key = `${prefix}/_bootstrap/${Date.now()}-ok.txt`;
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: Buffer.from(`SI Floci bootstrap ${new Date().toISOString()}\n`),
    ContentType: 'text/plain',
  }));
  console.log(`[floci-bootstrap] put ${key}`);

  const list = await client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: `${prefix}/_bootstrap/`,
    MaxKeys: 5,
  }));
  console.log(`[floci-bootstrap] list count=${(list.Contents || []).length}`);
  console.log('[floci-bootstrap] OK — local S3 path ready (no AWS charges)');
}

main().catch((e) => {
  console.error('[floci-bootstrap] FAIL:', e.message);
  console.error('Is Floci running?  npm run floci:up   or  docker compose -f deploy/docker-compose.floci.yml up -d');
  process.exit(1);
});
