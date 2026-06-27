const { getDefaultConfig } = require('expo/metro-config');
const https = require('https');
const http = require('http');

const config = getDefaultConfig(__dirname);
const API_TARGET = process.env.EXPO_PUBLIC_API_URL || 'https://api.socialimperialism.com';

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url && req.url.startsWith('/api/')) {
        const target = new URL(req.url, API_TARGET);
        const client = target.protocol === 'https:' ? https : http;
        const proxyReq = client.request(
          target,
          {
            method: req.method,
            headers: {
              ...req.headers,
              host: target.host,
            },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
            proxyRes.pipe(res);
          },
        );
        proxyReq.on('error', (err) => {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: `API proxy error: ${err.message}` }));
        });
        req.pipe(proxyReq);
        return;
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;