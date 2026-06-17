const fs = require('fs');
const file = 'C:/Users/theem/OneDrive/Documents/Factory AI.02.20.26/Social Imperialism/apps/desktop/index.js';
let c = fs.readFileSync(file, 'utf8');
const start = c.indexOf('  let accounts = [];');
const endStr = 'return newAccount;';
const end = c.indexOf(endStr, start) + endStr.length;
const replacement = String.fromCharCode(96) + 
  let accounts = [];
  const data = store.getItem('linkedAccounts_' + activeCampaignId);
  if(data) {
    try { accounts = JSON.parse(data); } catch(e) {}
  }

  let newAccountsToReturn = [];
  if (platform === 'Facebook') {
      console.log('Simulating Graph API pull for Pages, Profiles, and Groups');
      const fbNodes = [
         { type: 'Profile', handle: username || 'FB Admin User' },
         { type: 'Page', handle: 'Official Brand Page' },
         { type: 'Group', handle: 'Niche Mastermind Group' }
      ];
      for (let node of fbNodes) {
          const newAccount = {
              id: 'acc_' + Date.now() + Math.random().toString(36).substr(2, 5),
              platform: 'Facebook ' + node.type,
              handle: node.handle,
              password: password,
              status: 'connected',
              profile: {
                  followers: Math.floor(Math.random() * 20000) + 1000,
                  likes: Math.floor(Math.random() * 50000) + 5000,
                  bestTime: 'Thursday 4:00 PM EST',
                  topTrendingNiche: '#' + node.type + 'Engagement',
                  growthVelocity: '+3.4% this week',
                  suggestedGroups: ['Related Hub']
              }
          };
          accounts.push(newAccount);
          newAccountsToReturn.push(newAccount);
      }
  } else {
      const newAccount = {
        id: 'acc_' + Date.now(),
        platform: platform,
        handle: username || (platform === 'Twitter' ? '@Admin_Sigma' : '@SigmaBrands'),
        password: password,
        status: 'connected',
        profile: {
            followers: 12500,
            likes: 45000,
            bestTime: 'Wednesday 1:00 PM EST',
            topTrendingNiche: '#GrowthHacking',
            growthVelocity: '+2.1% this week',
            suggestedGroups: ['Marketing Pros']
        }
      };
      accounts.push(newAccount);
      newAccountsToReturn.push(newAccount);
  }

  store.setItem('linkedAccounts_' + activeCampaignId, JSON.stringify(accounts));
  return newAccountsToReturn;
 + String.fromCharCode(96);
c = c.slice(0, start) + eval(replacement) + c.slice(end);
fs.writeFileSync(file, c);
