/**
 * Blog image path wiring for every post.
 * Prefer Grok Imagine JPG assets (header/thumb/mid-1/mid-2) when present.
 * Falls back to unique SVG placeholders only when JPGs are missing.
 * Writes under public/blog-images/{slug}/ and patches generatedPosts.ts paths.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..'); // apps/web
const postsPath = path.join(root, 'src/content/blog/generatedPosts.ts');
const outRoot = path.join(root, 'public/blog-images');

const raw = fs.readFileSync(postsPath, 'utf8');
const jsonMatch = raw.match(/export const GENERATED_BLOG_POSTS = (\[[\s\S]*\]);?\s*$/);
if (!jsonMatch) throw new Error('Could not parse GENERATED_BLOG_POSTS');
const posts = JSON.parse(jsonMatch[1]);

const PALETTES = [
  ['#0b1220', '#0ea5e9', '#22d3ee'],
  ['#111827', '#a855f7', '#f472b6'],
  ['#0f172a', '#22c55e', '#86efac'],
  ['#0c1222', '#f59e0b', '#fbbf24'],
  ['#0a1628', '#38bdf8', '#818cf8'],
  ['#120a1a', '#e11d48', '#fb7185'],
  ['#0a1f1a', '#14b8a6', '#5eead4'],
  ['#1a1020', '#c026d3', '#e879f9'],
  ['#0b1a2b', '#3b82f6', '#93c5fd'],
  ['#1c1008', '#ea580c', '#fdba74'],
];

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapTitle(title, max = 42) {
  const words = title.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function makeSvg({ title, silo, kind, idx, variant }) {
  const [bg, a, b] = PALETTES[(idx + variant) % PALETTES.length];
  const lines = wrapTitle(title, kind === 'thumb' ? 28 : 40);
  const w = kind === 'thumb' ? 800 : 1200;
  const h = kind === 'thumb' ? 450 : kind === 'mid' ? 640 : 560;
  const y0 = h * 0.42;
  const textLines = lines
    .map(
      (ln, i) =>
        `<text x="64" y="${y0 + i * (kind === 'thumb' ? 36 : 48)}" fill="#f8fafc" font-family="Segoe UI, system-ui, sans-serif" font-size="${kind === 'thumb' ? 28 : 40}" font-weight="700">${esc(ln)}</text>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="55%" stop-color="${a}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${b}" stop-opacity="0.75"/>
    </linearGradient>
    <radialGradient id="r" cx="80%" cy="20%" r="55%">
      <stop offset="0%" stop-color="${b}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="url(#r)"/>
  <rect x="0" y="0" width="8" height="${h}" fill="${a}"/>
  <text x="64" y="72" fill="${b}" font-family="Segoe UI, system-ui, sans-serif" font-size="18" font-weight="700" letter-spacing="3">${esc(String(silo).toUpperCase())} · NEWS</text>
  ${textLines}
  <text x="64" y="${h - 48}" fill="#94a3b8" font-family="Segoe UI, system-ui, sans-serif" font-size="16">Social Imperialism · AEO / GEO Intelligence</text>
  <circle cx="${w - 120}" cy="${h - 100}" r="54" fill="none" stroke="${a}" stroke-width="2" opacity="0.5"/>
  <circle cx="${w - 90}" cy="110" r="28" fill="none" stroke="${b}" stroke-width="2" opacity="0.4"/>
</svg>`;
}

function hasUsableJpg(filePath) {
  try {
    const st = fs.statSync(filePath);
    return st.isFile() && st.size >= 10000;
  } catch {
    return false;
  }
}

/** Prefer Imagine JPG; fall back to SVG placeholder only if needed. */
function resolveAsset(dir, baseName, svgFallbackWriter) {
  const jpgName = `${baseName}.jpg`;
  const svgName = `${baseName}.svg`;
  const jpgPath = path.join(dir, jpgName);
  if (hasUsableJpg(jpgPath)) {
    return jpgName;
  }
  const svgPath = path.join(dir, svgName);
  fs.writeFileSync(svgPath, svgFallbackWriter());
  return svgName;
}

fs.mkdirSync(outRoot, { recursive: true });
const used = new Set();
const updates = [];
let jpgPosts = 0;
let svgFallbackPosts = 0;

posts.forEach((p, idx) => {
  const dir = path.join(outRoot, p.slug);
  fs.mkdirSync(dir, { recursive: true });

  const thumb = resolveAsset(dir, 'thumb', () =>
    makeSvg({ title: p.title, silo: p.siloLabel, kind: 'thumb', idx, variant: 0 }),
  );
  const header = resolveAsset(dir, 'header', () =>
    makeSvg({ title: p.title, silo: p.siloLabel, kind: 'header', idx, variant: 1 }),
  );
  const mid1 = resolveAsset(dir, 'mid-1', () =>
    makeSvg({ title: p.title, silo: p.siloLabel, kind: 'mid', idx, variant: 2 }),
  );
  const mid2 = resolveAsset(dir, 'mid-2', () =>
    makeSvg({ title: p.title, silo: p.siloLabel, kind: 'mid', idx, variant: 3 }),
  );

  if (thumb.endsWith('.jpg') && header.endsWith('.jpg')) jpgPosts += 1;
  else svgFallbackPosts += 1;

  for (const name of [thumb, header, mid1, mid2]) {
    const rel = `/blog-images/${p.slug}/${name}`;
    used.add(rel);
  }

  updates.push({
    slug: p.slug,
    thumbnail: `/blog-images/${p.slug}/${thumb}`,
    headerImage: `/blog-images/${p.slug}/${header}`,
    midImage1: `/blog-images/${p.slug}/${mid1}`,
    midImage2: `/blog-images/${p.slug}/${mid2}`,
    bottomImage: `/blog-images/${p.slug}/${header}`,
    midImage1Caption: `${p.siloLabel} intelligence visual — unique to this brief.`,
    midImage2Caption: `Field graphic for ${p.keywords?.[0] || p.title}.`,
  });
});

// Patch generatedPosts.ts image fields (preserve body + metadata)
let postsTs = fs.readFileSync(postsPath, 'utf8');
const nextPosts = posts.map((p) => {
  const u = updates.find((x) => x.slug === p.slug);
  return { ...p, ...u };
});
postsTs = `/** Auto-generated blog post metadata (10 live + 25 weekly drip). Prefer Grok Imagine JPGs; re-run generate-blog-images.mjs after adding assets. */
export const GENERATED_BLOG_POSTS = ${JSON.stringify(nextPosts, null, 2)};
`;
fs.writeFileSync(postsPath, postsTs);

console.log('Wired image sets for', posts.length, 'posts');
console.log('Imagine JPG preferred:', jpgPosts, '| SVG fallback posts:', svgFallbackPosts);
console.log('Unique paths used:', used.size);
console.log('Output:', outRoot);
