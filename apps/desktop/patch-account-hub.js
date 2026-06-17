const fs = require('fs');
let file = 'account-hub.html';
let content = fs.readFileSync(file, 'utf8');

// Fix the disconnect button logic

content = content.replace(
  /document\\.getElementById\\('disconnectBtn'\\)\\.addEventListener\\('click',\\sAsync \<(\\9 =>\\{\[\\s\S]+17}\\);/g,
  `document.getElementById('disconnectBtn').addEventListener('click', async () => {\n    if (!currentAccountId) return;\n    \n    if (confirm(\"Are you sure you want to completely disconnect this account from this Campaign?\")) {\n      try {\n        await ipcRenderer.invoke('unlink-account', currentAccountId);\n        currentAccountId = null;\n        document.querySelector('.workspace').style.display = 'none';\n        loadAccounts();\n      } catch (e) {\n        alert(\"Failed to disconnect account. \" + e.message);\n      }\n    }\n  });`
p
fs.writeFileSync(file, content);

console.log('Patched disconnect button');
