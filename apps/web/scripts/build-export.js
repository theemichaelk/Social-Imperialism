const { execSync } = require('child_process');

process.env.STATIC_EXPORT = '1';
execSync('npx next build', { stdio: 'inherit', env: process.env, shell: true, cwd: require('path').resolve(__dirname, '..') });