const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// There's a stray `);\n}` before window.simulateNewComment.
// Let's remove it.

const badString = `// Manage Comments / Replies Tab Logic\n);\n}`;
const goodString = `// Manage Comments / Replies Tab Logic`;

if(html.includes(badString)) {
    html = html.replace(badString, goodString);
    fs.writeFileSync('content-hub.html', html, 'utf8');
    console.log('Fixed syntax error in content-hub.html');
} else {
    // try to find it with spaces maybe
    let pattern = /Manage Comments \/ Replies Tab Logic[\s\S]*?\)\;[\s\S]*?\}/;
    if(pattern.test(html)) {
        html = html.replace(pattern, 'Manage Comments / Replies Tab Logic');
        fs.writeFileSync('content-hub.html', html, 'utf8');
        console.log('Fixed syntax error in content-hub.html using regex');
    } else {
        console.log('Could not find the exact syntax error string');
    }
}