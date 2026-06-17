const fs = require('fs');
const files = ['dashboard.html', 'history.html', 'keywords.html', 'rules.html', 'account-hub.html', 'content-hub.html', 'calendar.html', 'settings.html'];

for(const file of files) {
    if(!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    
    // Most files are missing the Auto-Rules link entirely, or have a broken '#' link
    // Some are missing the proper nav structure.
    // The correct full nav should be:
    const correctNav = `
      <a href="dashboard.html" class="nav-link {if-dash}">Dashboard</a>
      <a href="history.html" class="nav-link {if-hist}">AI Replies</a>
      <a href="keywords.html" class="nav-link {if-key}">Keywords</a>
      <a href="rules.html" class="nav-link {if-rules}">Auto-Rules</a>
      <a href="account-hub.html" class="nav-link {if-acc}">Linked Accounts</a>
      <a href="content-hub.html" class="nav-link {if-cont}">Content Hub</a>
      <a href="calendar.html" class="nav-link {if-cal}">Content Calendar</a>
      <a href="settings.html" class="nav-link {if-set}">Settings</a>
    `;

    // Let's find the nav block
    const navStart = content.indexOf('<nav class="sidebar-nav">');
    if (navStart === -1) {
        console.log(`Could not find nav in ${file}`);
        continue;
    }
    const navEnd = content.indexOf('</nav>', navStart);
    
    let isDash = file === 'dashboard.html' ? 'active' : '';
    let isHist = file === 'history.html' ? 'active' : '';
    let isKey = file === 'keywords.html' ? 'active' : '';
    let isRules = file === 'rules.html' ? 'active' : '';
    let isAcc = file === 'account-hub.html' ? 'active' : '';
    let isCont = file === 'content-hub.html' ? 'active' : '';
    let isCal = file === 'calendar.html' ? 'active' : '';
    let isSet = file === 'settings.html' ? 'active' : '';
    
    let newNav = correctNav
        .replace('{if-dash}', isDash)
        .replace('{if-hist}', isHist)
        .replace('{if-key}', isKey)
        .replace('{if-rules}', isRules)
        .replace('{if-acc}', isAcc)
        .replace('{if-cont}', isCont)
        .replace('{if-cal}', isCal)
        .replace('{if-set}', isSet)
        .replace(/ class="nav-link "/g, ' class="nav-link"'); // cleanup empty spaces

    content = content.substring(0, navStart + 25) + newNav + content.substring(navEnd);
    
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated nav in ${file}`);
}