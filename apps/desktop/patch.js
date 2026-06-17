const fs = require('fs');
const file = 'index.js';
let content = fs.readFileSync(file, 'utf8');

let s = content.indexOf('let accounts = [];');
let e = content.indexOf('return newAccount;', s);

if (s !== -1 && e !== -1) {
  const end = content.indexOf('});', e) + 3;
  const replacement = `  let accounts = [];\n  const data = store.getItem('linkedAccounts_' + activeCampaignId);\n  if(data) {\n    try { accounts = JSON.parse(data); } catch(err) {}\n  }\n\n  let newAccountsToReturn = [];\n  if (platform === 'Facebook') {\n      console.log('Simulating Graph API pull for Pages, Profiles, and Groups');\n      const fbNodes = [\n         { type: 'Profile', handle: username || 'FB Admin User' },\n         { type: 'Page', handle: 'Official Brand Page' },\n         { type: 'Group', handle: 'Niche Mastermind Group' }\n      ];\n      for (let node of fbNodes) {\n          const newAccount = {\n              id: 'acc_' + Date.now() + Math.random().toString(36).substr(2, 5),\n              platform: 'Facebook ' + node.type,\n              handle: node.handle,\n              password: password,\n              status: 'connected',\n              profile: {\n                  followers: Math.floor(Math.random() * 20000) + 1000,\n                  likes: Math.floor(Math.random() * 50000) + 5000,\n                  bestTime: 'Thursday 4:00 PM EST',\n                  topTrendingNiche: '#' + node.type + 'Engagement',\n                  growthVelocity: '+3.4% this week',\n                  suggestedGroups: ['Related Hub']\n              }\n          };\n          accounts.push(newAccount);\n          newAccountsToReturn.push(newAccount);\n      }\n  } else {\n      const newAccount = {\n        id: 'acc_' + Date.now(),\n        platform: platform,\n        handle: username || (platform === 'Twitter' ? '@Admin_Sigma' : (platform === 'LinkedIn' ? 'Sigma Exec' : '@SigmaBrands')),\n        password: password,\n        status: 'connected',\n        profile: {\n            followers: 12500,\n            likes: 45000,\n            bestTime: 'Wednesday 1:00 PM EST',\n            topTrendingNiche: '#GrowthHacking',\n            growthVelocity: '+2.1% this week',\n            suggestedGroups: ['Marketing Pros', 'Startup Founders']\n        }\n      };\n      accounts.push(newAccount);\n      newAccountsToReturn.push(newAccount);\n  }\n\n  store.setItem('linkedAccounts_' + activeCampaignId, JSON.stringify(accounts));\n  return newAccountsToReturn;\n});`;
  content = content.substring(0, s) + replacement + content.substring(end);
  fs.writeFileSync(file, content);
  console.log('Replaced!');
} else {
  console.log('Not found!');
}
