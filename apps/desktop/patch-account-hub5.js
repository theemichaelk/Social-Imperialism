const fs = require('fs');
let file = 'account-hub.html';
let content = fs.readFileSync(file, 'utf8');

// Fix multiselect and api logic
content = content.replace(
  /if \\(accounts.length > 1\s*\\) {[\\s\\S]+?} else {[\\s\\S]+?}/g,
  `if (accounts.length > 0) {\n      const listEl = document.getElementById('accountSelectionList');\n      listEl.innerHTML = '';\n      accounts.forEach((acc, index) => {\n        const itemEl = document.createElement('div');\n        itemEl.style.cssText = 'padding: 0.75rem; border-bottom: 1px solid #334155; display: flex; align-items: center; gap: 1rem;';\n        itemEl.innerHTML = '<input type="checkbox" id="sel_' + index + '" value="' + index + '" checked style="accent-color: #38bdf8;"><label for="sel_' + index + '" style="color: #e8e8f4; cursor: pointer;"><strong>' + acc.platform + '</strong> - ' + acc.handle + '</label>';\n        listEl.appendChild(itemEl);\n      });\n      document.getElementById('selectionModal').classList.add('active');\n    } else {\n      await ipcRenderer.invoke('use-selected-accounts', accounts);\n      loadAccounts();\n    }`
p
fs.writeFileSync(file, content);

console.log('Patched account multi select');
