const fs = require('fs');
let idx = fs.readFileSync('index.js', 'utf8');

// There are extra catch blocks and braces after the FAL API implementation.
// We need to remove lines 1228-1238

let s1 = idx.indexOf('});\r\n        \r\n        // This is a queue endpoint, so we normally have to poll the status URL');
if(s1 === -1) s1 = idx.indexOf('});\n        \n        // This is a queue endpoint, so we normally have to poll the status URL');

if (s1 > -1) {
    let s2 = idx.indexOf('});\r\n\r\n// Search Stock Photos (Pexels / Pixabay / Flickr)', s1);
    if(s2 === -1) s2 = idx.indexOf('});\n\n// Search Stock Photos (Pexels / Pixabay / Flickr)', s1);
    
    if (s2 > -1) {
        idx = idx.substring(0, s1 + 3) + idx.substring(s2 + 3);
        fs.writeFileSync('index.js', idx, 'utf8');
        console.log('Fixed index.js syntax error');
    } else {
        console.log('Could not find end of bad block');
    }
} else {
    // Let's try regex if indexOf fails
    const regex = /\}\);\s*\/\/\s*This is a queue endpoint, so we normally have to poll the status URL[\s\S]*?\}\s*\}\);/g;
    if(regex.test(idx)) {
        idx = idx.replace(regex, '});');
        fs.writeFileSync('index.js', idx, 'utf8');
        console.log('Fixed index.js syntax error using regex');
    } else {
        console.log('Could not find bad block at all');
    }
}