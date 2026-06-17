const fs = require('fs');

let indexJs = fs.readFileSync('index.js', 'utf8');

// Use exact string replacement to cut out the erroneous block starting at line 1762
const stringToCut = `                } else {
                    accounts.push({ platform: 'Facebook', handle: credentials.username + ' (Profile)', type: 'Profile', id: Date.now() + 1 });
                }

                if (pagesRes.ok) {
                    const pagesData = await pagesRes.json();
                    if (pagesData.data && pagesData.data.length > 0) {
                        pagesData.data.forEach(page => {
                            accounts.push({ platform: 'Facebook', handle: page.name + ' (Page)', type: 'Page', id: page.id, category: page.category });
                        });
                    }
                }
                
                if (groupsRes.ok) {
                    const groupsData = await groupsRes.json();
                    if (groupsData.data && groupsData.data.length > 0) {
                        groupsData.data.forEach(group => {
                            accounts.push({ platform: 'Facebook', handle: group.name + ' (Group)', type: 'Group', id: group.id, privacy: group.privacy });
                        });
                    }
                }
                
                if (businessRes.ok) {
                    const bizData = await businessRes.json();
                    if (bizData.data && bizData.data.length > 0) {
                        bizData.data.forEach(biz => {
                            accounts.push({ platform: 'Facebook', handle: biz.name + ' (Business Mgr)', type: 'Business', id: biz.id });
                        });
                    }
                }

                // If API succeeded but found nothing, mock intelligently
                if (accounts.length === 1) {
                     accounts.push({ platform: 'Facebook', handle: credentials.username.split('@')[0] + ' Official (Page)', type: 'Page', id: Date.now() + 2 });
                     accounts.push({ platform: 'Facebook', handle: credentials.username.split('@')[0] + ' Support (Page)', type: 'Page', id: Date.now() + 3 });
                     accounts.push({ platform: 'Facebook', handle: 'Global Marketing Network (Group)', type: 'Group', id: Date.now() + 4 });
                     accounts.push({ platform: 'Facebook', handle: 'SaaS Founders Hub (Group)', type: 'Group', id: Date.now() + 5 });
                     accounts.push({ platform: 'Facebook', handle: credentials.username.split('@')[0] + ' Business Manager (Business)', type: 'Business', id: Date.now() + 6 });
                }

                return accounts;
            } catch (e) {
                console.error("Facebook API Fetch Error:", e);
                // Fallback to intelligent mocks based on input
                return [
                    { platform: 'Facebook', handle: credentials.username + ' (Profile)', type: 'Profile', id: Date.now() + 1 },
                    { platform: 'Facebook', handle: credentials.username.split('@')[0] + ' Official (Page)', type: 'Page', id: Date.now() + 2 },
                    { platform: 'Facebook', handle: credentials.username.split('@')[0] + ' Support (Page)', type: 'Page', id: Date.now() + 3 },
                    { platform: 'Facebook', handle: 'Global Marketing Network (Group)', type: 'Group', id: Date.now() + 4 },
                    { platform: 'Facebook', handle: 'SaaS Founders Hub (Group)', type: 'Group', id: Date.now() + 5 }
                ];
            }
        } else {
            // No API Key provided, fallback to thorough intelligent mocks based on username
            return [
                { platform: 'Facebook', handle: credentials.username + ' (Profile)', type: 'Profile', id: Date.now() + 1 },
                { platform: 'Facebook', handle: credentials.username.split('@')[0] + ' Official (Page)', type: 'Page', id: Date.now() + 2 },
                { platform: 'Facebook', handle: credentials.username.split('@')[0] + ' Support (Page)', type: 'Page', id: Date.now() + 3 },
                { platform: 'Facebook', handle: 'Industry Leaders Forum (Group)', type: 'Group', id: Date.now() + 4 },
                { platform: 'Facebook', handle: 'SaaS & Marketing Network (Group)', type: 'Group', id: Date.now() + 5 },
                { platform: 'Facebook', handle: 'Private Mastermind (Community)', type: 'Community', id: Date.now() + 6 }
            ];
        }
    } else if (credentials.platform === 'YouTube') {
        return [
            { platform: 'YouTube', handle: credentials.username + ' (Personal)', type: 'Channel', id: Date.now() + 1 },
            { platform: 'YouTube', handle: credentials.username.split('@')[0] + ' Studio', type: 'Channel', id: Date.now() + 2 },
            { platform: 'YouTube', handle: 'Daily Vlog Channel', type: 'Channel', id: Date.now() + 3 }
        ];
    }
    
    return [
        { platform: credentials.platform, handle: credentials.username, type: 'Profile', id: Date.now() }
    ];
});`;

// Because line endings might differ, let's just do an indexOf and substring if match fails
let replaceSuccess = false;

// Attempt direct replace
let directIndex = indexJs.indexOf("                } else {\n                    accounts.push({ platform: 'Facebook', handle: credentials.username + ' (Profile)', type: 'Profile', id: Date.now() + 1 });");

if (directIndex !== -1) {
    let endTag = "    ];\n});";
    let endIndex = indexJs.indexOf(endTag, directIndex);
    if (endIndex !== -1) {
        let chunkToRemove = indexJs.substring(directIndex, endIndex + endTag.length);
        indexJs = indexJs.replace(chunkToRemove, "");
        fs.writeFileSync('index.js', indexJs, 'utf8');
        console.log("Syntax error block removed perfectly.");
        replaceSuccess = true;
    }
}

if (!replaceSuccess) {
    // Try regex
    console.log("Direct index failed, trying regex fallback...");
}