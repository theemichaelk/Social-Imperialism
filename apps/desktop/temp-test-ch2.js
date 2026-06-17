const fs = require('fs');
let html = fs.readFileSync('content-hub.html', 'utf8');

// It's possible the logic around \`originalLoadAccounts\` is looping infinitely or throwing an error in electron.
// Let's remove the patching approach and just unify the account loading logic cleanly.
const jsBlock = html.split('<script>')[1].split('</script>')[0];

console.log('originalLoadAccounts references:', jsBlock.match(/originalLoadAccounts/g)?.length);