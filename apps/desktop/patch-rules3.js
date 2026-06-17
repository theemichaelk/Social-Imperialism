const fs = require('fs');
let html = fs.readFileSync('rules.html', 'utf8');

const accountSelectorHtml = `
    <div style="margin-bottom: 1.5rem;">
      <label style="color: #38bdf8; font-weight: bold; margin-bottom: 0.5rem; display: block;">Campaign Automation Accounts</label>
      <div style="background: rgba(15,23,42,0.5); padding: 1rem; border-radius: 6px; border: 1px solid #475569;">
        <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:0.5rem; margin-top:0;">Select which linked accounts should be actively automated by these rules for this campaign:</p>
        <div id="automationAccountsList" style="display:flex; flex-direction:column; gap:0.5rem; max-height:150px; overflow-y:auto; padding:0.5rem; background:rgba(2,6,23,0.5); border:1px solid #334155; border-radius:4px;">
            <p style="color:#64748b; font-style:italic; margin:0;">Loading accounts...</p>
        </div>
      </div>
    </div>
`;

if (!html.includes('Campaign Automation Accounts')) {
    html = html.replace('<div style="margin-bottom: 1.5rem;">\n      <label style="color: #38bdf8; font-weight: bold; margin-bottom: 0.5rem; display: block;">Global Auto-Reply Settings</label>', accountSelectorHtml + '\n    <div style="margin-bottom: 1.5rem;">\n      <label style="color: #38bdf8; font-weight: bold; margin-bottom: 0.5rem; display: block;">Global Auto-Reply Settings</label>');
}

const jsLogic = `
async function loadAutomationAccounts() {
    const accounts = await ipcRenderer.invoke('get-linked-accounts');
    const container = document.getElementById('automationAccountsList');
    container.innerHTML = '';
    
    if (accounts.length === 0) {
        container.innerHTML = '<p style="color:#64748b; font-style:italic; margin:0;">No accounts linked yet. Go to Account Hub.</p>';
        return;
    }
    
    const savedRules = localStorage.getItem('autoRulesEngine');
    let activeIds = [];
    if(savedRules) {
        try {
            const settings = JSON.parse(savedRules);
            if(settings.activeAccountIds) activeIds = settings.activeAccountIds;
        } catch(e){}
    }
    
    accounts.forEach(acc => {
        const isChecked = activeIds.includes(acc.id) ? 'checked' : '';
        const div = document.createElement('label');
        div.style.cssText = "display:flex; align-items:center; gap:0.5rem; cursor:pointer; color:#cbd5e1; font-size:0.95rem;";
        div.innerHTML = \`<input type="checkbox" class="automation-account-cb" value="\${acc.id}" \${isChecked}> \${acc.platform} - \${acc.handle}\`;
        container.appendChild(div);
    });
}
document.addEventListener('DOMContentLoaded', loadAutomationAccounts);

// Load saved rules
`;

if (!html.includes('loadAutomationAccounts')) {
    html = html.replace('document.addEventListener(\'DOMContentLoaded\', () => {', jsLogic + '\ndocument.addEventListener(\'DOMContentLoaded\', () => {');
    
    // Patch the save function
    const oldSave = `        beFirstDelay: document.getElementById('beFirstDelay').checked\n    };`;
    const newSave = `        beFirstDelay: document.getElementById('beFirstDelay').checked,\n        activeAccountIds: Array.from(document.querySelectorAll('.automation-account-cb:checked')).map(cb => cb.value)\n    };`;
    html = html.replace(oldSave, newSave);
    
    fs.writeFileSync('rules.html', html, 'utf8');
    console.log('Patched rules.html to add account selector');
} else {
    console.log('Account selector already in rules.html');
}