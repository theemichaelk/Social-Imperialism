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
const EXPECTED_MODULES = 29;

if (pageFocusRoutes !== EXPECTED_MODULES) fail(`pageFocus.ts routes: expected ${EXPECTED_MODULES}, got ${pageFocusRoutes}`);

const pageShellPages = countPageShellPages();
if (pageShellPages !== EXPECTED_MODULES) fail(`PageShell pages: expected ${EXPECTED_MODULES}, got ${pageShellPages}`);

const manageableTabs = countManageableTabNavPages();
if (manageableTabs !== 7) fail(`ManageableTabNav pages: expected 7, got ${manageableTabs}`);

const qaPages = countQaPages();
if (qaPages !== EXPECTED_MODULES) fail(`QA PAGES count: expected ${EXPECTED_MODULES}, got ${qaPages}`);

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
if (read(landingShield).includes('SOVEREIGN THREAT CAPTURED //')) {
  fail('s3-website/sovereign-landing-shield.js still uses outdated Sovereign banner — must use THEE_MICHAEL SECURITY REVIEW');
}
if (!read(landingShield).includes('THEE_MICHAEL SECURITY REVIEW')) {
  fail('s3-website/sovereign-landing-shield.js missing THEE_MICHAEL SECURITY REVIEW banner');
}

const indexHtml = path.join(ROOT, 's3-website/index.html');
if (!read(indexHtml).includes('sovereign-landing-shield.js')) {
  fail('s3-website/index.html missing sovereign-landing-shield.js script');
}
if (read(indexHtml).includes('title="Sovereign Threat Capture Layer"')) {
  fail('s3-website/index.html still uses Sovereign user-facing badge title — must be THEE_MICHAEL Security Control');
}
if (read(indexHtml).includes('18</div><div class="lbl">App Modules')) {
  fail(`s3-website/index.html still claims 18 App Modules — should be ${EXPECTED_MODULES}`);
}
if (!read(indexHtml).includes(`<div class="val">${EXPECTED_MODULES}</div><div class="lbl">App Modules`)) {
  fail(`s3-website/index.html App Modules stat must be ${EXPECTED_MODULES}`);
}

const partnerRoutes = path.join(ROOT, 'apps/api/src/routes/partner.js');
if (!read(partnerRoutes).includes('sovereignThreatShield')) {
  fail('partner.js missing sovereignThreatShield on invoke');
}

const auditRule = path.join(ROOT, 'brain/features/AUDIT_ACCURACY_RULE.md');
if (!exists(auditRule)) fail('Missing brain/features/AUDIT_ACCURACY_RULE.md');

const featureIndexes = [
  'SOVEREIGN_THREAT_CAPTURE.md',
  'THEE_MICHAEL_SECURITY.md',
  'IMPERIALISM_BRAIN.md',
  'GUARDIAN_GATEKEEPER.md',
  'PAGE_FOCUS_UX.md',
  'PROMPT_VAULT.md',
  'GROK_ENGINE.md',
  'SITE_BLUEPRINT.md',
  'AETHELGARD_PROTOCOL.md',
  'DESIGN_STUDIO.md',
  'THEE_MICHAEL_SELF_HEAL.md',
  'THEE_MICHAEL_SEO_INTELLIGENCE.md',
  'THEE_MICHAEL_OVERLORD.md',
  'ISSUE_CONTROL_PLANE.md',
  'CAMPAIGN_MASTERY.md',
  'ONBOARDING_INTELLIGENCE.md',
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
  'THEE_MICHAEL_SELF_HEAL.md',
  'THEE_MICHAEL_SEO_INTELLIGENCE.md',
  'THEE_MICHAEL_OVERLORD.md',
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
if (navModuleCount !== EXPECTED_MODULES) {
  fail(`nav.ts module items: expected ${EXPECTED_MODULES}, got ${navModuleCount} — update siteBlueprint + audit rule`);
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

const sovereignCoreTxt = read(sovereignCore);
const requiredSecurityHandlers = [
  'thee-michael-decide-threat',
  'thee-michael-undo-action',
  'get-thee-michael-action-history',
  'admin-clear-sovereign-false-positives',
  'theeMichaelDecideThreat',
];
for (const h of requiredSecurityHandlers) {
  if (!sovereignCoreTxt.includes(h)) fail(`sovereignThreatCapture.js missing ${h}`);
}
const ipcHandlerCount = (sovereignCoreTxt.match(/ipcMain\.handle\('/g) || []).length;
if (ipcHandlerCount !== 11) {
  fail(`sovereignThreatCapture.js IPC handlers: expected 11, got ${ipcHandlerCount}`);
}

const sovereignPanel = path.join(ROOT, 'apps/web/src/components/SovereignThreatPanel.tsx');
if (!read(sovereignPanel).includes('THEE_MICHAEL_BANNER')) {
  fail('SovereignThreatPanel.tsx must use THEE_MICHAEL_BANNER (user-facing brand)');
}
if (!read(sovereignPanel).includes('thee-michael-decide-threat')) {
  fail('SovereignThreatPanel.tsx must wire Accept/Deny via thee-michael-decide-threat');
}

const sovereignLib = path.join(ROOT, 'apps/web/src/lib/sovereignThreatCapture.ts');
if (!read(sovereignLib).includes('THEE_MICHAEL Security Control')) {
  fail('sovereignThreatCapture.ts must document THEE_MICHAEL Security Control');
}

const rootSovereignBrain = path.join(ROOT, 'brain/SOVEREIGN_THREAT_CAPTURE.md');
if (read(rootSovereignBrain).includes('SOVEREIGN THREAT CAPTURED //') && !read(rootSovereignBrain).includes('THEE_MICHAEL SECURITY REVIEW')) {
  fail('brain/SOVEREIGN_THREAT_CAPTURE.md still has outdated Sovereign-only banner — update to THEE_MICHAEL');
}

const packageJson = path.join(ROOT, 'package.json');
if (!read(packageJson).includes('audit:accuracy') || !read(packageJson).includes('test:sovereign-scan')) {
  fail('package.json must include audit:accuracy and test:sovereign-scan scripts');
}

const guardianCore = path.join(ROOT, 'packages/core/src/guardianGatekeeper.js');
if (read(guardianCore).includes('frozen by Sovereign Threat Capture')) {
  fail('guardianGatekeeper.js still has user-facing Sovereign error — must say THEE_MICHAEL Security Control');
}

const promptVaultCore = path.join(ROOT, 'packages/core/src/promptVault.js');
if (read(promptVaultCore).includes("title: 'Sovereign Threat Capture")) {
  fail('promptVault.js seed still uses Sovereign user-facing title — must be THEE_MICHAEL Security Control');
}

const qaSections = path.join(__dirname, '_test-qa-all-sections.js');
if (!read(qaSections).includes('get-thee-michael-action-history')) {
  fail('_test-qa-all-sections.js missing THEE_MICHAEL action history QA test');
}

const pageChannels = path.join(ROOT, 'apps/web/src/lib/pageChannels.ts');
if (!exists(pageChannels)) fail('Missing apps/web/src/lib/pageChannels.ts');
else {
  const pc = read(pageChannels);
  if (!pc.includes('get-imperial-pipeline-config')) fail('pageChannels.ts missing get-imperial-pipeline-config');
  if (!pc.includes('run-imperial-pipeline')) fail('pageChannels.ts missing run-imperial-pipeline');
}

const imperialStudio = path.join(ROOT, 'apps/web/src/components/ImperialContentStudio.tsx');
if (!exists(imperialStudio)) fail('Missing ImperialContentStudio.tsx');
else if (!read(imperialStudio).includes('run-imperial-pipeline')) {
  fail('ImperialContentStudio.tsx must wire run-imperial-pipeline UI');
}

const leadRateLimit = path.join(ROOT, 'apps/api/src/middleware/leadRateLimit.js');
if (!exists(leadRateLimit)) fail('Missing apps/api/src/middleware/leadRateLimit.js');

const aethelgardBrain = path.join(ROOT, 'brain/features/AETHELGARD_PROTOCOL.md');
if (!exists(aethelgardBrain)) fail('Missing brain/features/AETHELGARD_PROTOCOL.md');

const compositorPanel = path.join(ROOT, 'apps/web/src/components/DesignStudioCompositor.tsx');
if (!exists(compositorPanel)) fail('Missing DesignStudioCompositor.tsx');
else if (!read(compositorPanel).includes('compose-social-layout')) {
  fail('DesignStudioCompositor.tsx must wire compose-social-layout');
}

const designCompositorCore = path.join(ROOT, 'packages/core/src/designCompositor.js');
if (!exists(designCompositorCore)) fail('Missing packages/core/src/designCompositor.js');

const EXPECTED_HANDLERS = 405;

// --- Report (async handler count) ---
(async () => {
  let handlerCount = 0;
  try {
    const { registerAllHandlers } = require(path.join(ROOT, 'packages/core/src/handlerRegistry'));
    const store = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    const { handlers } = await registerAllHandlers(store);
    handlerCount = Object.keys(handlers).length;
    if (handlerCount !== EXPECTED_HANDLERS) {
      fail(`IPC handlers: expected ${EXPECTED_HANDLERS}, got ${handlerCount}`);
    }
    if (!handlers['get-imperial-pipeline-config']) fail('handler registry missing get-imperial-pipeline-config');
    if (!handlers['run-imperial-pipeline']) fail('handler registry missing run-imperial-pipeline');
    if (!handlers['get-imperial-pipeline-result']) fail('handler registry missing get-imperial-pipeline-result');
    if (!handlers['get-imperial-video-studio-config']) fail('handler registry missing get-imperial-video-studio-config');
    if (!handlers['run-imperial-video-pipeline']) fail('handler registry missing run-imperial-video-pipeline');
    if (!handlers['get-imperial-video-tool-registry']) fail('handler registry missing get-imperial-video-tool-registry');
    if (!handlers['get-design-compositor-config']) fail('handler registry missing get-design-compositor-config');
    if (!handlers['compose-social-layout']) fail('handler registry missing compose-social-layout');
  } catch (e) {
    fail(`handler registry load failed: ${e.message}`);
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log('AUDIT ACCURACY CHECK — Social Imperialism');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`pageFocus routes:     ${pageFocusRoutes} (expect ${EXPECTED_MODULES})`);
  console.log(`PageShell pages:      ${pageShellPages} (expect ${EXPECTED_MODULES})`);
  console.log(`ManageableTabNav:     ${manageableTabs} (expect 7)`);
  console.log(`QA page routes:       ${qaPages} (expect ${EXPECTED_MODULES})`);
  console.log(`IPC handlers:         ${handlerCount} (expect ${EXPECTED_HANDLERS})`);
  console.log(`ImperialismBrain bar: ${exists(imperialBar) ? 'OK' : 'MISSING'}`);
  console.log(`Imperial pipeline UI: ${exists(imperialStudio) && read(imperialStudio).includes('run-imperial-pipeline') ? 'OK' : 'MISSING'}`);
  console.log(`Sovereign landing:    ${exists(landingShield) ? 'OK' : 'MISSING'}`);
  console.log(`Audit rule doc:       ${exists(auditRule) ? 'OK' : 'MISSING'}`);
  console.log(`Aethelgard brain:     ${exists(aethelgardBrain) ? 'OK' : 'MISSING'}`);
  console.log(`Security IPC handlers: ${ipcHandlerCount} (expect 11)`);
  console.log(`THEE_MICHAEL panel:   ${read(sovereignPanel).includes('THEE_MICHAEL_BANNER') ? 'OK' : 'MISSING'}`);
  console.log('──────────────────────────────────────────────────────────');

  if (FAILURES.length) {
    console.log(`FAILED: ${FAILURES.length} issue(s)`);
    FAILURES.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    process.exit(1);
  }

  console.log('PASSED: All audit accuracy checks OK');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});