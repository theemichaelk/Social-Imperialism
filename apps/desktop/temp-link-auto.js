const fs = require('fs');
const pages = ['dashboard.html', 'history.html', 'content-hub.html', 'rules.html', 'keywords.html', 'settings.html', 'calendar.html', 'account-hub.html'];

pages.forEach(page => {
    try {
        let html = fs.readFileSync(page, 'utf8');
        
        // Find sidebar menu and inject link if it doesn't exist
        if(!html.includes('automations.html')) {
            const rulesLink = html.indexOf('<a href="rules.html" class="nav-item">');
            if(rulesLink > -1) {
                const newLink = `<a href="automations.html" class="nav-item">
          <i class="fas fa-project-diagram"></i>
          Visual Builder
        </a>\n        <a href="rules.html" class="nav-item">`;
                html = html.replace('<a href="rules.html" class="nav-item">', newLink);
                fs.writeFileSync(page, html, 'utf8');
                console.log('Linked in', page);
            }
        }
    } catch(e) {
        console.error('Error on page', page, e.message);
    }
});