#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');
const oauth = require('../services/oauth');

const keys = { ytId: process.env.GOOGLE_CLIENT_ID, ytSecret: process.env.GOOGLE_CLIENT_SECRET };
const pkce = oauth.generatePkce();
const state = oauth.generateState('YouTube');
const url = oauth.buildAuthUrl('YouTube', keys, state, pkce, oauth.GOOGLE_LOOPBACK_REDIRECT_URI, {
  loginHint: 'theesaintmichael@gmail.com',
});

(async () => {
  console.log('Redirect URI:', oauth.GOOGLE_LOOPBACK_REDIRECT_URI);
  console.log('Client ID:', keys.ytId);
  const r = await axios.get(url, { maxRedirects: 0, validateStatus: () => true, timeout: 20000 });
  console.log('HTTP status:', r.status);
  if (r.headers.location) console.log('Redirect:', r.headers.location.slice(0, 300));
  const body = String(r.data || '');
  if (body.includes('invalid_request')) console.log('ERROR: invalid_request in response');
  if (body.includes('redirect_uri_mismatch')) console.log('ERROR: redirect_uri_mismatch');
  const title = body.match(/<title>([^<]+)/i);
  if (title) console.log('Page title:', title[1]);
})();