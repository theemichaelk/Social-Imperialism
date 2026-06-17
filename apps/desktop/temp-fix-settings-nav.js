const fs = require('fs');
let html = fs.readFileSync('settings.html', 'utf8');

// The issue is that switchSettingsView function is missing from the script block.
// I need to add it back into the <script> block.

const switchSettingsViewFunc = `
function switchSettingsView(viewId) {
    const views = ['campaignListView', 'pricingView', 'tutorialView', 'apiKeysView', 'campaignEditView'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if(el) el.classList.add('hidden');
    });
    
    const targetEl = document.getElementById(viewId);
    if(targetEl) targetEl.classList.remove('hidden');

    if(viewId === 'apiKeysView') {
        loadGlobalApiKeys();
    }
    
    if(viewId !== 'campaignEditView') {
        if(document.getElementById('btn-campaigns')) document.getElementById('btn-campaigns').className = 'secondary';
        if(document.getElementById('btn-pricing')) document.getElementById('btn-pricing').className = 'secondary';
        if(document.getElementById('btn-tutorials')) document.getElementById('btn-tutorials').className = 'secondary';
        if(document.getElementById('btn-api-keys')) document.getElementById('btn-api-keys').className = 'secondary';
        
        if(viewId === 'campaignListView' && document.getElementById('btn-campaigns')) document.getElementById('btn-campaigns').className = 'primary';
        if(viewId === 'pricingView' && document.getElementById('btn-pricing')) document.getElementById('btn-pricing').className = 'primary';
        if(viewId === 'tutorialView' && document.getElementById('btn-tutorials')) document.getElementById('btn-tutorials').className = 'primary';
        if(viewId === 'apiKeysView' && document.getElementById('btn-api-keys')) document.getElementById('btn-api-keys').className = 'primary';
    }
    
    // Hide New Campaign button if not in list view
    const newCampBtn = document.getElementById('newCampaignBtn');
    if(newCampBtn) {
        if(viewId === 'campaignListView') newCampBtn.classList.remove('hidden');
        else newCampBtn.classList.add('hidden');
    }
}
`;

// Insert it right after currentCampaigns declaration
if (!html.includes('function switchSettingsView(')) {
    html = html.replace(/let editingCampaignId = null;/, 'let editingCampaignId = null;\n' + switchSettingsViewFunc);
}

// Also fix the bug where navGlobalApiKeys event listener throws error because it doesn't exist
// Remove the broken event listener for navGlobalApiKeys
html = html.replace(/document\.getElementById\('navGlobalApiKeys'\)\.addEventListener\('click'[\s\S]*?renderPlatformFields\('twitter'\);\n\}\);/, '');

fs.writeFileSync('settings.html', html, 'utf8');
console.log('Fixed navigation buttons in Settings page.');