const fs = require('fs');
const file = 'index.js';
let content = fs.readFileSync(file, 'utf8');

let s = content.indexOf('let accounts = [];');
let e = content.indexOf('return newAccount;', s);

if (s !== -1 && e !== -1) {
  const end = content.indexOf('});', e) + 3;
  const replacement = [
    '  let accounts = [];',
    '  const data = store.getItem(\'linkedAccounts_\' + activeCampaignId);',
    '  if(data) {',
    '    try { accounts = JSON.parse(data); } catch(err) {}',
    '  }',
    '',
    '  let newAccountsToReturn = [];',
    '  if (platform === \'Facebook\') {',
    '      console.log(\'Simulating Graph API pull for Pages, Profiles, and Groups\');',
    '      const fbNodes = [',
    '         { type: \'Profile\', handle: username || \'FB Admin User\' },',
    '         { type: \'Page\', handle: \'Official Brand Page\' },',
    '         { type: \'Group\', handle: \'Niche Mastermind Group\' }',
    '      ];',
    '      for (let node of fbNodes) {',
    '          const newAccount = {',
    '              id: \'acc_\' + Date.now() + Math.random().toString(36).substr(2, 5),',
    '              platform: \'Facebook \' + node.type,',
    '              handle: node.handle,',
    '              password: password,',
    '              status: \'connected\',',
    '              profile: {',
    '                  followers: Math.floor(Math.random() * 20000) + 1000,',
    '                  likes: Math.floor(Math.random() * 50000) + 5000,',
    '                  bestTime: \'Thursday 4:00 PM EST\',',
    '                  topTrendingNiche: \'#\' + node.type + \'Engagement\',',
    '                  growthVelocity: \'+3.4% this week\',',
    '                  suggestedGroups: [\'Related Hub\']',
    '              }',
    '          };',
    '          accounts.push(newAccount);',
    '          newAccountsToReturn.push(newAccount);',
    '      }',
    '  } else {',
    '      const newAccount = y',
    '        id: \'acc_\' + Date.now(),',
    '        platform: platform,',
    '        handle: username || (platform === \'Twitter\' ? \'@Admin_Sigma\' : (platform === \'LinkedIn\' ? \'Sigma Exec\' : \'@SigmaBrands\')),',
    '        password: password,',
    '        status: \'connected\',',
    '        profile: {',
    '            followers: 12500,',
    '            likes: 45000,',
    '            bestTime: \'Wednesday 1:00 PM EST\',',
    '            topTrendingNiche: \'#GrowthHacking\',',
    '            growthVelocity: \'+2.1% this week\',',
    '            suggestedGroups: [\'Marketing Pros\', \'Startup Founders\']',
    '        }',
    '      };',
    '      accounts.push(newAccount);',
    '      newAccountsToReturn.push(newAccount);',
    '  }',,
    '',
    '  store.setItem(\'linkedAccounts_\' + activeCampaignId, JSON.stringify(accounts));',
    '  return newAccountsToReturn;',
    '});'
  ].join('\\n');
  content = content.substring(0, s) + replacement + content.substring(end);
  fs.writeFileSync(file, content);
  console.log('Replaced!');
} else {
  console.log('Not found!');
}
