import { renderSitemapXml } from '@/lib/publicSiteFeed';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(renderSitemapXml(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}