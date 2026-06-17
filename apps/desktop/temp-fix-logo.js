const fs = require('fs');
let html = fs.readFileSync('calendar.html', 'utf8');

// Ensure the sidebar-logo class has the correct dimensions
if (!html.includes('.sidebar-logo { height: 48px; width: 48px; object-fit: contain; }')) {
    html = html.replace(/\.sidebar-title-container \{([^}]+)\}/, '.sidebar-title-container {$1}\n.sidebar-logo { height: 48px; width: 48px; object-fit: contain; }');
}

fs.writeFileSync('calendar.html', html, 'utf8');
console.log('Fixed logo CSS in calendar.html');