const fs = require('fs');
let file = 'index.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\bn| \bn/g, '\n');
fs.writeFileSync(file, content);
