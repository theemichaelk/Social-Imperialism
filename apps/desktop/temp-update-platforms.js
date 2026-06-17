const fs = require('fs');
let html = fs.readFileSync('settings.html', 'utf8');

// Add to settings platform selector
html = html.replace(/<option value="discord">Discord<\/option>/, '<option value="discord">Discord</option>\n          <option value="wechat">WeChat</option>\n          <option value="weibo">Weibo</option>');

// Add to platform rules selector
html = html.replace(/<option value="twitch" \$\{target==='twitch' \? 'selected' : ''\}>Twitch<\/option>/, `<option value="twitch" \${target==='twitch' ? 'selected' : ''}>Twitch</option>\n        <option value="wechat" \${target==='wechat' ? 'selected' : ''}>WeChat</option>\n        <option value="weibo" \${target==='weibo' ? 'selected' : ''}>Weibo</option>`);

fs.writeFileSync('settings.html', html, 'utf8');

let htmlDash = fs.readFileSync('dashboard.html', 'utf8');
htmlDash = htmlDash.replace(/<option value="WhatsApp">WhatsApp<\/option>/, '<option value="WhatsApp">WhatsApp</option>\n          <option value="WeChat">WeChat</option>\n          <option value="Weibo">Weibo</option>');
fs.writeFileSync('dashboard.html', htmlDash, 'utf8');

let htmlAcc = fs.readFileSync('account-hub.html', 'utf8');
htmlAcc = htmlAcc.replace(/<option value="whatsapp">WhatsApp<\/option>/, '<option value="whatsapp">WhatsApp</option>\n            <option value="wechat">WeChat</option>\n            <option value="weibo">Weibo</option>');
fs.writeFileSync('account-hub.html', htmlAcc, 'utf8');

console.log('Added WeChat and Weibo to platform selectors.');