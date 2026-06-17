const fs = require('fs');
let file = "PRD.md";
let content = fs.readFileSync(file, "utf8");

// Add the new rule at the very top
let newRule = `\n## Critical Development Rule\n**Always check with the blueprint/PRD and do not delete or override any features when updating or adding new features.**\n`;

if(!content.includes('Critical Development Rule')) {
  content = content.replace('# Product Requirements Document (PRD): Social Imperialism', '# Product Requirements Document (PRD): Social Imperialism' + newRule);
  fs.writeFileSync(file, content);
}
console.log('Success');