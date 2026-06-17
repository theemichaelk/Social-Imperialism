require('../services/proxyManager');
require('../services/accountCreator');
const { extractYouTubeVideoId } = require('../services/accountCreator');

const id = extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
if (id !== 'dQw4w9WgXcQ') throw new Error('YouTube ID parse failed');
console.log('account-creator modules OK');