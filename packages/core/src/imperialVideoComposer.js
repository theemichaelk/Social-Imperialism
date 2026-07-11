/**
 * Imperial Video Composer — FFmpeg render path (OpenMontage-compatible project layout).
 * Produces real MP4 when Grok/Remotion cloud paths are unavailable.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const axios = require('axios');
const { resolveFfmpegBin, resolveOpenMontageRoot, getOpenMontageStatus } = require('./openMontageBridge');

const SI_PROJECTS_ROOT = path.join(__dirname, '../../../data/video-projects');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(text) {
  return String(text || 'video')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'video';
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    client.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return resolve(downloadFile(res.headers.location, dest));
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    }).on('error', (e) => {
      file.close();
      try { fs.unlinkSync(dest); } catch { /* ignore */ }
      reject(e);
    });
  });
}

function escapeDrawtext(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%');
}

function windowsTtsToWav(text, wavPath) {
  if (process.platform !== 'win32') return { success: false, error: 'Windows TTS only on win32' };
  const safe = String(text || '').replace(/'/g, "''").slice(0, 4000);
  const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 0
$s.SetOutputToWaveFile('${wavPath.replace(/'/g, "''")}')
$s.Speak('${safe}')
$s.Dispose()
`;
  const res = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 120000 });
  if (res.status !== 0 || !fs.existsSync(wavPath)) {
    return { success: false, error: res.stderr || 'TTS failed' };
  }
  return { success: true, path: wavPath };
}

function runFfmpeg(args, opts = {}) {
  const bin = resolveFfmpegBin();
  const res = spawnSync(bin, args, { encoding: 'utf8', timeout: opts.timeout || 300000, ...opts });
  return { bin, ...res };
}

function windowsFontFile() {
  const candidates = [
    'C:/Windows/Fonts/arial.ttf',
    'C:/Windows/Fonts/segoeui.ttf',
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function kenBurnsClip(imagePath, outPath, durationSec = 8, caption = '') {
  const d = Math.max(3, durationSec);
  const frames = d * 30;
  const vf = [
    'scale=1920:1080:force_original_aspect_ratio=increase',
    'crop=1920:1080',
    `zoompan=z='min(zoom+0.0008,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=30`,
  ];
  const font = windowsFontFile();
  if (caption && font) {
    vf.push(`drawtext=fontfile='${font.replace(/\\/g, '/')}':text='${escapeDrawtext(caption)}':fontsize=42:fontcolor=white:borderw=3:bordercolor=black@0.6:x=(w-text_w)/2:y=h-120`);
  }
  let res = runFfmpeg([
    '-y', '-loop', '1', '-i', imagePath,
    '-vf', vf.join(','),
    '-t', String(d), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an',
    outPath,
  ]);
  if (res.status !== 0) {
    res = runFfmpeg([
      '-y', '-loop', '1', '-i', imagePath,
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080',
      '-t', String(d), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an',
      outPath,
    ]);
  }
  if (res.status !== 0) throw new Error(res.stderr || `Ken Burns failed for ${imagePath}`);
  return outPath;
}

function concatClipsWithAudio(clips, audioPath, outPath) {
  const listPath = `${outPath}.txt`;
  const lines = clips.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, lines, 'utf8');
  const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listPath];
  if (audioPath && fs.existsSync(audioPath)) args.push('-i', audioPath, '-c:v', 'copy', '-c:a', 'aac', '-shortest');
  else args.push('-c', 'copy');
  args.push(outPath);
  const res = runFfmpeg(args);
  try { fs.unlinkSync(listPath); } catch { /* ignore */ }
  if (res.status !== 0) throw new Error(res.stderr || 'Concat failed');
  return outPath;
}

function ffmpegColorPlate(destPath, caption, color = '0x1e293b') {
  const font = windowsFontFile();
  const vf = font
    ? `drawtext=fontfile='${font.replace(/\\/g, '/')}':text='${escapeDrawtext(caption)}':fontsize=56:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2`
    : 'null';
  const res = runFfmpeg([
    '-y', '-f', 'lavfi', '-i', `color=c=${color}:s=1920x1080:d=1`,
    '-vf', vf,
    '-frames:v', '1', destPath,
  ]);
  if (res.status !== 0) {
    const plain = runFfmpeg(['-y', '-f', 'lavfi', '-i', `color=c=${color}:s=1920x1080:d=1`, '-frames:v', '1', destPath]);
    if (plain.status !== 0) throw new Error(plain.stderr || 'Color plate failed');
  }
  return destPath;
}

async function generateSceneImage(prompt, keys, destPath, sceneIndex = 0) {
  const errors = [];
  const falKey = keys.falKey;
  if (falKey) {
    try {
      const response = await axios.post('https://fal.run/fal-ai/fast-sdxl', {
        prompt,
        num_images: 1,
        image_size: 'landscape_16_9',
        num_inference_steps: 6,
      }, { headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' }, timeout: 90000 });
      const url = response.data?.images?.[0]?.url;
      if (url) {
        await downloadFile(url, destPath);
        return { success: true, source: 'fal-flux', path: destPath };
      }
    } catch (e) { errors.push(`fal: ${e.message}`); }
  }

  const pexelsKey = keys.pexelsKey;
  if (pexelsKey) {
    try {
      const q = String(prompt).split(',')[0].slice(0, 80);
      const res = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=1&orientation=landscape`, {
        headers: { Authorization: pexelsKey },
        timeout: 20000,
      });
      const url = res.data?.photos?.[0]?.src?.large2x || res.data?.photos?.[0]?.src?.large;
      if (url) {
        await downloadFile(url, destPath);
        return { success: true, source: 'pexels', path: destPath };
      }
    } catch (e) { errors.push(`pexels: ${e.message}`); }
  }

  const stockUrls = [
    `https://picsum.photos/seed/si-monkey-${sceneIndex}/1920/1080`,
    `https://placehold.co/1920x1080/1e293b/38bdf8/png?text=Scene+${sceneIndex + 1}`,
  ];
  for (const stockUrl of stockUrls) {
    try {
      await downloadFile(stockUrl, destPath);
      return { success: true, source: 'stock-fallback', path: destPath };
    } catch (e) { errors.push(`stock: ${e.message}`); }
  }

  const caption = String(prompt).split(',')[0].slice(0, 40);
  ffmpegColorPlate(destPath, caption);
  return { success: true, source: 'ffmpeg-placeholder', path: destPath, warnings: errors };
}

const MONKEY_KING_SCENES = [
  {
    caption: 'The Last Monkey King',
    prompt: 'Sun Wukong Monkey King atop mystical mountain, golden crown, cinematic Pixar style, epic clouds, 16:9',
    narration: 'In the highest halls of Heaven, one king ruled the clouds — Sun Wukong, the Monkey King.',
  },
  {
    caption: 'Heaven Trembles',
    prompt: 'Monkey King fighting celestial army in jade palace, chaotic epic fantasy, cinematic lighting, 16:9',
    narration: 'His staff could shake the sky. His rebellion could not be ignored.',
  },
  {
    caption: 'Banquet of Defiance',
    prompt: 'Monkey King crashing heavenly feast, overturned tables, divine anger, animated epic, 16:9',
    narration: 'He shattered banquet halls and laughed at their thrones.',
  },
  {
    caption: 'The Celestial Verdict',
    prompt: 'Jade Emperor on throne sentencing monkey king, divine court, dramatic fantasy art, 16:9',
    narration: 'The Jade Emperor called every god to arms — yet still they feared him.',
  },
  {
    caption: 'Cast Out of Paradise',
    prompt: 'Monkey King falling from heaven through clouds, exile, tragic epic fantasy, 16:9',
    narration: 'So the Celestial Court cast him out — stripped of his title, hurled from paradise.',
  },
  {
    caption: 'Why He Fell',
    prompt: 'Lone Monkey King on earthly cliff at sunset, reflective mood, cinematic, 16:9',
    narration: 'The last Monkey King fell not because he was weak… but because Heaven feared what he had become.',
  },
];

async function composeMonkeyKingVideo({ keys = {}, projectId = 'last-monkey-king', publicCopyDir } = {}) {
  const omRoot = resolveOpenMontageRoot();
  const base = omRoot
    ? path.join(omRoot, 'projects', projectId)
    : path.join(SI_PROJECTS_ROOT, projectId);
  const assetsDir = path.join(base, 'assets/images');
  const rendersDir = path.join(base, 'renders');
  const clipsDir = path.join(base, 'assets/video');
  ensureDir(assetsDir);
  ensureDir(rendersDir);
  ensureDir(clipsDir);

  const narration = MONKEY_KING_SCENES.map((s) => s.narration).join(' ');
  const audioPath = path.join(base, 'assets/audio/narration.wav');
  ensureDir(path.dirname(audioPath));
  const tts = windowsTtsToWav(narration, audioPath);

  const clips = [];
  for (let i = 0; i < MONKEY_KING_SCENES.length; i += 1) {
    const scene = MONKEY_KING_SCENES[i];
    const imgPath = path.join(assetsDir, `scene-${i + 1}.jpg`);
    await generateSceneImage(scene.prompt, keys, imgPath, i);
    const clipPath = path.join(clipsDir, `scene-${i + 1}.mp4`);
    kenBurnsClip(imgPath, clipPath, 10, scene.caption);
    clips.push(clipPath);
  }

  const finalPath = path.join(rendersDir, 'final.mp4');
  concatClipsWithAudio(clips, tts.success ? audioPath : null, finalPath);

  let publicUrl = null;
  if (publicCopyDir) {
    ensureDir(publicCopyDir);
    const pubPath = path.join(publicCopyDir, 'last-monkey-king.mp4');
    fs.copyFileSync(finalPath, pubPath);
    publicUrl = '/videos/last-monkey-king.mp4';
  }

  fs.writeFileSync(path.join(base, 'project.json'), JSON.stringify({
    id: projectId,
    title: 'The Last Monkey King',
    pipeline: 'character-short',
    openMontageProject: !!omRoot,
    createdAt: new Date().toISOString(),
  }, null, 2), 'utf8');

  return {
    success: true,
    status: 'complete',
    runtime: omRoot ? 'openmontage-layout+ffmpeg' : 'si-ffmpeg-compose',
    projectId,
    projectPath: base,
    outputPath: finalPath,
    publicUrl,
    durationSec: MONKEY_KING_SCENES.length * 10,
    scenes: MONKEY_KING_SCENES.length,
    narration: tts.success,
    message: 'Rendered final.mp4 — OpenMontage-compatible project layout',
  };
}

async function composeImperialVideo(payload = {}, deps = {}) {
  const status = getOpenMontageStatus();
  if (!status.ffmpeg) {
    return {
      success: false,
      error: 'FFmpeg required for video render. Install: winget install Gyan.FFmpeg',
      openMontage: status,
    };
  }

  const keys = deps.keys || payload.keys || {};
  const template = payload.template || payload.projectTemplate;

  if (template === 'last-monkey-king' || /monkey\s*king/i.test(payload.brief || payload.topic || '')) {
    const publicDir = payload.publicCopyDir || deps.publicCopyDir;
    return composeMonkeyKingVideo({ keys, publicCopyDir: publicDir });
  }

  const brief = payload.brief || payload.topic || 'Social Imperialism video';
  const projectId = slugify(payload.projectId || brief);
  const omRoot = resolveOpenMontageRoot();
  const base = omRoot ? path.join(omRoot, 'projects', projectId) : path.join(SI_PROJECTS_ROOT, projectId);
  ensureDir(path.join(base, 'renders'));

  const placeholder = path.join(base, 'renders', 'compose-queued.json');
  fs.writeFileSync(placeholder, JSON.stringify({
    brief,
    pipelineId: payload.pipelineId,
    runtime: payload.runtime || 'ffmpeg-kenburns',
    status: 'needs_asset_generation',
    hint: 'Run full pipeline then compose with template last-monkey-king, or add FAL_KEY for scene images',
    openMontage: status,
  }, null, 2), 'utf8');

  return {
    success: true,
    status: 'queued',
    runtime: payload.runtime || 'design-compositor',
    projectPath: base,
    openMontage: status,
    message: status.ready
      ? 'OpenMontage runtime detected — use template "last-monkey-king" or character-short pipeline for MP4 output.'
      : 'Composition project initialized. Install OpenMontage runtime (deploy/setup-openmontage.ps1) + FAL_KEY for Last Banana-quality motion clips.',
    outputPath: null,
  };
}

module.exports = {
  MONKEY_KING_SCENES,
  composeImperialVideo,
  composeMonkeyKingVideo,
  kenBurnsClip,
  concatClipsWithAudio,
};