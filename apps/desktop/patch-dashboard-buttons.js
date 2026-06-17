const fs = require('fs');
let file = "dashboard.html";
let content = fs.readFileSync(file, "utf8");

let engageScript = `\nfunction attachEngageListener(button, action) {\n  button.addEventListener('click', async (e) => {\n    const b = e.target;\n    b.innerText = action === 'like' ? 'Liking...' : 'Sharing...';\n    b.disabled = true;\n    await ipcRenderer.invoke('engage-post', { action, platform: b.dataset.platform });\n    b.innerText = action === 'like' ? 'Liked' : 'Shared';\n    b.style.color = '#10b981';\n    b.style.borderColor = '#10b981';\n  });\n}\n`;

if(!content.includes('function attachEngageListener')) {
  content = content + engageScript;
}

fs.writeFileSync(file, content);
console.log('Success');