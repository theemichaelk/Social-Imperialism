const { getPresignedDownloadUrl } = require('./s3');

const DEFAULT_VERSION = '1.2.26';

function getDesktopVersion() {
  return process.env.DESKTOP_APP_VERSION
    || process.env.NEXT_PUBLIC_DESKTOP_APP_VERSION
    || DEFAULT_VERSION;
}

function getReleaseFilename(version = getDesktopVersion()) {
  return `Social Imperialism Setup ${version}.exe`;
}

function getReleaseS3Key(version = getDesktopVersion()) {
  if (process.env.DESKTOP_RELEASE_S3_KEY) {
    return process.env.DESKTOP_RELEASE_S3_KEY.trim();
  }
  return `releases/${getReleaseFilename(version)}`;
}

function getDesktopReleaseMeta() {
  const version = getDesktopVersion();
  const filename = getReleaseFilename(version);
  return {
    version,
    filename,
    platform: 'windows',
    sizeHint: process.env.DESKTOP_INSTALLER_SIZE_HINT || '~180 MB',
    requiresAuth: true,
  };
}

async function getDesktopReleasePresignedUrl(expiresIn = 3600) {
  const meta = getDesktopReleaseMeta();
  const key = getReleaseS3Key(meta.version);
  const signed = await getPresignedDownloadUrl(key, {
    expiresIn,
    filename: meta.filename,
  });
  return {
    ...meta,
    url: signed.url,
    expiresIn: signed.expiresIn,
    key: signed.key,
  };
}

module.exports = {
  getDesktopVersion,
  getReleaseFilename,
  getReleaseS3Key,
  getDesktopReleaseMeta,
  getDesktopReleasePresignedUrl,
};