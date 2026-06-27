/**
 * Audit accuracy verifier — checks Brain claims against codebase.
 * Usage: node apps/api/_audit-accuracy-check.js
 * Exit 0 = all checks pass. Exit 1 = inaccuracies found.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const WEB_APP = path.join(ROOT, 'apps/web/src/app');
const FAILURES = [];

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function exists(p) {
  return fs.existsSync(p);
}

function fail(msg) {
  FAILURES.push(msg);
}

function countGlob(dir, pattern) {
  if (!exists(dir)) return 0;
  const files = [];
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name === pattern) files.push(full);
    }
  }
  walk(dir);
  return files.length;
}

function countPageShellPages() {
  if (!exists(WEB_APP)) return 0;
  let n = 0;
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name === 'page.tsx') {
        const txt = read(full);
        if (txt.includes('PageShell')) n += 1;
      }
    }
  }
  walk(WEB_APP);
  return n;
}

function countManageableTabNavPages() {
  if (!exists(WEB_APP)) return 0;
  let n = 0;
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name === 'page.tsx' && read(full).includes('ManageableTabNav')) n += 1;
    }
  }
  walk(WEB_APP);
  return n;
}

function countPageFocusRoutes() {
  const pf = path.join(ROOT, 'apps/web/src/lib/pageFocus.ts');
  if (!exists(pf)) return 0;
  const m = read(pf).match(/^\s+'\/[^']+':/gm);
  return m ? m.length : 0;
}

function countQaPages() {
  const qa = path.join(__dirname, '_test-qa-all-pages.js');
  if (!exists(qa)) return 0;
  const m = read(qa).match(/route:\s*'/g);
  return m ? m.length : 0;
}

// --- Checks ---
const pageFocusRoutes = countPageFocusRoutes();
if (pageFocusRoutes !== 24) fail(`pageFocus.ts routes: expected 24, got ${pageFocusRoutes}`);

const pageShellPages = countPageShellPages();
if (pageShellPages !== 24) fail(`PageShell pages: expected 24, got ${pageShellPages}`);

const manageableTabs = countManageableTabNavPages();
if (manageableTabs !== 7) fail(`ManageableTabNav pages: expected 7, got ${manageableTabs}`);

const qaPages = countQaPages();
if (qaPages !== 24) fail(`QA PAGES count: expected 24, got ${qaPages}`);

const imperialBar = path.join(ROOT, 'apps/web/src/components/ImperialismBrainPromptBar.tsx');
const legacyBar = path.join(ROOT, 'apps/web/src/components/OmniBrainPromptBar.tsx');
if (!exists(imperialBar)) fail('Missing ImperialismBrainPromptBar.tsx');
if (exists(legacyBar)) fail('Legacy OmniBrainPromptBar.tsx still exists — remove or alias only in ImperialismBrainPromptBar');

const sovereignCore = path.join(ROOT, 'packages/core/src/sovereignThreatCapture.js');
if (!read(sovereignCore).includes('deliverKineticChallenge')) {
  fail('sovereignThreatCapture.js missing deliverKineticChallenge (production kinetic delivery)');
}

const desktopIndex = path.join(ROOT, 'apps/desktop/index.js');
if (!read(desktopIndex).includes('registerSovereignThreatHandlers')) {
  fail('apps/desktop/index.js missing native Sovereign IPC registration');
}

const landingShield = path.join(ROOT, 's3-website/sovereign-landing-shield.js');
if (!exists(landingShield)) fail('Missing s3-website/sovereign-landing-shield.js');

const indexHtml = path.join(ROOT, 's3-website/index.html');
if (!read(indexHtml).includes('sovereign-landing-shield.js')) {
  fail('s3-website/index.html missing sovereign-landing-shield.js script');
}
if (read(indexHtml).includes('18</div><div class="lbl">App Modules')) {
  fail('s3-website/index.html still claims 18 App Modules — should be 24');
}

const partnerRoutes = path.join(ROOT, 'apps/api/src/routes/partner.js');
if (!read(partnerRoutes).includes('sovereignThreatShield')) {
  fail('partner.js missing sovereignThreatShield on invoke');
}

const auditRule = path.join(ROOT, 'brain/features/AUDIT_ACCURACY_RULE.md');
if (!exists(auditRule)) fail('Missing brain/features/AUDIT_ACCURACY_RULE.md');

const featureIndexes = [
  'SOVEREIGN_THREAT_CAPTURE.md',
  'IMPERIALISM_BRAIN.md',
  'GUARDIAN_GATEKEEPER.md',
  'PAGE_FOCUS_UX.md',
  'PROMPT_VAULT.md',
  'GROK_ENGINE.md',
  'SITE_BLUEPRINT.md',
];
for (const f of featureIndexes) {
  const p = path.join(ROOT, 'brain/features', f);
  if (!exists(p)) fail(`Missing brain/features/${f}`);
  else if (!read(p).includes('AUDIT_ACCURACY_RULE.md')) {
    fail(`brain/features/${f} missing audit accuracy rule reference`);
  }
}

const brainAgentDocs = [
  'BRAIN.md',
  'AGENTS.md',
  'FEATURES.md',
  'GROWTH_ENGINE.md',
  'GUARDIAN_GATEKEEPER.md',
  'LIVE_SUPPORT_AGENT.md',
  'OMNI_BRAIN_PLANNER.md',
  'PROMPT_VAULT.md',
  'GROK.md',
  'SOVEREIGN_THREAT_CAPTURE.md',
];
for (const f of brainAgentDocs) {
  const p = path.join(ROOT, 'brain', f);
  if (!exists(p)) fail(`Missing brain/${f}`);
  else if (!read(p).includes('AUDIT_ACCURACY_RULE.md')) {
    fail(`brain/${f} missing audit accuracy rule reference`);
  }
}

const homePage = path.join(ROOT, 'apps/web/src/app/page.tsx');
if (read(homePage).includes('18 modules')) {
  fail('apps/web/src/app/page.tsx still claims 18 modules — should match siteBlueprint');
}
if (!read(homePage).includes('siteBlueprint')) {
  fail('apps/web/src/app/page.tsx must import from siteBlueprint for self-updating public pages');
}

const siteBlueprint = path.join(ROOT, 'apps/web/src/lib/siteBlueprint.ts');
if (!exists(siteBlueprint)) fail('Missing apps/web/src/lib/siteBlueprint.ts');
else if (!read(siteBlueprint).includes('NAV_SECTIONS')) {
  fail('siteBlueprint.ts must derive modules from NAV_SECTIONS');
}

const navTs = path.join(ROOT, 'apps/web/src/lib/nav.ts');
const navModuleCount = (read(navTs).match(/href:\s*'\//g) || []).length;
if (navModuleCount !== 24) {
  fail(`nav.ts module items: expected 24, got ${navModuleCount} — update siteBlueprint + audit rule`);
}

const founderTs = path.join(ROOT, 'apps/web/src/lib/founder.ts');
if (read(founderTs).includes("value: '18'")) {
  fail('founder.ts still hardcodes 18 modules — must use siteBlueprint');
}
if (!read(founderTs).includes('siteBlueprint')) {
  fail('founder.ts must import from siteBlueprint');
}

const homeFooter = path.join(ROOT, 'apps/web/src/components/HomeFooter.tsx');
if (!read(homeFooter).includes('FOOTER_LINKS')) {
  fail('HomeFooter.tsx must use FOOTER_LINKS from siteBlueprint');
}

// --- Report ---
console.log('══════════════════════════════════════════════════════════');
console.log('AUDIT ACCURACY CHECK — Social Imperialism');
console.log('══════════════════════════════════════════════════════════');
console.log(`pageFocus routes:     ${pageFocusRoutes} (expect 24)`);
console.log(`PageShell pages:      ${pageShellPages} (expect 24)`);
console.log(`ManageableTabNav:     ${manageableTabs} (expect 7)`);
console.log(`QA page routes:       ${qaPages} (expect 24)`);
console.log(`ImperialismBrain bar: ${exists(imperialBar) ? 'OK' : 'MISSING'}`);
console.log(`Sovereign landing:    ${exists(landingShield) ? 'OK' : 'MISSING'}`);
console.log(`Audit rule doc:       ${exists(auditRule) ? 'OK' : 'MISSING'}`);
console.log('──────────────────────────────────────────────────────────');

if (FAILURES.length) {
  console.log(`FAILED: ${FAILURES.length} issue(s)`);
  FAILURES.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  process.exit(1);
}

console.log('PASSED: All audit accuracy checks OK');
process.exit(0);