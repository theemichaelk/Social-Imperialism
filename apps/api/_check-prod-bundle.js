const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      let d = '';
      r.on('data', (c) => { d += c; });
      r.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

(async () => {
  const base = 'https://www.socialimperialism.com';
  const html = await get(`${base}/dashboard`);
  const paths = [...new Set([...html.matchAll(/\/_next\/static\/[^"'\s]+\.js/g)].map((m) => m[0]))];
  const hits = [];
  for (const p of paths) {
    try {
      const js = await get(base + p);
      if (/OmniBrain|LiveSupport|get-guardian-config|omni-brain-prompt|THEE_MICHAEL/.test(js)) hits.push(p);
    } catch { /* skip */ }
  }
  console.log('JS bundles:', paths.length);
  console.log('Agent UI hits:', hits.length);
  hits.forEach((h) => console.log(' ', h));
  const css = html.match(/\/_next\/static\/css\/[a-f0-9]+\.css/)?.[0];
  console.log('CSS:', css || 'none');
})();