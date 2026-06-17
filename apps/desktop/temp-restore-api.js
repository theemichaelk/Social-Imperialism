const fs = require('fs');
let html = fs.readFileSync('settings.html', 'utf8');

// I removed the API Keys button in my previous update because I replaced the entire sub-nav.
// I need to add it back to the settings sub-navigation.

const subNavRegex = /<div style="display:flex; gap:10px; margin-bottom: 2rem;">([\s\S]*?)<\/div>/;

if (html.match(subNavRegex)) {
    const newSubNav = `<div style="display:flex; gap:10px; margin-bottom: 2rem;">
      <button class="primary" id="btn-campaigns" onclick="switchSettingsView('campaignListView')" style="padding:0.5rem 1rem; font-size:0.85rem;"><i class="fas fa-layer-group"></i> Campaigns</button>
      <button class="secondary" id="btn-api-keys" onclick="switchSettingsView('apiKeysView')" style="padding:0.5rem 1rem; font-size:0.85rem;"><i class="fas fa-key"></i> Global API Integrations</button>
      <button class="secondary" id="btn-pricing" onclick="switchSettingsView('pricingView')" style="padding:0.5rem 1rem; font-size:0.85rem;"><i class="fas fa-credit-card"></i> Pricing Plans & Billing</button>
      <button class="secondary" id="btn-tutorials" onclick="switchSettingsView('tutorialView')" style="padding:0.5rem 1rem; font-size:0.85rem;"><i class="fas fa-graduation-cap"></i> Setup / Tutorials</button>
    </div>`;
    
    html = html.replace(subNavRegex, newSubNav);
}

// I also need to update the switchSettingsView JS to handle the new button state
const jsMatch = /if\\(viewId !== 'apiKeysView' && viewId !== 'campaignEditView'\\) \\{\\s*document\\.getElementById\\('btn-campaigns'\\)\\.className = 'secondary';\\s*document\\.getElementById\\('btn-pricing'\\)\\.className = 'secondary';\\s*document\\.getElementById\\('btn-tutorials'\\)\\.className = 'secondary';/m;

const newJs = `if(viewId !== 'campaignEditView') {
        if(document.getElementById('btn-campaigns')) document.getElementById('btn-campaigns').className = 'secondary';
        if(document.getElementById('btn-pricing')) document.getElementById('btn-pricing').className = 'secondary';
        if(document.getElementById('btn-tutorials')) document.getElementById('btn-tutorials').className = 'secondary';
        if(document.getElementById('btn-api-keys')) document.getElementById('btn-api-keys').className = 'secondary';
        
        if(viewId === 'campaignListView' && document.getElementById('btn-campaigns')) document.getElementById('btn-campaigns').className = 'primary';
        if(viewId === 'pricingView' && document.getElementById('btn-pricing')) document.getElementById('btn-pricing').className = 'primary';
        if(viewId === 'tutorialView' && document.getElementById('btn-tutorials')) document.getElementById('btn-tutorials').className = 'primary';
        if(viewId === 'apiKeysView' && document.getElementById('btn-api-keys')) document.getElementById('btn-api-keys').className = 'primary';`;

html = html.replace(/if\(viewId !== 'apiKeysView' && viewId !== 'campaignEditView'\) \{[\s\S]*?document\.getElementById\('btn-tutorials'\)\.className = 'secondary';/, newJs);

// When loading API keys via switch tab, we need to load them from DB
// We already have a click listener for navGlobalApiKeys, but now it's just a regular tab button.
// We need to trigger the loading inside switchSettingsView

const extraJs = `
    if(viewId === 'apiKeysView') {
        loadGlobalApiKeys();
    }
`;

html = html.replace(/document\.getElementById\(viewId\)\.classList\.remove\('hidden'\);/, "document.getElementById(viewId).classList.remove('hidden');\n    " + extraJs);

const loadApiFunc = `
async function loadGlobalApiKeys() {
  const keys = await ipcRenderer.invoke('get-global-keys');
  if (keys) {
    currentGlobalKeys = keys;
    if(document.getElementById('geminiKey')) document.getElementById('geminiKey').value = keys.gemini || '';
    if(document.getElementById('openaiKey')) document.getElementById('openaiKey').value = keys.openai || '';
    if(document.getElementById('falKey')) document.getElementById('falKey').value = keys.falKey || '';
    if(document.getElementById('domDetailerKey')) document.getElementById('domDetailerKey').value = keys.domDetailer || '';
    if(document.getElementById('pexelsKey')) document.getElementById('pexelsKey').value = keys.pexelsKey || '';
    if(document.getElementById('pixabayKey')) document.getElementById('pixabayKey').value = keys.pixabayKey || '';
    if(document.getElementById('flickrKey')) document.getElementById('flickrKey').value = keys.flickrKey || '';
    if(document.getElementById('flickrSecret')) document.getElementById('flickrSecret').value = keys.flickrSecret || '';
    if(document.getElementById('slackWebhook')) document.getElementById('slackWebhook').value = keys.slackWebhook || '';
    if(document.getElementById('discordWebhook')) document.getElementById('discordWebhook').value = keys.discordWebhook || '';
    if(document.getElementById('alertEmail')) document.getElementById('alertEmail').value = keys.alertEmail || '';
  }
  document.getElementById('apiPlatformSelector').value = 'twitter';
  renderPlatformFields('twitter');
}
`;

html = html.replace(/function showListView\(\) \{/, loadApiFunc + '\nfunction showListView() {');


fs.writeFileSync('settings.html', html, 'utf8');
console.log('Restored Global API Integrations tab to settings.');