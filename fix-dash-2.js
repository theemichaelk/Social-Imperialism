const fs = require('fs');
const filePath = 'C:/Users/theem/OneDrive/Documents/Factory AI.02.20.26/Social Imperialism/apps/desktop/dashboard.html';
let content = fs.readFileSync(filePath, 'utf8');

const oldStr = `        });\r
        window.currentFeedPosts = allPosts;`;
const oldStr2 = `        });\n        window.currentFeedPosts = allPosts;`;

const newStr = `        });\n        htmlStr += '</ul>';\n        nDiv.innerHTML = htmlStr;\n      } else {\n        nDiv.innerHTML = 'No trending news found.';\n      }\n    });\n\n    window.currentFeedPosts = allPosts;`;

if (content.includes('});\r\n        window.currentFeedPosts = allPosts;')) {
    content = content.replace('});\r\n        window.currentFeedPosts = allPosts;', newStr);
    console.log("Fixed with \\r\\n");
} else if (content.includes('});\n        window.currentFeedPosts = allPosts;')) {
    content = content.replace('});\n        window.currentFeedPosts = allPosts;', newStr);
    console.log("Fixed with \\n");
} else {
    content = content.replace(/ \}\);\s*window\.currentFeedPosts = allPosts;/g, "        " + newStr);
    console.log("Fixed with regex");
}

fs.writeFileSync(filePath, content, 'utf8');
