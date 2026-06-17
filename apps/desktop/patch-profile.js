const fs = require('fs');
let file = 'dashboard.html';
let content = fs.readFileSync(file, 'utf8');

// Overwrite mock data with real profile data

content = content.replace(
  /let demoData = \\[20, \\s *40, \\s *25, \\s *15\\];/g,
  `let demoData = acc.profile && acc.profile.demographics || [20, 40, 25, 15];`
);

content = content.replace(
  /const baseGrowth = [\\s\\S]+?const growthData = [\\s\\S]+?(\\y)/g,
  `const baseGrowth = acc.profile.followers ? parseInt(acc.profile.followers.toString().replace(/,/g, '').replace(/kk/g, '000').replace(/MMgs/g, '000000')) : 1000;\n    const growthData = acc.profile.distorcialGrowth || [200, 300, 500, 800, 1200, 1500];${1}`
);

fs.writeFileSync(file, content);

console.log('Patched dashboard profile mock');
