const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '../..');
const BUCKET = 'social-imperialism';
const REGION = 'us-east-1';

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: true, ...opts });
}

function awsS3(args) {
  run(`aws s3 ${args} --region ${REGION}`);
}

console.log('=== Social Imperialism — full deploy ===\n');

// 1) Static export first (writes out/, must run before production .next)
console.log('Step 1: Static export (out/)');
run('node scripts/build-export.js', { cwd: ROOT });

// 2) Production .next build (SSR / Amplify) — after export so .next is production mode
console.log('\nStep 2: Production Next.js build (.next)');
run('npm run build', { cwd: ROOT });

if (!fs.existsSync(path.join(ROOT, '.next'))) {
  console.error('ERROR: .next folder missing after build');
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, 'out'))) {
  console.error('ERROR: out/ folder missing after static export');
  process.exit(1);
}

// 3) Upload production web layer for Amplify (pull + npm start)
console.log('\nStep 3: Upload builds/web/ (Amplify layer)');
const buildFiles = [
  'package.json',
  'next.config.js',
  'tsconfig.json',
  'next-env.d.ts',
  'public',
  'src',
  '.next',
  'scripts',
];
for (const f of buildFiles) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) {
    if (f === 'package-lock.json') continue;
    console.warn(`  skip missing: ${f}`);
    continue;
  }
  const dest = `s3://${BUCKET}/builds/web/${f}`;
  if (fs.statSync(src).isDirectory()) {
    awsS3(`sync "${src}" ${dest} --delete`);
  } else {
    awsS3(`cp "${src}" ${dest}`);
  }
}

// Repo-level Amplify config
awsS3(`cp "${path.join(REPO, 'amplify.yml')}" s3://${BUCKET}/builds/amplify.yml`);
awsS3(`cp "${path.join(REPO, 'package.json')}" s3://${BUCKET}/builds/package.json`);
awsS3(`cp "${path.join(REPO, 'package-lock.json')}" s3://${BUCKET}/builds/package-lock.json`);

// 4) Upload static assets for CloudFront
console.log('\nStep 4: Upload static/ (CloudFront + S3 website)');
awsS3(`sync "${path.join(ROOT, 'out')}" s3://${BUCKET}/static/ --delete`);

// Mirror static to bucket root for direct S3 website access (no --delete: preserves builds/)
console.log('\nStep 5: Mirror static/ to bucket root (S3 website endpoint)');
awsS3(`sync "${path.join(ROOT, 'out')}" s3://${BUCKET}/`);

console.log('\n=== Deploy complete ===');
console.log(`S3 website:  http://${BUCKET}.s3-website-${REGION}.amazonaws.com/`);
console.log(`Static CDN:  s3://${BUCKET}/static/`);
console.log(`Amplify src: s3://${BUCKET}/builds/web/ (.next included)`);