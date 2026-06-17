const fs = require('fs');
let html = fs.readFileSync('keywords.html', 'utf8');

// The rules modal currently has: Global Auto-Reply, Negative Sentiment, Custom Prompt.
// We need to add: Frequency (Daily, 5-10m, Realtime)
// We need to add: Be First Jitter (boolean)
// We need to add: Auto-Like / Auto-Share options.

const modalSearch = `        <div style="margin-bottom: 1.5rem;">
          <label style="color: #38bdf8; font-weight: bold; margin-bottom: 0.5rem; display: block;">Rule: Negative Sentiment</label>`;

const modalReplace = `
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

` + modalSearch;

html = html.split(modalSearch).join(modalReplace);

// Update saveAutoRules
const saveSearch = `        customRulePrompt: document.getElementById('customRulePrompt').value
    };`;
const saveReplace = `        customRulePrompt: document.getElementById('customRulePrompt').value,
        autoLike: document.getElementById('autoLike').checked,
        autoShare: document.getElementById('autoShare').checked,
        autoFollow: document.getElementById('autoFollow').checked,
        frequency: document.getElementById('workerFrequency').value,
        beFirstDelay: document.getElementById('beFirstDelay').checked
    };`;
html = html.split(saveSearch).join(saveReplace);

// Update loading rules
const loadSearch = `        document.getElementById('customRulePrompt').value = settings.customRulePrompt;
    } catch(e) {}`;
const loadReplace = `        document.getElementById('customRulePrompt').value = settings.customRulePrompt || '';
        document.getElementById('autoLike').checked = settings.autoLike || false;
        document.getElementById('autoShare').checked = settings.autoShare || false;
        document.getElementById('autoFollow').checked = settings.autoFollow || false;
        document.getElementById('workerFrequency').value = settings.frequency || '15m';
        document.getElementById('beFirstDelay').checked = typeof settings.beFirstDelay !== 'undefined' ? settings.beFirstDelay : true;
    } catch(e) {}`;
html = html.split(loadSearch).join(loadReplace);

// Also need to add the link/button to open it from keywords.html if it's missing, but it seems there's an 'Auto-Rules' tab in the sidebar which goes to rules.html? Wait, keywords.html has rules modal built in, but the nav links to rules.html.
// Let's actually add a button in keywords.html footer to open the modal easily just in case.
const btnSearch = `<button class="primary" id="continueBtn">Initialize Feed</button>`;
const btnReplace = `<button class="secondary" onclick="openAutoRulesModal()" style="border-color:#10b981; color:#10b981; margin-right:auto;"><i class="fas fa-cogs"></i> Auto-Rules Setup</button>
      ` + btnSearch;
html = html.split(btnSearch).join(btnReplace);

// Oh wait, at the top we saw 'Auto-Rules' links to rules.html. 
// `<a href="rules.html" class="nav-link">Auto-Rules</a>`
// I should make it open the modal instead.
const navSearch = `<a href="rules.html" class="nav-link">Auto-Rules</a>`;
const navReplace = `<a href="#" onclick="openAutoRulesModal(); return false;" class="nav-link">Auto-Rules</a>`;
html = html.split(navSearch).join(navReplace);


fs.writeFileSync('keywords.html', html, 'utf8');
console.log('keywords.html updated with new rule options.');