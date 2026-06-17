const fs = require('fs');
let content = fs.readFileSync('C:/Users/theem/OneDrive/Documents/Factory AI.02.20.26/Social Imperialism/apps/desktop/rules.html', 'utf8');

const findStr = `<div style="margin-bottom: 1.5rem;">
      <label style="color: #38bdf8; font-weight: bold; margin-bottom: 0.5rem; display: block;">Custom AI Prompt Override (Optional)</label>`;

const replaceStr = `<div style="margin-bottom: 1.5rem;">
      <label style="color: #38bdf8; font-weight: bold; margin-bottom: 0.5rem; display: block;">Autonomous vs Approval Mode</label>
      <select id="autoReplyMode" style="width: 100%; background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 0.6rem; border-radius: 4px; font-size: 0.9rem;">
        <option value="auto_post_all">Auto Post All Replies / Comments</option>
        <option value="manual_approval">Require Manual Approval for Everything</option>
        <option value="mentions_only" selected>Only Auto Post for Mentions/DMs (Require Approval for Keywords)</option>
      </select>
      <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.5rem;">Control how AI replies are sent out per project/platform.</div>
    </div>

    <div style="margin-bottom: 1.5rem;">
      <label style="color: #38bdf8; font-weight: bold; margin-bottom: 0.5rem; display: block;">Custom AI Prompt Override (Optional)</label>`;

content = content.replace(findStr, replaceStr);

const findJsStr = `customRulePrompt: document.getElementById('customRulePrompt').value,`;
const replaceJsStr = `customRulePrompt: document.getElementById('customRulePrompt').value,\n        autoReplyMode: document.getElementById('autoReplyMode') ? document.getElementById('autoReplyMode').value : 'mentions_only',`;
content = content.replace(findJsStr, replaceJsStr);

const findLoadStr = `document.getElementById('customRulePrompt').value = settings.customRulePrompt || '';`;
const replaceLoadStr = `document.getElementById('customRulePrompt').value = settings.customRulePrompt || '';\n            if(document.getElementById('autoReplyMode') && settings.autoReplyMode) document.getElementById('autoReplyMode').value = settings.autoReplyMode;`;
content = content.replace(findLoadStr, replaceLoadStr);

fs.writeFileSync('C:/Users/theem/OneDrive/Documents/Factory AI.02.20.26/Social Imperialism/apps/desktop/rules.html', content, 'utf8');
console.log('Done');
