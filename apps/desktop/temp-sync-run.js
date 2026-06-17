const fs = require('fs');
const path = require('path');

const files = [
    'dashboard.html',
    'history.html',
    'keywords.html',
    'rules.html',
    'account-hub.html',
    'content-hub.html',
    'settings.html'
];

const newCSS = `
/* Sidebar Standardized Styles */
.sidebar { width: 250px; background-color: #020617; color: white; padding: 2rem 1rem; display: flex; flex-direction: column; border-right: 1px solid #1e293b; overflow-y: auto; z-index: 100; }
.sidebar-title-container { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; justify-content: center; }
.sidebar-logo { height: 48px; width: 48px; object-fit: contain; }
.sidebar-title { font-size: 1.5rem; font-weight: bold; color: #38bdf8; text-align: left; letter-spacing: 1px; text-transform: uppercase; margin: 0; line-height: 1.2; }
.nav-link { color: #94a3b8; text-decoration: none; padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 10px; transition: all 0.2s ease; font-size: 0.95rem; }
.nav-link i { width: 20px; text-align: center; font-size: 1.1rem; }
.nav-link:hover { background-color: #1e293b; color: white; transform: translateX(2px); }
.nav-link.active { background-color: #38bdf8; color: #020617; font-weight: 600; box-shadow: 0 0 10px rgba(56, 189, 248, 0.5); transform: translateX(2px); }
.campaign-switcher-box { padding: 0 0.5rem 1.5rem 0.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid #1e293b; }
.campaign-switcher-box select { width: 100%; background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 0.6rem; border-radius: 6px; font-size: 0.85rem; cursor: pointer; transition: border-color 0.2s; }
.campaign-switcher-box select:hover { border-color: #38bdf8; }
.campaign-switcher-box select:focus { outline: none; border-color: #38bdf8; box-shadow: 0 0 0 2px rgba(56,189,248,0.2); }
`;

function getNavHtml(activePage) {
    const isDash = activePage === 'dashboard' ? 'active' : '';
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
    const sidebarRegex = /<div class="sidebar">[\s\S]*?(?=<div class="main-content">|<div class="container">)/;
    
    if(sidebarRegex.test(html)) {
        html = html.replace(sidebarRegex, getNavHtml(pageName) + '\n\n');
    }
    
    // 2. Inject or replace the CSS rules for the sidebar
    html = html.replace(/\.sidebar\s*\{[^}]+\}/g, '');
    html = html.replace(/\.sidebar-title-container\s*\{[^}]+\}/g, '');
    html = html.replace(/\.sidebar-title\s*\{[^}]+\}/g, '');
    html = html.replace(/\.nav-link\s*\{[^}]+\}/g, '');
    html = html.replace(/\.nav-link:hover\s*\{[^}]+\}/g, '');
    html = html.replace(/\.nav-link\.active\s*\{[^}]+\}/g, '');
    html = html.replace(/\.sidebar-logo\s*\{[^}]+\}/g, '');

    if(html.includes('</style>')) {
        html = html.replace('</style>', newCSS + '\n</style>');
    } else {
        html = html.replace('</head>', '<style>\n' + newCSS + '\n</style>\n</head>');
    }
    
    if(!html.includes('font-awesome')) {
        html = html.replace('</head>', '  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">\n</head>');
    }

    fs.writeFileSync(file, html, 'utf8');
    console.log(`Successfully synced sidebar for ${file}`);
});

const calendarFile = 'calendar.html';
if(fs.existsSync(calendarFile)) {
    let calHtml = fs.readFileSync(calendarFile, 'utf8');
    
    const calSidebarRegex = /<div class="sidebar">[\s\S]*?(?=<div class="main-content">)/;
    if(calSidebarRegex.test(calHtml)) {
        calHtml = calHtml.replace(calSidebarRegex, getNavHtml('calendar') + '\n\n');
    }
    
    fs.writeFileSync(calendarFile, calHtml, 'utf8');
    console.log('Synced calendar.html sidebar exactly.');
}