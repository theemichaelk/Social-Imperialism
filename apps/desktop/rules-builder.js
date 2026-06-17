const fs = require('fs');

const template = fs.readFileSync('keywords.html', 'utf8');

let rulesHtml = template.replace('<title>Social Imperialism - Keywords</title>', '<title>Social Imperialism - Auto-Rules</title>');
rulesHtml = rulesHtml.replace('class="nav-link active">Keywords</a>', 'class="nav-link">Keywords</a>');
rulesHtml = rulesHtml.replace('class="nav-link" onclick="openAutoRulesModal(); return false;">Auto-Rules</a>', 'class="nav-link active" href="rules.html">Auto-Rules</a>');
rulesHtml = rulesHtml.replace('<a href="rules.html" class="nav-link">Auto-Rules</a>', '<a href="rules.html" class="nav-link active">Auto-Rules</a>');

const startContent = rulesHtml.indexOf('<div class="container">');
const endContent = rulesHtml.indexOf('<script>');

const newContent = `
  <div class="container">
    <h1><i class="fas fa-cogs"></i> Auto-Rules Engine</h1>
    <p class="subtitle">Configure global automation rules and background worker settings.</p>
    
    <div style="margin-bottom: 1.5rem;">
      <label style="color: #38bdf8; font-weight: bold; margin-bottom: 0.5rem; display: block;">Global Auto-Reply Settings</label>
      <div style="display: flex; align-items: center; gap: 1rem; background: rgba(15,23,42,0.5); padding: 1rem; border-radius: 6px; border: 1px solid #475569;">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="checkbox" id="autoReplyEnabled" checked>
          Enable AI Drafts for New Mentions & Keywords
        </label>
      </div>
    </div>

    <div style="margin-bottom: 1.5rem;">
      <label style="color: #38bdf8; font-weight: bold; margin-bottom: 0.5rem; display: block;">Automation Actions (Where Allowed)</label>
      <div style="display: flex; align-items: center; gap: 1rem; background: rgba(15,23,42,0.5); padding: 1rem; border-radius: 6px; border: 1px solid #475569;">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="checkbox" id="autoLike">
          Auto-Like Positive Matches
        </label>
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="checkbox" id="autoShare">
          Auto-Share / Retweet
        </label>
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="checkbox" id="autoFollow">
          Auto-Follow Author
        </label>
      </div>
    </div>

    <div style="margin-bottom: 1.5rem;">
      <label style="color: #38bdf8; font-weight: bold; margin-bottom: 0.5rem; display: block;">Rule: Negative Sentiment</label>
      <div style="display: flex; align-items: center; gap: 1rem; background: rgba(15,23,42,0.5); padding: 1rem; border-radius: 6px; border: 1px solid #475569;">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="checkbox" id="autoReplyNegative">
          Auto-Draft Apology
        </label>
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-left: 1rem;">
          <input type="checkbox" id="alertNegative" checked>
          Send Alert Via Inbox
        </label>
      </div>
    </div>

    <div style="margin-bottom: 1.5rem;">
      <label style="color: #38bdf8; font-weight: bold; margin-bottom: 0.5rem; display: block;">Cron / Scheduler Settings</label>
      <div style="display: flex; flex-direction: column; gap: 1rem; background: rgba(15,23,42,0.5); padding: 1rem; border-radius: 6px; border: 1px solid #475569;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="color: #cbd5e1; font-size: 0.9rem;">Refresh Frequency:</span>
          <select id="workerFrequency" style="background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 0.4rem; border-radius: 4px;">
            <option value="daily">One-Click Auto Search (Daily)</option>
            <option value="15m">Normal (Every 15 mins)</option>
            <option value="10m">Fast (Every 10 mins)</option>
            <option value="5m">Aggressive (Every 5 mins)</option>
            <option value="realtime">Near Real-Time (Continuous)</option>
          </select>
        </div>
        
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="checkbox" id="beFirstDelay" checked>
          <strong>"Be First" Delay Jitter:</strong> Add random human-like delay (2-45s) to avoid bot detection when replying early.
        </label>
      </div>
    </div>

    <div style="margin-bottom: 1.5rem;">
      <label style="color: #38bdf8; font-weight: bold; margin-bottom: 0.5rem; display: block;">Custom AI Prompt Override (Optional)</label>
      <textarea class="textarea-field" id="customRulePrompt" style="min-height: 60px; width: 100%; box-sizing: border-box; padding: 0.75rem; border-radius: 6px; background: rgba(15,23,42,0.8); border: 1px solid #475569; color: #f8fafc; font-family: inherit; font-size: 0.9rem;" placeholder="E.g., Always include a link to our help center when responding to technical questions..."></textarea>
    </div>

    <div class="footer">
      <button class="secondary" onclick="window.location.href='index.html'">Back</button>
      <button class="primary" onclick="saveAutoRulesPage()">Save Rules Engine</button>
    </div>
  </div>
</div>
`;

rulesHtml = rulesHtml.substring(0, startContent) + newContent + rulesHtml.substring(endContent);

const scriptLogic = `
const { ipcRenderer } = require('electron');

async function initSidebarSwitcher() {
  const select = document.getElementById('sidebarCampaignSwitcher');
  const campaigns = await ipcRenderer.invoke('get-settings');
  const activeCampaign = await ipcRenderer.invoke('get-active-campaign');
  
  if (!campaigns || campaigns.length === 0) {
    select.innerHTML = '<option value="">No Campaigns Setup</option>';
    return;
  }
  
  select.innerHTML = '';
  campaigns.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.innerText = c.brandName;
    if (activeCampaign && c.id === activeCampaign.id) opt.selected = true;
    select.appendChild(opt);
  });
  
  select.addEventListener('change', async (e) => {
    await ipcRenderer.invoke('set-active-campaign', e.target.value);
    window.location.reload();
  });
}

document.addEventListener('DOMContentLoaded', initSidebarSwitcher);

window.saveAutoRulesPage = async function() {
    const settings = {
        autoReplyEnabled: document.getElementById('autoReplyEnabled').checked,
        autoReplyNegative: document.getElementById('autoReplyNegative').checked,
        alertNegative: document.getElementById('alertNegative').checked,
        customRulePrompt: document.getElementById('customRulePrompt').value,
        autoLike: document.getElementById('autoLike').checked,
        autoShare: document.getElementById('autoShare').checked,
        autoFollow: document.getElementById('autoFollow').checked,
        frequency: document.getElementById('workerFrequency').value,
        beFirstDelay: document.getElementById('beFirstDelay').checked
    };
    localStorage.setItem('autoRulesEngine', JSON.stringify(settings));
    
    alert('Auto-Rules Engine configuration saved successfully!');
};

document.addEventListener('DOMContentLoaded', () => {
    const savedRules = localStorage.getItem('autoRulesEngine');
    if(savedRules) {
        try {
            const settings = JSON.parse(savedRules);
            document.getElementById('autoReplyEnabled').checked = settings.autoReplyEnabled;
            document.getElementById('autoReplyNegative').checked = settings.autoReplyNegative;
            document.getElementById('alertNegative').checked = settings.alertNegative;
            document.getElementById('customRulePrompt').value = settings.customRulePrompt || '';
            document.getElementById('autoLike').checked = settings.autoLike || false;
            document.getElementById('autoShare').checked = settings.autoShare || false;
            document.getElementById('autoFollow').checked = settings.autoFollow || false;
            document.getElementById('workerFrequency').value = settings.frequency || '15m';
            document.getElementById('beFirstDelay').checked = typeof settings.beFirstDelay !== 'undefined' ? settings.beFirstDelay : true;
        } catch(e) {}
    }
});
`;

const s1 = rulesHtml.indexOf('<script>');
const s2 = rulesHtml.indexOf('</script>');
rulesHtml = rulesHtml.substring(0, s1 + 8) + '\n' + scriptLogic + '\n' + rulesHtml.substring(s2);

const modalStart = rulesHtml.indexOf('<!-- Auto-Rules Modal -->');
if(modalStart > -1) {
    rulesHtml = rulesHtml.substring(0, modalStart) + '</body>\n</html>';
}

fs.writeFileSync('rules.html', rulesHtml, 'utf8');
console.log('rules.html created successfully!');

// Patch broken nav links in other files
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    let modified = false;
    
    // Some links were accidentally set to call openAutoRulesModal which doesn't exist anymore
    if(content.includes('onclick="openAutoRulesModal(); return false;"')) {
        content = content.replace(/onclick="openAutoRulesModal\(\); return false;"/g, 'href="rules.html"');
        modified = true;
    }
    
    // Replace the missing modal opener in keywords.html footer to just link to rules.html instead
    if(f === 'keywords.html' && content.includes('onclick="openAutoRulesModal()"')) {
        content = content.replace(/onclick="openAutoRulesModal\(\)"/g, 'onclick="window.location.href=\'rules.html\'"');
        modified = true;
    }

    if(modified) {
        fs.writeFileSync(f, content, 'utf8');
        console.log('Patched nav in ' + f);
    }
});