import { NextResponse } from 'next/server';
import { getDesktopDownloadInfo } from '@/lib/desktopDownload';

export const dynamic = 'force-dynamic';

export async function GET() {
  const info = getDesktopDownloadInfo();
  return NextResponse.json({
    ok: true,
    version: info.version,
    platform: info.platform,
    url: info.url,
    filename: info.filename,
    sizeHint: info.sizeHint,
  });
}