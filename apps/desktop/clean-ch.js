const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// There are multiple monkey-patches of loadAccounts which are likely breaking because they reference themselves recursively.
// Let's replace the whole loadAccounts logic with one unified function.

let unifiedLoadAccounts = `
async function loadAccounts() {
  const accounts = await ipcRenderer.invoke('get-linked-accounts');
  
  // 1. Main Standard Post Tab
  const select = document.getElementById('accountSelect');
  if(select) {
      select.innerHTML = '';
      if (accounts.length === 0) {
        let opt = document.createElement('option');
        opt.value = '';
        opt.innerText = 'No accounts linked (Go to Account Hub)';
        select.appendChild(opt);
      } else {
        accounts.forEach(a => {
            let opt = document.createElement('option');
            opt.value = a.id;
            opt.setAttribute('data-platform', a.platform); 
            opt.innerText = a.platform + ' - ' + a.handle;
            select.appendChild(opt);
        });
      }
  }

  // 2. Video Tab Select
  const vidSelect = document.getElementById('videoAccountSelect');
  if(vidSelect) {
      vidSelect.innerHTML = select ? select.innerHTML : '';
  }

  // 3. Comments Tab Select
  const cmtSelect = document.getElementById('commentsAccountSelect');
  if(cmtSelect) {
      cmtSelect.innerHTML = '<option value="">All Connected Accounts</option>';
      if(select && select.options.length > 0 && select.options[0].value !== '') {
          Array.from(select.options).forEach(opt => {
              if(opt.value) cmtSelect.appendChild(opt.cloneNode(true));
          });
      }
  }
}
document.addEventListener('DOMContentLoaded', () => loadAccounts());
`;

// Regex out the old loadAccounts functions and all monkeypatches
html = html.replace(/async function loadAccounts\(\) \{[\s\S]*?\}\s*document\.addEventListener\('DOMContentLoaded', \(\) => loadAccounts\(\)\);/g, '/* UNIFIED LOAD ACCOUNTS */');
html = html.replace(/\/\/ We hook into loadAccounts to do this[\s\S]*?cloneAccountsToVideoSelect\(\);\n\}/g, '');
html = html.replace(/const originalLoadAccounts = loadAccounts;/g, '');
html = html.replace(/const originalLoadAccounts2 = window\.loadAccounts;\nwindow\.loadAccounts = async function\(\) \{[\s\S]*?cloneAccountsToCommentsSelect\(\);\n\}/g, '');
html = html.replace(/function cloneAccountsToVideoSelect\(\) \{[\s\S]*?\}/g, '');
html = html.replace(/function cloneAccountsToCommentsSelect\(\) \{[\s\S]*?\}/g, '');

html = html.replace('/* UNIFIED LOAD ACCOUNTS */', unifiedLoadAccounts);

fs.writeFileSync('content-hub.html', html, 'utf8');
console.log('Cleaned up loadAccounts in content-hub.html');