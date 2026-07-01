import { renderSitemapHtml } from '@/lib/publicSiteFeed';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(renderSitemapHtml(), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}