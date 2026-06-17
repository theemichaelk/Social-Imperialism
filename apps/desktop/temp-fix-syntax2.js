const fs = require('fs');
let indexJs = fs.readFileSync('index.js', 'utf8');

// The regex replacement duplicated part of the block due to a mismatch
// Lines 1762+ look like this:
// });
//                } else {
//                    accounts.push({ platform: 'Facebook', handle: credentials.username + ' (Profile)', type: 'Profile', id: Date.now() + 1 });
//                }

// Find the erroneous `});` and the dangling block below it and remove it.

const errBlock = /\}\);\s*\} else \{\s*accounts\.push\(\{ platform: 'Facebook', handle: credentials\.username \+ ' \(Profile\)', type: 'Profile', id: Date\.now\(\) \+ 1 \}\);[\s\S]*?return accounts;\s*\}\s*\} catch \(e\) \{[\s\S]*?\}\s*\} else \{[\s\S]*?return \[[\s\S]*?\];\s*\}\s*\} else if \(credentials\.platform === 'YouTube'\) \{[\s\S]*?return \[[\s\S]*?\];\s*\}\s*return \[[\s\S]*?\];\s*\n\}\);/m;

if (indexJs.match(errBlock)) {
    // Only remove everything after the first `});` that shouldn't be there
    // Actually, it's easier to find the proper end of get-available-accounts and truncate everything between it and the duplicate get-available-accounts logic
    
    // Let's just find the exact string to replace
    const startIdx = indexJs.indexOf("});\n                } else {\n                    accounts.push({ platform: 'Facebook'");
    if (startIdx !== -1) {
        // Find the next `});` after startIdx which marks the end of the duplicate block
        let endIdx = indexJs.indexOf("});", startIdx + 5);
        // But there are multiple `});` in the duplicate block.
        // It ends exactly at:
        const exactEndStr = "    return [\n        { platform: credentials.platform, handle: credentials.username, type: 'Profile', id: Date.now() }\n    ];\n});";
        const exactEndIdx = indexJs.indexOf(exactEndStr, startIdx);
        
        if (exactEndIdx !== -1) {
            const blockToRemove = indexJs.substring(startIdx + 4, exactEndIdx + exactEndStr.length);
            indexJs = indexJs.replace(blockToRemove, "");
            fs.writeFileSync('index.js', indexJs, 'utf8');
            console.log("Syntax error block removed.");
        } else {
            console.log("Could not find the exact end of the block.");
        }
    } else {
        console.log("Could not find start index.");
    }
} else {
    // try index based again
    const startIdx = indexJs.indexOf("                } else {\n                    accounts.push({ platform: 'Facebook'");
    // Look at line 1762
    // let's split by lines
    let lines = indexJs.split('\\n');
    let newLines = [];
    let skipping = false;
    for(let i=0; i<lines.length; i++) {
        if(lines[i].includes("} else {") && lines[i+1] && lines[i+1].includes("accounts.push({ platform: 'Facebook', handle: credentials.username + ' (Profile)'")) {
            // Check if previous line is `});`
            if(lines[i-1] === "});") {
                skipping = true;
            }
        }
        
        if (skipping) {
            if(lines[i] === "});" && lines[i-1].includes("]")) {
                skipping = false; // Stop skipping after the end of the duplicate block
                continue; // Skip the }); line too
            }
            continue;
        }
        
        newLines.push(lines[i]);
    }
    fs.writeFileSync('index.js', newLines.join('\\n'), 'utf8');
    console.log("Syntax error block removed via line parsing.");
}