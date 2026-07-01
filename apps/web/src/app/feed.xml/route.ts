import { renderFeedXml } from '@/lib/publicSiteFeed';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(renderFeedXml(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}