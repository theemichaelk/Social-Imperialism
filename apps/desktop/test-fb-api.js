require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function simulateFBLogin() {
    console.log("Simulating Facebook OAuth Login & Account Discovery...");
    const email = "user@example.com";
    const password = "password123";
    
    // Check if we have a real key to test
    const metaKey = process.env.META_API_KEY;
    if (metaKey) {
        console.log("Detected META_API_KEY. Attempting to fetch real data from Graph API...");
        try {
            console.log("1. Fetching Profile...");
            const profileRes = await fetch(\`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=\${metaKey}\`);
            if(profileRes.ok) console.log("   -> Found Profile:", await profileRes.json());
            
            console.log("2. Fetching Pages...");
            const pagesRes = await fetch(\`https://graph.facebook.com/v19.0/me/accounts?fields=name,id,category,access_token&access_token=\${metaKey}\`);
            if(pagesRes.ok) console.log("   -> Found Pages:", (await pagesRes.json()).data);
            
            console.log("3. Fetching Groups...");
            const groupsRes = await fetch(\`https://graph.facebook.com/v19.0/me/groups?fields=name,id,privacy,icon&access_token=\${metaKey}\`);
            if(groupsRes.ok) console.log("   -> Found Groups:", (await groupsRes.json()).data);
            
            console.log("4. Fetching Business Managers...");
            const bizRes = await fetch(\`https://graph.facebook.com/v19.0/me/businesses?fields=name,id&access_token=\${metaKey}\`);
            if(bizRes.ok) console.log("   -> Found Businesses:", (await bizRes.json()).data);
        } catch(e) {
             console.error("API Error during test:", e.message);
        }
    } else {
        console.log("No META_API_KEY found in .env. Running the intelligent simulation fallback that the user will see:");
        
        let accounts = [
            { platform: 'Facebook', handle: email + ' (Profile)', type: 'Profile', id: Date.now() + 1 },
            { platform: 'Facebook', handle: email.split('@')[0] + ' Official (Page)', type: 'Page', id: Date.now() + 2 },
            { platform: 'Facebook', handle: email.split('@')[0] + ' Support (Page)', type: 'Page', id: Date.now() + 3 },
            { platform: 'Facebook', handle: 'Industry Leaders Forum (Group)', type: 'Group', id: Date.now() + 4 },
            { platform: 'Facebook', handle: 'SaaS & Marketing Network (Group)', type: 'Group', id: Date.now() + 5 },
            { platform: 'Facebook', handle: 'Private Mastermind (Community)', type: 'Community', id: Date.now() + 6 }
        ];
        
        console.table(accounts);
    }
}

simulateFBLogin();