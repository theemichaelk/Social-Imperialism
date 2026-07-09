/**
 * Verify blog article word counts (target: 1450–1550 words each).
 * Run: node count-words.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const articlesPath = path.join(__dirname, 'src/content/blog/articles.ts');
const postsPath = path.join(__dirname, 'src/lib/blogPosts.ts');

const MIN = 1450;
const MAX = 1550;

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function extractSlugs(postsSrc) {
  return [...postsSrc.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
}

function extractParagraphsForSlug(src, slug) {
  const slugIdx = src.indexOf(`'${slug}':`);
  if (slugIdx < 0) return [];
  const nextSlug = src.slice(slugIdx + slug.length + 3).search(/\n\s*'[a-z0-9-]+':\s*\{/);
  const block = nextSlug >= 0 ? src.slice(slugIdx, slugIdx + slug.length + 3 + nextSlug) : src.slice(slugIdx);
  return [...block.matchAll(/paragraphs:\s*\[([\s\S]*?)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/'((?:\\'|[^'])*)'/g)].map((p) => p[1].replace(/\\'/g, "'")));
}

const postsSrc = fs.readFileSync(postsPath, 'utf8');
const articlesSrc = fs.readFileSync(articlesPath, 'utf8');
const slugs = extractSlugs(postsSrc);

let fail = 0;
console.log('\n=== Blog word count audit ===\n');

for (const slug of slugs) {
  const paragraphs = extractParagraphsForSlug(articlesSrc, slug);
  const words = paragraphs.reduce((n, p) => n + countWords(p), 0);
  const ok = words >= MIN && words <= MAX;
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${slug}: ${words} words${ok ? '' : ` (target ${MIN}–${MAX})`}`);
  if (!ok) fail++;
}

console.log(`\n${fail === 0 ? 'PASS' : `FAIL (${fail} articles out of range)`}\n`);
process.exit(fail > 0 ? 1 : 0);