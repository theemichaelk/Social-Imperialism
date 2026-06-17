const fs = require('fs');

// 1. Update index.js to support returning mocked connected accounts and multi-select flow for Facebook/Google
let indexJs = fs.readFileSync('index.js', 'utf8');

const regexAvail = /ipcMain\.handle\('get-available-accounts', async \(event, credentials\) => \{[\s\S]*?\}\);/m;

const newAvail = `ipcMain.handle('get-available-accounts', async (event, credentials) => {
    // Return multiple accounts for platform like Facebook/Google to show multi-select
    if (credentials.platform === 'Facebook') {
        return [
            { platform: 'Facebook', handle: credentials.username + ' (Profile)', type: 'Profile', id: Date.now() + 1 },
            { platform: 'Facebook', handle: 'My Awesome Page (Page)', type: 'Page', id: Date.now() + 2 },
            { platform: 'Facebook', handle: 'Marketing Group (Group)', type: 'Group', id: Date.now() + 3 }
        ];
    } else if (credentials.platform === 'YouTube') {
        return [
            { platform: 'YouTube', handle: credentials.username + ' (Personal)', type: 'Channel', id: Date.now() + 1 },
            { platform: 'YouTube', handle: 'Brand Channel', type: 'Channel', id: Date.now() + 2 }
        ];
    }
    return [
        { platform: credentials.platform, handle: credentials.username, type: 'Profile', id: Date.now() }
    ];
});

ipcMain.handle('use-selected-accounts', async (event, accounts) => {
    // Add to linked accounts
    let linked = store.getItem('linkedAccounts') || [];
    // Filter out duplicates if needed, append new
    linked = [...linked, ...accounts];
    store.setItem('linkedAccounts', linked);
    return true;
});`;

if (indexJs.match(regexAvail)) {
    indexJs = indexJs.replace(regexAvail, newAvail);
} else {
    indexJs += "\n" + newAvail + "\n";
}

fs.writeFileSync('index.js', indexJs, 'utf8');


// 2. Fix dashboard.html AI Intelligence Profile metrics
let dashboardHtml = fs.readFileSync('dashboard.html', 'utf8');

const regexIntel = /<div id="account-intelligence"[\s\S]*?<!-- UNANSWERED QUESTIONS TRACKER MODULE -->/m;

const newIntel = `<div id="account-intelligence" style="display: none; background: rgba(15, 23, 42, 0.6); border: 1px solid #475569; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
    <h3 style="margin-top: 0; color: #38bdf8; font-size: 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
      ✨ AI Intelligence Profile
    </h3>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
      <div style="background: rgba(30, 41, 59, 0.5); padding: 1rem; border-radius: 8px;">
        <div style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">Followers</div>
        <div id="intel-followers" style="font-size: 1.5rem; font-weight: bold; color: #e2e8f0; margin-top: 0.25rem;">0</div>
        <div id="intel-velocity" style="color: #10b981; font-size: 0.8rem; margin-top: 0.25rem;">+0 this week</div>
      </div>
      <div style="background: rgba(30, 41, 59, 0.5); padding: 1rem; border-radius: 8px;">
        <div style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">Total Engagement</div>
        <div id="intel-likes" style="font-size: 1.5rem; font-weight: bold; color: #e2e8f0; margin-top: 0.25rem;">0</div>
        <div style="color: #64748b; font-size: 0.8rem; margin-top: 0.25rem;">Across all content</div>
      </div>
      <div style="background: rgba(30, 41, 59, 0.5); padding: 1rem; border-radius: 8px;">
        <div style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">Best Time to Post</div>
        <div id="intel-time" style="font-size: 1.1rem; font-weight: bold; color: #38bdf8; margin-top: 0.25rem;">-</div>
        <div style="color: #64748b; font-size: 0.8rem; margin-top: 0.25rem;">Based on audience activity</div>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; height: 200px;">
      <div style="background: rgba(30, 41, 59, 0.5); padding: 1rem; border-radius: 8px; display:flex; align-items:center; justify-content:center;">
        <canvas id="profileGrowthChart" style="max-height: 100%;"></canvas>
      </div>
      <div style="background: rgba(30, 41, 59, 0.5); padding: 1rem; border-radius: 8px; display:flex; align-items:center; justify-content:center;">
        <canvas id="profileDemoChart" style="max-height: 100%;"></canvas>
      </div>
    </div>

    <div style="margin-top: 1rem; display: flex; gap: 1rem;">
      <div style="flex: 1; background: rgba(30, 41, 59, 0.5); padding: 1rem; border-radius: 8px;">
        <div style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 0.5rem;">Trending in Niche</div>
        <div id="intel-niche" style="color: #e2e8f0; font-weight: 500;">-</div>
      </div>
      <div style="flex: 1; background: rgba(30, 41, 59, 0.5); padding: 1rem; border-radius: 8px;">
        <div style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 0.5rem;">Suggested Communities</div>
        <div id="intel-groups" style="color: #e2e8f0; font-size: 0.9rem;">-</div>
      </div>
    </div>
  </div>

  <!-- UNANSWERED QUESTIONS TRACKER MODULE -->`;

if (dashboardHtml.match(regexIntel)) {
    dashboardHtml = dashboardHtml.replace(regexIntel, newIntel);
}

fs.writeFileSync('dashboard.html', dashboardHtml, 'utf8');
console.log("Fixed Index.js and Dashboard intel");