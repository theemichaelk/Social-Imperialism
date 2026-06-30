const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const desktop = __dirname;

function collectHandlers(dir) {
  const handlers = new Set();
  function scanFile(fp) {
    if (!fs.existsSync(fp)) return;
    const c = fs.readFileSync(fp, 'utf8');
    const re = /ipcMain\.handle\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(c)) !== null) handlers.add(m[1]);
  }
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules') continue;
        walk(p);
      } else if (ent.name.endsWith('.js')) {
        scanFile(p);
      }
    }
  }
  walk(dir);
  [
    path.join(dir, 'registerParityHandlers.js'),
    path.join(root, 'packages/core/src/campaignManager.js'),
    path.join(root, 'packages/core/src/issueControlPlane.js'),
    path.join(root, 'packages/core/src/webAugmentedRepair.js'),
  ].forEach(scanFile);
  return handlers;
}

function collectPageChannels(page) {
  const c = fs.readFileSync(path.join(desktop, page), 'utf8');
  const ch = new Set();
  const re = /ipcRenderer\.invoke\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(c)) !== null) ch.add(m[1]);
  return [...ch].sort();
}

const allHandlers = collectHandlers(desktop);
const indexOnly = new Set();
const indexC = fs.readFileSync(path.join(desktop, 'index.js'), 'utf8');
const indexRe = /ipcMain\.handle\(\s*['"]([^'"]+)['"]/g;
let m;
while ((m = indexRe.exec(indexC)) !== null) indexOnly.add(m[1]);

const htmlFiles = fs.readdirSync(desktop)
  .filter((f) => f.endsWith('.html') && f !== 'extracted.html')
  .sort();

const perPage = {};
for (const page of htmlFiles) {
  perPage[page] = collectPageChannels(page);
}

const { registerAllHandlers } = require(path.join(root, 'packages/core/src/handlerRegistry'));
const mockStore = {
  data: {},
  getItem(k) { return this.data[k] ?? null; },
  setItem(k, v) { this.data[k] = v; },
  removeItem(k) { delete this.data[k]; },
  flush: async () => {},
};

(async () => {
  const { handlers } = await registerAllHandlers(mockStore, {});
  const saasChannels = new Set(Object.keys(handlers));
  const indexMissingInSaas = [...indexOnly].filter((c) => !saasChannels.has(c)).sort();
  const allDesktopMissingInSaas = [...allHandlers].filter((c) => !saasChannels.has(c)).sort();

  const report = {
    perPage,
    counts: {
      desktopTotalHandlers: allHandlers.size,
      indexJsHandlers: indexOnly.size,
      saasHandlers: saasChannels.size,
    },
    indexJsMissingInSaas: indexMissingInSaas,
    allDesktopMissingInSaas,
    perPageMissingFromDesktop: {},
    perPageMissingFromSaas: {},
  };

  for (const [page, ch] of Object.entries(perPage)) {
    const missDesktop = ch.filter((x) => !allHandlers.has(x));
    const missSaas = ch.filter((x) => !saasChannels.has(x));
    if (missDesktop.length) report.perPageMissingFromDesktop[page] = missDesktop;
    if (missSaas.length) report.perPageMissingFromSaas[page] = missSaas;
  }

  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});