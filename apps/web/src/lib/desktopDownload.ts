/** Desktop app download metadata — installer served via authenticated presigned S3 URL. */

import { apiFetch } from '@/lib/api';

export const DESKTOP_APP_VERSION = '1.2.26';

export type DesktopDownloadMeta = {
  version: string;
  filename: string;
  platform: 'windows';
  sizeHint?: string;
  requiresAuth: true;
};

export type DesktopDownloadUrl = DesktopDownloadMeta & {
  url: string;
  expiresIn: number;
};

export function getDesktopDownloadMeta(): DesktopDownloadMeta {
  const version = process.env.NEXT_PUBLIC_DESKTOP_APP_VERSION || DESKTOP_APP_VERSION;
  return {
    version,
    filename: `Social Imperialism Setup ${version}.exe`,
    platform: 'windows',
    sizeHint: '~180 MB',
    requiresAuth: true,
  };
}

export async function fetchDesktopDownloadInfo(): Promise<DesktopDownloadMeta> {
  try {
    const res = await apiFetch('/api/desktop/info') as DesktopDownloadMeta & { ok?: boolean };
    if (res?.version) {
      return {
        version: res.version,
        filename: res.filename || `Social Imperialism Setup ${res.version}.exe`,
        platform: 'windows',
        sizeHint: res.sizeHint || '~180 MB',
        requiresAuth: true,
      };
    }
  } catch { /* fall through */ }
  return getDesktopDownloadMeta();
}

export async function fetchDesktopDownloadUrl(): Promise<DesktopDownloadUrl> {
  const res = await apiFetch('/api/desktop/download-url') as DesktopDownloadUrl & { ok?: boolean; error?: string };
  if (!res?.ok || !res?.url) {
    throw new Error(res?.error || 'Download link unavailable — sign in and try again');
  }
  return res;
}