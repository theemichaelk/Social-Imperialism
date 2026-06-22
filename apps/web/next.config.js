/** @type {import('next').NextConfig} */
const isStaticExport = process.env.STATIC_EXPORT === '1';

const nextConfig = {
  reactStrictMode: true,
  ...(isStaticExport
    ? {
        output: 'export',
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        async rewrites() {
          const apiOrigin = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
          return [
            {
              source: '/api/:path*',
              destination: `${apiOrigin}/api/:path*`,
            },
            {
              source: '/health',
              destination: `${apiOrigin}/health`,
            },
            {
              source: '/oauth/callback',
              destination: `${apiOrigin}/api/oauth/callback`,
            },
          ];
        },
      }),
};

module.exports = nextConfig;