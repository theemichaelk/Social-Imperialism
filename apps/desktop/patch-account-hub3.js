const fs = require('fs');
let file = 'account-hub.html';
let content = fs.readFileSync(file, 'utf8');

// Fix the disconnect button logic
content = content.replace(
  /document\\.getElementById\\('disconnectBtn'\\)\\.addEventListener\\('click', async \\(\\) => \\{[\\s\\S]+?\\}\\);/g,
  "document.getElementById('disconnectBtn').addEventListener('click', async () => { if (!currentAccountId) return; if (confirm('Are you sure you want to completely disconnect this account from this Campaign?')) { try { await ipcRenderer.invoke('unlink-account', currentAccountId); currentAccountId = null; document.querySelector('.workspace').style.display = 'none'; loadAccounts(); } catch (e) { alert('Failed to disconnect account. ' + e.message); } } });"
);

fs.writeFileSync(file, content);

console.log('Patched disconnect button');
