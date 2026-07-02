/** Desktop app download metadata — installer hosted on S3 or overridden via env. */

export const DESKTOP_APP_VERSION = '1.2.26';

export type DesktopDownloadInfo = {
  version: string;
  url: string;
  filename: string;
  platform: 'windows';
  sizeHint?: string;
};

export function getDesktopDownloadInfo(): DesktopDownloadInfo {
  const version = process.env.NEXT_PUBLIC_DESKTOP_APP_VERSION || DESKTOP_APP_VERSION;
  const encoded = encodeURIComponent(`Social Imperialism Setup ${version}.exe`);
  const defaultUrl = `https://social-imperialism.s3.us-east-1.amazonaws.com/releases/${encoded}`;
  const url = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL || defaultUrl;
  return {
    version,
    url,
    filename: `Social Imperialism Setup ${version}.exe`,
    platform: 'windows',
    sizeHint: '~180 MB',
  };
}