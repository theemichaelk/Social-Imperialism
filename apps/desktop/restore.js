const fs = require('fs');
let originalContent = fs.readFileSync('test2.txt', 'utf8');
fs.writeFileSync('index.js', originalContent);
