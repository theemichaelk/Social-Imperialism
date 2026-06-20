const fs = require('fs');
const path = require('path');

const webApp = path.join(__dirname, '../web/src/app');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name === 'page.tsx') out.push(p);
  }
  return out;
}

const pages = walk(webApp);
const perWeb = {};

for (const p of pages) {
  const rel = path.relative(webApp, p).replace(/\\/g, '/').replace('/page.tsx', '');
  const c = fs.readFileSync(p, 'utf8');
  const ch = new Set();
  const patterns = [
    /invoke\s*(?:<[\s\S]*?>)?\s*\(\s*['"]([^'"]+)['"]/g,
    /channel:\s*['"]([^'"]+)['"]/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(c)) !== null) ch.add(m[1]);
  }
  perWeb[rel || 'root'] = {
    channels: [...ch].sort(),
    lines: c.split('\n').length,
    hasInvoke: c.includes('invoke(') || c.includes('invoke<'),
    usesAuthOnly: c.includes('auth.') && !c.includes('invoke'),
    isRedirect: c.includes('redirect('),
  };
}

console.log(JSON.stringify(perWeb, null, 2));