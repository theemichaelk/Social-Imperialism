const fs = require('fs');
const path = require('path');
const root = __dirname;
const pages = [
  'dashboard.html', 'onboarding.html', 'content-hub.html', 'engagement.html',
  'history.html', 'keywords.html', 'seo-tools.html', 'reddit-ai-suite.html',
  'quora-traffic-ops.html', 'automations.html', 'rules.html', 'account-hub.html',
  'account-creator.html', 'calendar.html', 'settings.html',
];

function collectHandlers(dir) {
  const handlers = new Set();
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules') continue;
        walk(p);
      } else if (ent.name.endsWith('.js')) {
        const c = fs.readFileSync(p, 'utf8');
        const re = /ipcMain\.handle\(\s*['"]([^'"]+)['"]/g;
        let m;
        while ((m = re.exec(c)) !== null) handlers.add(m[1]);
      }
    }
  }
  walk(dir);
  return handlers;
}

const handlers = collectHandlers(root);
const missing = {};
for (const page of pages) {
  const c = fs.readFileSync(path.join(root, page), 'utf8');
  const re = /ipcRenderer\.invoke\(\s*['"]([^'"]+)['"]/g;
  const ch = new Set();
  let m;
  while ((m = re.exec(c)) !== null) ch.add(m[1]);
  const miss = [...ch].filter((x) => !handlers.has(x));
  if (miss.length) missing[page] = miss;
}
console.log(JSON.stringify(missing, null, 2));
console.log('total handlers', handlers.size);