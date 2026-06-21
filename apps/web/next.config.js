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
          return [
            {
              source: '/api/:path*',
              destination: `${process.env.API_URL || 'http://localhost:4000'}/api/:path*`,
            },
          ];
        },
      }),
};

module.exports = nextConfig;