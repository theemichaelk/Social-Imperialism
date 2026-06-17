const fs = require('fs');
const path = require('path');

const files = [
    'dashboard.html',
    'history.html',
    'keywords.html',
    'rules.html',
    'account-hub.html',
    'content-hub.html',
    'settings.html',
    'calendar.html',
    'automations.html'
];

function getNavHtml(activePage) {
    const isDash = activePage === 'dashboard' ? 'active' : '';
    const isEngage = activePage === 'engagement' ? 'active' : '';
    const isHist = activePage === 'history' ? 'active' : '';
    const isKey = activePage === 'keywords' ? 'active' : '';
    const isAuto = activePage === 'automations' ? 'active' : '';
    const isRule = activePage === 'rules' ? 'active' : '';
    const isAcc = activePage === 'account-hub' ? 'active' : '';
    const isCont = activePage === 'content-hub' ? 'active' : '';
    const isCal = activePage === 'calendar' ? 'active' : '';
    const isSet = activePage === 'settings' ? 'active' : '';

    return '<div class="sidebar">\n' +
'  <div class="sidebar-title-container">\n' +
'    <img src="icon.svg" alt="Icon" class="sidebar-logo">\n' +
'    <h2 class="sidebar-title">Social<br>Imperialism</h2>\n' +
'  </div>\n' +
'  \n' +
'  <div class="campaign-switcher-box">\n' +
'    <select id="sidebarCampaignSwitcher">\n' +
'      <option value="">Loading Campaigns...</option>\n' +
'    </select>\n' +
'  </div>\n' +
'\n' +
'  <a href="dashboard.html" class="nav-link ' + isDash + '"><i class="fas fa-home"></i> Dashboard</a>\n' +
'  <a href="engagement.html" class="nav-link ' + isEngage + '"><i class="fas fa-users"></i> Engagement Lists</a>\n' +
'  <a href="history.html" class="nav-link ' + isHist + '"><i class="fas fa-history"></i> AI Replies</a>\n' +
'  <a href="keywords.html" class="nav-link ' + isKey + '"><i class="fas fa-tags"></i> Keywords</a>\n' +
'  <a href="automations.html" class="nav-link ' + isAuto + '"><i class="fas fa-project-diagram"></i> Visual Builder</a>\n' +
'  <a href="rules.html" class="nav-link ' + isRule + '"><i class="fas fa-cogs"></i> Auto-Rules</a>\n' +
'  <a href="account-hub.html" class="nav-link ' + isAcc + '"><i class="fas fa-link"></i> Linked Accounts</a>\n' +
'  <a href="content-hub.html" class="nav-link ' + isCont + '"><i class="fas fa-edit"></i> Content Hub</a>\n' +
'  <a href="calendar.html" class="nav-link ' + isCal + '"><i class="fas fa-calendar-alt"></i> Content Calendar</a>\n' +
'  <a href="settings.html" class="nav-link ' + isSet + '"><i class="fas fa-sliders-h"></i> Settings</a>\n' +
'</div>';
}

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    
    let html = fs.readFileSync(file, 'utf8');
    const pageName = file.replace('.html', '');
    
    // 1. Replace the entire sidebar div block
    const sidebarRegex = /<div class="sidebar">[\s\S]*?(?=<div class="main-content">|<div class="container">|<div class="content">)/;
    
    if(sidebarRegex.test(html)) {
        html = html.replace(sidebarRegex, getNavHtml(pageName) + '\n\n');
        fs.writeFileSync(file, html, 'utf8');
        console.log(`Successfully synced sidebar for ${file}`);
    }
});