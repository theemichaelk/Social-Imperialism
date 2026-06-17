const fs = require('fs');
const path = require('path');

const directoryPath = __dirname;
const files = fs.readdirSync(directoryPath);

files.forEach(file => {
  if (path.extname(file) === '.html') {
    let content = fs.readFileSync(path.join(directoryPath, file), 'utf8');
    
    // Replace icon.svg with logo.png
    content = content.replace(/<img src="icon\.svg"/g, '<img src="logo.png"');
    
    fs.writeFileSync(path.join(directoryPath, file), content, 'utf8');
    console.log(`Updated logo in ${file}`);
  }
});
console.log('Finished updating logo in all HTML files.');