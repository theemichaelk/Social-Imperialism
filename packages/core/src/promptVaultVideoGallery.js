/**
 * OpenMontage Prompt Gallery — seeded into Prompt Vault (feature: video-studio).
 * Source: vendor/OpenMontage/PROMPT_GALLERY.md
 */

function formatEstimatedTime(minutes) {
  const m = String(minutes || '').trim();
  if (!m) return '';
  if (m === 'instant') return 'instant';
  if (/minutes?$/i.test(m)) return m;
  if (/\bmin\b/i.test(m)) return m.replace(/\bmin\b/gi, 'minutes');
  return `${m} minutes`;
}

function galleryPrompt({
  id,
  title,
  body,
  keywords = [],
  tags = [],
  pipeline = '',
  tier = 'Zero-Key',
  cost = '$0',
  minutes = '',
  deliverable = '',
  setupNote = '',
  seedRevision = 1,
}) {
  const headerLines = [
    `[OpenMontage Prompt Gallery — ${tier}]${pipeline ? ` · Pipeline: ${pipeline}` : ''}`,
  ];
  const timeCost = [
    minutes ? `Estimated time: ${formatEstimatedTime(minutes)}` : null,
    `Cost: ${cost}`,
  ].filter(Boolean).join(' | ');
  if (timeCost) headerLines.push(timeCost);
  const header = headerLines.join('\n');
  const footer = deliverable ? `\n\nWhat you get: ${deliverable}` : '';
  const setup = setupNote
    ? `\n\nSetup: ${setupNote}`
    : '\n\nSetup: make setup or deploy/setup-openmontage.ps1. Rule zero: pick pipeline → read manifest → stage skill → use tools.';
  return {
    id,
    title,
    body: `${header}\n\n${body.trim()}${footer}${setup}`,
    keywords: ['openmontage', 'video', 'prompt gallery', ...keywords],
    feature: 'video-studio',
    platform: 'OpenMontage',
    tags: ['gallery', 'video-studio', ...tags],
    galleryTier: tier,
    estimatedCost: cost,
    estimatedMinutes: minutes,
    pipeline,
    deliverable,
    seedRevision,
  };
}

const VIDEO_PROMPT_GALLERY_SEED = [
  galleryPrompt({
    id: 'pv_skill_video_demo_commands',
    title: 'Zero-key demos — render all (CLI)',
    body: `Instant Remotion demos — animated charts, typography, data viz. No API keys.

macOS/Linux:
  make demo
  make demo-list
  ./render-demo.sh world-in-numbers

Windows (vendor/OpenMontage, venv active):
  python render_demo.py
  python render_demo.py --list
  python render_demo.py world-in-numbers`,
    keywords: ['demo', 'remotion', 'make demo', 'render-demo', 'zero-key'],
    tags: ['zero-key-demo', 'cli', 'remotion'],
    tier: 'Zero-Key Demo',
    cost: '$0',
    minutes: 'instant',
    deliverable: 'Pre-built compositions: world-in-numbers (45s), code-to-screen (50s), focusflow-pitch (40s).',
    setupNote: 'FFmpeg + Node + remotion-composer from make setup.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_demo_world_in_numbers',
    title: 'Demo: world-in-numbers (45s)',
    body: 'Render the world-in-numbers zero-key demo — KPI grids, bar charts, pie charts, line charts, comparison cards, stat reveals.',
    keywords: ['world-in-numbers', 'charts', 'kpi', 'demo'],
    tags: ['zero-key-demo'],
    tier: 'Zero-Key Demo',
    pipeline: 'remotion demo',
    minutes: '~2 min render',
    deliverable: '45s Remotion data story with charts and stat reveals.',
    setupNote: './render-demo.sh world-in-numbers or python render_demo.py world-in-numbers',
  }),
  galleryPrompt({
    id: 'pv_skill_video_demo_code_to_screen',
    title: 'Demo: code-to-screen (50s)',
    body: 'Render the code-to-screen zero-key demo — developer education: HTTP request lifecycle with progress bars, charts, callouts.',
    keywords: ['code-to-screen', 'developer', 'http', 'demo'],
    tags: ['zero-key-demo'],
    tier: 'Zero-Key Demo',
    minutes: '~2 min render',
    deliverable: '50s developer workflow explainer from Remotion components only.',
    setupNote: './render-demo.sh code-to-screen or python render_demo.py code-to-screen',
  }),
  galleryPrompt({
    id: 'pv_skill_video_demo_focusflow_pitch',
    title: 'Demo: focusflow-pitch (40s)',
    body: 'Render the focusflow-pitch zero-key demo — startup pitch deck with traction metrics, revenue donut chart, customer testimonial.',
    keywords: ['focusflow', 'pitch', 'startup', 'demo'],
    tags: ['zero-key-demo'],
    tier: 'Zero-Key Demo',
    minutes: '~2 min render',
    deliverable: '40s startup-style pitch from Remotion components only.',
    setupNote: './render-demo.sh focusflow-pitch or python render_demo.py focusflow-pitch',
  }),
  galleryPrompt({
    id: 'pv_skill_video_zero_sky_blue_data',
    title: 'Data explainer — why the sky is blue',
    body: 'Make a 45-second animated explainer about why the sky is blue. Use data visualization and animated text — no images needed, just charts, stat cards, and typography.',
    keywords: ['sky', 'blue', 'data viz', 'explainer', 'charts'],
    tags: ['zero-key', 'explainer'],
    tier: 'Zero-Key',
    pipeline: 'social-explainer',
    minutes: '5-10 min',
    deliverable: 'Research-grounded script, Piper narration, Remotion text cards, stat reveals, callout boxes, subtitles.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_zero_coffee',
    title: 'Quick fact — coffee consumption worldwide',
    body: 'Create a 60-second data-driven video about coffee consumption around the world. Include bar charts comparing countries and a pie chart of coffee types.',
    keywords: ['coffee', 'data', 'bar chart', 'pie chart', 'facts'],
    tags: ['zero-key', 'data'],
    tier: 'Zero-Key',
    pipeline: 'social-explainer',
    minutes: '8-12 min',
    deliverable: 'Animated data viz with charts, comparison cards, narrated facts from research stage.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_zero_internet',
    title: 'History explainer — how the internet works',
    body: 'Make a short explainer about how the internet works, with narration and animated captions. Keep it under 60 seconds.',
    keywords: ['internet', 'history', 'captions', 'explainer'],
    tags: ['zero-key', 'explainer'],
    tier: 'Zero-Key',
    pipeline: 'social-explainer',
    minutes: '8-12 min',
    deliverable: 'Section titles, text cards, stat reveals, TikTok-style word-by-word captions synced to narration.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_zero_git_rebase',
    title: 'Developer education — Git rebase vs merge',
    body: 'Create a 90-second animated explainer about how Git rebase works. Use animated diagrams and comparison cards to show rebase vs merge. Target audience: junior developers.',
    keywords: ['git', 'rebase', 'merge', 'developer', 'diagram'],
    tags: ['zero-key', 'developer'],
    tier: 'Zero-Key',
    pipeline: 'social-explainer',
    minutes: '10-15 min',
    deliverable: 'Comparison cards (rebase vs merge), callout tips, step-by-step animated text, developer-friendly narration.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_one_crispr',
    title: 'Science explainer — CRISPR (FAL visuals)',
    body: 'Create an animated explainer about how CRISPR gene editing works, with AI-generated visuals of DNA and cell diagrams. Make it 90 seconds, educational but exciting.',
    keywords: ['crispr', 'science', 'dna', 'flux', 'fal'],
    tags: ['one-key', 'fal-key', 'science'],
    tier: 'One-Key (FAL_KEY)',
    pipeline: 'social-explainer',
    cost: '~$0.80',
    minutes: '15-20 min',
    deliverable: 'Research script, FLUX images with Ken Burns, spring transitions, narration, subtitles, music.',
    setupNote: 'FAL_KEY in .env — FLUX image generation.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_one_aquapulse',
    title: 'Product teaser — AquaPulse water bottle',
    body: 'Make a product launch teaser for a fictional smart water bottle called AquaPulse. 45 seconds, modern and minimal, with AI-generated product shots.',
    keywords: ['product', 'launch', 'teaser', 'aquapulse', 'flux'],
    tags: ['one-key', 'fal-key', 'product'],
    tier: 'One-Key (FAL_KEY)',
    pipeline: 'kinetic-promo',
    cost: '~$0.60',
    minutes: '12-18 min',
    deliverable: 'Cinematic product teaser, FLUX product shots, stat reveals, comparison cards, punchy close.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_one_color_marketing',
    title: 'Marketing explainer — color psychology',
    body: 'Build a 90-second explainer about the psychology of color in marketing. Use AI-generated images showing color associations and include data about color impact on purchasing decisions.',
    keywords: ['color', 'psychology', 'marketing', 'flux'],
    tags: ['one-key', 'fal-key', 'marketing'],
    tier: 'One-Key (FAL_KEY)',
    pipeline: 'social-explainer',
    cost: '~$1.00',
    minutes: '15-20 min',
    deliverable: 'Color psychology illustrations, bar/pie charts, narrated research insights.',
    setupNote: 'FAL_KEY in .env.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_anime_ghibli_library',
    title: 'Anime — Ghibli floating library',
    body: 'Create a 30-second Ghibli-style animated video of a magical floating library in the clouds at golden hour. Books drift between shelves, warm light streams through stained glass windows, and a small cat naps on a reading desk.',
    keywords: ['ghibli', 'anime', 'library', 'animation', 'fal'],
    tags: ['animation', 'anime', 'one-key', 'image-animation'],
    tier: 'Animation (~$0.15)',
    pipeline: 'cinematic-teaser',
    cost: '~$0.15',
    minutes: '10-15 min',
    deliverable: '6 anime scenes, 12 FLUX stills, camera motion, sparkle/light particles, vignette, hero title, ambient music.',
    setupNote: 'FAL_KEY — Animation pipeline image_animation (no video gen APIs).',
  }),
  galleryPrompt({
    id: 'pv_skill_video_anime_underwater',
    title: 'Anime — underwater temple',
    body: 'Make a 30-second anime-style animation of an underwater temple with bioluminescent coral, ancient ruins covered in sea moss, luminous jellyfish drifting past stone pillars, and shafts of sunlight piercing the deep blue.',
    keywords: ['underwater', 'anime', 'temple', 'ocean', 'animation'],
    tags: ['animation', 'anime', 'one-key'],
    tier: 'Animation (~$0.15)',
    pipeline: 'cinematic-teaser',
    cost: '~$0.15',
    minutes: '10-15 min',
    deliverable: 'Ocean atmosphere, mist/sparkle particles, pan/drift camera, blue-green lighting, section titles, ambient soundtrack.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_anime_seasons',
    title: 'Anime — four seasons village',
    body: 'Create a 30-second Ghibli-style animated video showing the four seasons in a Japanese countryside village — cherry blossoms in spring, fireflies in summer, red maple leaves in autumn, and snow-covered thatched roofs in winter.',
    keywords: ['seasons', 'ghibli', 'village', 'japan', 'animation'],
    tags: ['animation', 'anime', 'one-key'],
    tier: 'Animation (~$0.15)',
    pipeline: 'cinematic-teaser',
    cost: '~$0.15',
    minutes: '10-15 min',
    deliverable: 'Seasonal particle transitions (petals, fireflies, mist), warm-to-cool lighting, ambient soundtrack.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_anime_steampunk',
    title: 'Anime — steampunk cityscape',
    body: 'Make a 30-second anime-style animation of a steampunk city at dusk — airships floating between brass towers, steam rising from street vents, clockwork birds perching on copper lampposts, and a lone inventor walking home through cobblestone streets.',
    keywords: ['steampunk', 'anime', 'city', 'animation'],
    tags: ['animation', 'anime', 'one-key'],
    tier: 'Animation (~$0.15)',
    pipeline: 'cinematic-teaser',
    cost: '~$0.15',
    minutes: '10-15 min',
    deliverable: 'Industrial-fantasy particles, parallax/zoom camera, warm amber lighting, steampunk ambient soundtrack.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_hf_cortex_launch',
    title: 'HyperFrames — Cortex product launch',
    body: "Make a 20-second product launch video for a new AI coding assistant called 'Cortex'. Big kinetic typography, three feature callouts, a bold accent color, and a final CTA card. Use the HyperFrames runtime.",
    keywords: ['hyperframes', 'kinetic', 'product launch', 'cortex', 'gsap'],
    tags: ['hyperframes', 'zero-key', 'motion-graphics'],
    tier: 'HyperFrames (zero-key)',
    pipeline: 'kinetic-promo',
    minutes: '3-5 min',
    deliverable: 'HTML/GSAP composition, word reveals, staggered callouts, lint/validate gates before render.',
    setupNote: 'Node.js ≥ 22, FFmpeg, npx hyperframes (not @hyperframes/cli).',
  }),
  galleryPrompt({
    id: 'pv_skill_video_hf_website_teaser',
    title: 'HyperFrames — website → video teaser',
    body: "Here's my landing page URL: {{domain}}. Make me a 15-second social ad for Instagram. Use HyperFrames and pick up the site's real colors and typography.",
    keywords: ['website-to-video', 'hyperframes', 'instagram', 'social ad'],
    tags: ['hyperframes', 'zero-key', 'website'],
    tier: 'HyperFrames (zero-key)',
    pipeline: 'kinetic-promo',
    cost: '$0 (or ~$0.05 premium TTS)',
    minutes: '8-12 min',
    deliverable: 'Site capture → DESIGN.md → storyboard → GSAP timelines → lint → render.',
    setupNote: 'Replace {{domain}} with your URL on Load. Node 22+, FFmpeg, npx hyperframes.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_hf_launch_reel_blocks',
    title: 'HyperFrames — launch reel + registry blocks',
    body: 'Create a 25-second launch reel for a developer tools startup. Include a data chart block (user growth from HyperFrames registry), kinetic title cards, and a shader transition between scenes.',
    keywords: ['hyperframes', 'registry', 'data-chart', 'launch reel', 'shader'],
    tags: ['hyperframes', 'zero-key', 'registry'],
    tier: 'HyperFrames (zero-key)',
    pipeline: 'kinetic-promo',
    minutes: '8-12 min',
    deliverable: 'hyperframes add data-chart + shader-transition blocks wired into composition with GSAP timelines.',
    setupNote: 'Registry blocks are HyperFrames-only. npx hyperframes add …',
  }),
  galleryPrompt({
    id: 'pv_skill_video_full_scifi_trailer',
    title: 'Broadcast — cinematic sci-fi trailer',
    body: 'Create a cinematic 30-second trailer for a sci-fi concept: humanity receives a warning from 1000 years in the future. Use motion video clips, a cinematic soundtrack, and dramatic title cards.',
    keywords: ['sci-fi', 'trailer', 'cinematic', 'veo', 'kling', 'runway', 'broadcast'],
    tags: ['broadcast', 'motion-clips', 'cinematic'],
    tier: 'Broadcast Quality',
    pipeline: 'cinematic-teaser',
    cost: '~$2.50',
    minutes: '25-40',
    deliverable: 'Veo/Kling-generated motion clips, cinematic title cards with signal texture effects, Hans Zimmer-style soundtrack, and dramatic pacing.',
    setupNote: 'Video gen: FAL_KEY or HEYGEN_API_KEY (Veo, Kling, Runway). Music: Suno or ElevenLabs. FFmpeg + Remotion compose.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_full_quantum_soundtrack',
    title: 'Broadcast — quantum computing explainer (premium)',
    body: 'Make a 90-second animated explainer about quantum computing for middle school students. Use a fun narrator voice, custom soundtrack, and AI-generated visuals of qubits and quantum gates.',
    keywords: ['quantum', 'education', 'elevenlabs', 'suno', 'flux', 'broadcast', 'explainer'],
    tags: ['broadcast', 'explainer', 'premium'],
    tier: 'Broadcast Quality',
    pipeline: 'social-explainer',
    cost: '~$2.00',
    minutes: '20-30',
    deliverable: 'Full production: ElevenLabs narration, FLUX visuals, Suno soundtrack, Remotion composition with animated charts and text overlays.',
    setupNote: 'FAL_KEY (FLUX), ELEVENLABS_API_KEY (voice), Suno/music tool for soundtrack. FFmpeg + Remotion.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_broadcast_avatar_rebrand',
    title: 'Broadcast — avatar spokesperson rebrand',
    body: 'Create a 60-second avatar spokesperson video announcing a company rebrand. Professional tone, clean background, with animated text overlays showing the new brand values.',
    keywords: ['avatar', 'heygen', 'spokesperson', 'rebrand', 'broadcast', 'corporate'],
    tags: ['broadcast', 'avatar', 'presenter'],
    tier: 'Broadcast Quality',
    pipeline: 'avatar-presenter',
    cost: '~$1.50',
    minutes: '15-25',
    deliverable: 'HeyGen avatar video with TTS narration, overlaid section titles, stat reveals, and branded text cards.',
    setupNote: 'HEYGEN_API_KEY for avatar video. Optional ELEVENLABS_API_KEY for premium voice. Remotion for overlays.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_full_brand_film',
    title: 'Full setup — premium brand film',
    body: 'Produce a 45-second brand film for {{brandName}} — mood-led visuals, motion clips between hero moments, kinetic typography for the tagline, and a closing CTA to {{domain}}.',
    keywords: ['brand film', 'premium', 'motion clips', 'launch', 'full setup'],
    tags: ['full-setup', 'brand', 'kinetic-promo'],
    tier: 'Full Setup (~$1–$3)',
    pipeline: 'kinetic-promo',
    cost: '~$1.50–$3.00',
    minutes: '25-40',
    deliverable: 'Proposal with render_runtime choice, FLUX/Kling assets, Remotion or HyperFrames compose, graded master with subtitles.',
    setupNote: 'FAL_KEY required for motion clips. {{brandName}} and {{domain}} resolve on Load from active campaign.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_audience_photosynthesis_teachers',
    title: 'For teachers — photosynthesis (8th grade)',
    body: 'Create a 3-minute animated explainer about photosynthesis for 8th graders. Make it fun and visual — use diagrams, charts showing energy conversion, and a friendly narrator voice.',
    keywords: ['photosynthesis', 'teachers', 'education', '8th grade', 'diagrams', 'charts'],
    tags: ['audience', 'teachers', 'explainer'],
    tier: 'For Specific Audiences',
    pipeline: 'social-explainer',
    cost: '$0–$2.00',
    minutes: '15-25',
    deliverable: 'Age-appropriate script, labeled diagrams, energy-conversion charts, friendly Piper or premium narration, subtitles.',
    setupNote: 'Mention audience in brief — pacing and vocabulary shift for 8th graders. Zero-key path: Piper + Remotion only.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_audience_rest_api_devadvocate',
    title: 'For developer advocates — REST API demo',
    body: 'Make a 60-second product demo video for our new REST API. Show the request/response flow with animated diagrams, include latency benchmarks as bar charts, and end with a quick start code snippet.',
    keywords: ['rest api', 'developer advocate', 'demo', 'bar charts', 'diagram', 'code snippet'],
    tags: ['audience', 'dev-advocate', 'developer'],
    tier: 'For Specific Audiences',
    pipeline: 'social-explainer',
    cost: '$0–$1.50',
    minutes: '12-20',
    deliverable: 'HTTP lifecycle diagram, latency bar charts, comparison/callout cards, code snippet overlay, developer-friendly narration.',
    setupNote: 'Request bar charts + comparison cards by name. Target junior developers for tone calibration.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_audience_okr_producthunt',
    title: 'For indie hackers — Product Hunt OKR launch',
    body: 'Create a 30-second Product Hunt launch video for my SaaS tool that helps teams track OKRs. Show 3 key features with animated stat cards and comparison views. Upbeat, modern.',
    keywords: ['product hunt', 'indie hacker', 'okr', 'saas', 'launch', 'stat cards'],
    tags: ['audience', 'indie-hacker', 'launch'],
    tier: 'For Specific Audiences',
    pipeline: 'kinetic-promo',
    cost: '$0–$1.00',
    minutes: '10-18',
    deliverable: 'Three feature beats with stat cards, comparison views, kinetic title, upbeat pacing, CTA close.',
    setupNote: 'Specify 30s duration (~75 words narration). HyperFrames or Remotion kinetic-promo pipeline.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_audience_blog_to_video',
    title: 'For content creators — blog post to video',
    body: 'Take my recent blog post about AI trends in 2026 and turn it into a 90-second video. Research current data to ground it, use animated charts for the statistics, and add a conversational narrator.',
    keywords: ['blog', 'content creator', 'repurpose', 'ai trends', 'charts', 'research'],
    tags: ['audience', 'content-creator', 'repurpose'],
    tier: 'For Specific Audiences',
    pipeline: 'social-explainer',
    cost: '$0–$1.50',
    minutes: '15-25',
    deliverable: 'Web research brief with citations, animated stat charts, conversational narration (~225 words), subtitles.',
    setupNote: 'Paste blog URL or summary in brief after Load. Research stage grounds facts before script.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_tips_better_results',
    title: 'Tips for better video results',
    body: `Reference guide — apply these when briefing Video Studio or your AI coding assistant:

• Be specific about visual components. Instead of "make it look good," say "use bar charts for the comparison, a donut chart for the breakdown, and stat cards for the key numbers."

• Mention your target audience. "For junior developers" or "for 8th graders" dramatically changes script, pacing, and visual style.

• Specify duration. The agent optimizes content density from target length. 45 seconds ≈ 110 words narration; 90 seconds ≈ 225 words.

• Request specific chart types. Available: bar charts, line charts, pie/donut charts, KPI grids, progress bars, comparison cards, and callout boxes. Name the ones you want.

• Ask for the zero-key path. Say "use only free tools" or "no paid APIs" to route Piper TTS, stock media, and Remotion-only compositions.

• For anime/Ghibli-style videos, mention the style explicitly ("Ghibli-style" or "anime-style"). Describe atmosphere, lighting, and mood. The Animation pipeline uses FLUX stills + Remotion anime scene engine — crossfade, camera motion, particle overlays (~$0.15 for 30 seconds).`,
    keywords: ['tips', 'guide', 'charts', 'duration', 'audience', 'zero-key', 'ghibli'],
    tags: ['gallery-guide', 'tips', 'reference'],
    tier: 'Tips for Better Results',
    pipeline: '',
    cost: 'reference',
    minutes: '',
    deliverable: 'Checklist for stronger briefs — visual specificity, audience, duration, chart types, zero-key routing, anime style.',
    setupNote: 'Load into brief as constraints alongside your topic, or keep open while authoring a new vault template.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_arch_how_it_works',
    title: 'How OpenMontage works — agent orchestration flow',
    body: `OpenMontage uses an agent-first architecture. There is no code orchestrator. Your AI coding assistant IS the orchestrator.

You: "Make an explainer video about how black holes form"
  → Agent reads pipeline manifest (YAML) — stages, tools, review criteria, success gates
  → Agent reads stage director skill (Markdown) — HOW to execute each stage
  → Agent calls Python tools — scored provider selection ranks every tool across 7 dimensions
  → Agent self-reviews using reviewer skill — schema validation, playbook compliance, quality checks
  → Agent checkpoints state (JSON) — resumable, with decision log and cost snapshot
  → Agent presents for your approval — you stay in control at every creative decision
  → Pre-compose validation gate — delivery promise, slideshow risk, renderer governance
  → Render (Remotion or FFmpeg) — composition engine matched to visual grammar
  → Post-render self-review — ffprobe, frame extraction, audio analysis, promise verification
  → Final video output — only if self-review passes

Python provides tools and persistence. Creative decisions, orchestration logic, review criteria, and quality standards live in readable instruction files (YAML manifests + Markdown skills) you can inspect and customize. Every decision is logged with alternatives considered, confidence scores, and reasoning.`,
    keywords: ['how it works', 'agent-first', 'orchestrator', 'manifest', 'checkpoint', 'reviewer', 'architecture'],
    tags: ['architecture', 'reference', 'gallery-guide', 'agent'],
    tier: 'How OpenMontage Works',
    pipeline: '',
    cost: 'reference',
    minutes: '',
    deliverable: 'End-to-end agent flow from user brief → manifest → skills → tools → review → checkpoint → approval → render → post-review → deliverable.',
    setupNote: 'SI mirror: brain/skills/video-studio/ + get-imperial-video-studio-config. OM source: vendor/OpenMontage/AGENT_GUIDE.md',
  }),
  galleryPrompt({
    id: 'pv_skill_video_arch_repo_layers',
    title: 'OpenMontage architecture — repo layout & three layers',
    body: `OpenMontage/
├── tools/              # 48 Python tools (the agent's hands)
│   ├── video/          # 13 video gen tools + compose, stitch, trim
│   ├── audio/          # 4 TTS providers + Suno/ElevenLabs music, mixing, enhancement
│   ├── graphics/       # 9 image/graphics generation tools + diagrams, code snippets, math
│   ├── enhancement/    # Upscale, bg remove, face enhance, color grade
│   ├── analysis/       # Transcription, scene detect, frame sampling
│   ├── avatar/         # Talking head, lip sync
│   └── subtitle/       # SRT/VTT generation
├── pipeline_defs/      # YAML pipeline manifests (the agent's playbook)
├── skills/             # Markdown skill files (the agent's knowledge)
│   ├── pipelines/      # Per-pipeline stage director skills
│   ├── creative/       # Creative technique skills
│   ├── core/           # Core tool skills
│   └── meta/           # Reviewer, checkpoint protocol
├── schemas/            # 15 JSON Schemas (contract validation)
├── styles/             # Visual style playbooks (YAML)
├── remotion-composer/  # React/Remotion video composition engine
├── lib/                # Core infrastructure (config, checkpoints, pipeline loader)
└── tests/              # Contract tests, QA integration tests, eval harness

Three-Layer Knowledge Architecture:
• Layer 1: tools/ + pipeline_defs/ — "What exists" (executable capabilities + orchestration)
• Layer 2: skills/ — "How to use it" (OpenMontage conventions and quality bars)
• Layer 3: .agents/skills/ — "How it works" (external technology knowledge packs)

Each tool declares which Layer 3 skills it relies on. The agent reads Layer 1 for availability, Layer 2 for OM conventions, Layer 3 for deep technical knowledge when needed.`,
    keywords: ['architecture', 'tools', 'pipeline_defs', 'skills', 'three-layer', 'remotion', 'schemas'],
    tags: ['architecture', 'reference', 'gallery-guide'],
    tier: 'How OpenMontage Works',
    pipeline: '',
    cost: 'reference',
    minutes: '',
    deliverable: 'Repo map (48 tools, manifests, skills, schemas) plus L1/L2/L3 knowledge model for agent routing.',
    setupNote: 'In Social Imperialism: vendor/OpenMontage/ is the runtime; brain/skills/video-studio/ is the SI skill mirror.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_providers_capability_map',
    title: 'Supported providers — full capability tables',
    seedRevision: 2,
    body: `Full setup guide with pricing and free tiers: vendor/OpenMontage/docs/PROVIDERS.md

VIDEO GENERATION — 14 providers
• Kling (Cloud) — High quality, fast
• Runway Gen-4 (Cloud) — Cinematic; Gen-3 Alpha Turbo / Gen-4 Turbo / Gen-4 Aleph
• Google Veo 3 (Cloud) — Long-form, cinematic; via fal.ai or HeyGen
• Grok Imagine Video (Cloud) — Reference-image video, xAI short-form
• Higgsfield (Cloud) — Multi-model orchestrator, Soul ID character consistency
• MiniMax (Cloud) — Cost-effective
• HeyGen (Cloud) — Multi-model gateway
• WAN 2.1 (Local GPU) — Free, 1.3B and 14B variants
• Hunyuan (Local GPU) — Free, high quality
• CogVideo (Local GPU) — Free, 2B and 5B variants
• LTX-Video (Local GPU / Modal) — Free locally or self-hosted cloud
• Pexels (Stock) — Free stock footage
• Pixabay (Stock) — Free stock footage
• Wikimedia Commons (Stock) — Free/open archival video

IMAGE GENERATION — 10 tools/providers
• FLUX (Cloud) — State-of-the-art quality
• Google Imagen (Cloud) — Imagen 4, multiple aspect ratios
• Grok Imagine Image (Cloud) — Edits, style transfer, multi-image compositing
• GPT Image 2 (Cloud) — OpenAI image model
• Recraft (Cloud) — Design-focused generation
• Local Diffusion (Local GPU) — Stable Diffusion, free
• Pexels / Pixabay / Unsplash (Stock) — Free stock images
• ManimCE (Local) — Mathematical animations

TEXT-TO-SPEECH — 4 providers
• ElevenLabs (Cloud) — Premium voice quality
• Google TTS (Cloud) — 700+ voices, 50+ languages
• OpenAI TTS (Cloud) — Fast, affordable
• Piper (Local) — Completely free, offline

MUSIC, SOUND & POST-PRODUCTION
• Suno AI (Cloud) — Full songs with vocals/lyrics, up to ~8 min
• ElevenLabs Music / SFX (Cloud) — AI music and sound effects
Post (always free): FFmpeg · Video Stitch · Trimmer · Audio Mixer · Enhance · Color Grade · Subtitles
Enhancement: Upscale · Background Remove · Face Enhance · Face Restore
Analysis: Transcriber · Scene Detect · Frame Sampler · Video Understand
Avatar: Talking Head · Lip Sync
Compose: Remotion (Node.js) · HyperFrames (npx hyperframes) · FFmpeg

render_runtime locked at proposal — no silent Remotion ↔ HyperFrames swaps.
Scored selection (7 dimensions): task fit 30%, quality 20%, control 15%, reliability 15%, cost 10%, latency 5%, continuity 5%.`,
    keywords: ['providers', 'kling', 'veo', 'runway', 'flux', 'elevenlabs', 'piper', 'remotion', 'hyperframes', 'suno', 'post-production'],
    tags: ['providers', 'reference', 'gallery-guide'],
    tier: 'Supported Providers',
    pipeline: '',
    cost: 'reference',
    minutes: '',
    deliverable: 'README-aligned provider tables — 14 video, 10 image, 4 TTS, music/SFX, post, enhancement, analysis, avatar, compose engines.',
    setupNote: 'Pricing/free tiers: docs/PROVIDERS.md. Preflight: provider_menu_summary() grouped by env var.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_providers_setup_order',
    title: 'Supported providers — setup order & env vars',
    body: `Recommended setup order (start free, add paid as needed):

1. $0 — Pexels + Pixabay → stock photos/videos
2. $0 — GOOGLE_API_KEY → TTS (1M chars/mo free) + Imagen + Lyria music
3. $0 — ELEVENLABS_API_KEY → premium TTS/music/SFX (10K chars/mo free)
4. $0 — Piper local (pip install piper-tts) → offline TTS, no key
5. ~$0.03/image — FAL_KEY → FLUX + Kling/Veo/MiniMax video + Recraft
6. ~$0.05/image — OPENAI_API_KEY → GPT Image 2 + OpenAI TTS
7. ~$0.04/image — GOOGLE_API_KEY → Imagen 4 (same Google key)
8. ~$12/mo — RUNWAY_API_KEY → Runway Gen-4 direct
9. Pay-as-you-go — HEYGEN_API_KEY → avatar + multi-model video gateway (Veo, Sora, Runway, Kling)
10. Pay-as-you-go — SUNO_API_KEY → full song generation
11. $0 + GPU — VIDEO_GEN_LOCAL_ENABLED=true → WAN, Hunyuan, CogVideo, LTX local video gen
12. $0 + GPU — local Stable Diffusion images

Key env vars (vendor/OpenMontage/.env):
PEXELS_API_KEY · PIXABAY_API_KEY · UNSPLASH_ACCESS_KEY
GOOGLE_API_KEY · ELEVENLABS_API_KEY · OPENAI_API_KEY · XAI_API_KEY
FAL_KEY · HEYGEN_API_KEY · RUNWAY_API_KEY · SUNO_API_KEY
DASHSCOPE_API_KEY (Qwen image/TTS/ASR) · DOUBAO_SPEECH_API_KEY (Mandarin TTS)
VIDEO_GEN_LOCAL_ENABLED=true · VIDEO_GEN_LOCAL_MODEL=wan2.1-1.3b

Put keys before inline # comments (FAL_KEY=your-key  # note). Empty KEY=  # lines do not count.

Re-check unlocked tools:
python -c "from tools.tool_registry import registry; import json; registry.discover(); print(json.dumps(registry.provider_menu_summary(), indent=2))"`,
    keywords: ['setup', 'env', 'fal_key', 'api keys', 'pexels', 'provider_menu', 'preflight'],
    tags: ['providers', 'reference', 'gallery-guide', 'setup'],
    tier: 'Supported Providers',
    pipeline: '',
    cost: 'reference',
    minutes: '',
    deliverable: '12-step provider setup ladder, env var cheat sheet, and provider_menu_summary preflight command.',
    setupNote: 'SI: Settings → Integrations syncs keys to vendor/OpenMontage/.env on desktop.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_style_playbooks',
    title: 'Style system — visual playbooks',
    seedRevision: 3,
    body: `Style playbooks define the visual language for your productions (YAML in vendor/OpenMontage/styles/).

PLAYBOOK — BEST FOR
• Clean Professional — Corporate, educational, SaaS
• Flat Motion Graphics — Social media, TikTok, startups
• Minimalist Diagram — Technical deep-dives, architecture
• Premium Minimalist — High-end product, luxury brand films
• Anime Ghibli — Ghibli-style illustration, warm fantasy atmospheres

Files: clean-professional.yaml · flat-motion-graphics.yaml · minimalist-diagram.yaml · premium-minimalist.yaml · anime-ghibli.yaml

Playbooks control typography, color palettes, motion styles, audio profiles, and quality rules. The agent reads the playbook at proposal and applies it consistently across generated assets.

To request in your brief: "Use the Clean Professional playbook" or "Flat Motion Graphics style for a TikTok launch."

Platform render profiles (YouTube, Reels, TikTok, …): see vault seed pv_skill_video_platform_output_profiles.`,
    keywords: ['style', 'playbook', 'clean professional', 'motion graphics', 'ghibli', 'yaml'],
    tags: ['style', 'reference', 'gallery-guide', 'playbook'],
    tier: 'Style System',
    pipeline: '',
    cost: 'reference',
    minutes: '',
    deliverable: 'Five YAML playbooks — typography, palette, motion, and audio rules applied consistently across assets.',
    setupNote: 'Loader: vendor/OpenMontage/styles/playbook_loader.py. Schema: schemas/styles/playbook.schema.json',
  }),
  galleryPrompt({
    id: 'pv_skill_video_platform_output_profiles',
    title: 'Platform output profiles — render targets',
    body: `Built-in render profiles for every major platform. Specify one in your brief — the agent locks aspect ratio and resolution at proposal.

PROFILE — RESOLUTION — ASPECT
• YouTube Landscape — 1920×1080 — 16:9
• YouTube 4K — 3840×2160 — 16:9
• YouTube Shorts — 1080×1920 — 9:16
• Instagram Reels — 1080×1920 — 9:16
• Instagram Feed — 1080×1080 — 1:1
• TikTok — 1080×1920 — 9:16
• LinkedIn — 1920×1080 — 16:9
• Cinematic — 2560×1080 — 21:9

Example brief line: "Render for Instagram Reels 9:16" or "YouTube 4K landscape deliverable."

Profiles are enforced at proposal alongside render_runtime (Remotion vs HyperFrames) — no silent aspect-ratio swaps after approval.`,
    keywords: ['platform', 'aspect ratio', 'youtube', 'reels', 'tiktok', 'linkedin', 'resolution', '9:16', '16:9'],
    tags: ['platform', 'reference', 'gallery-guide', 'render'],
    tier: 'Platform Profiles',
    pipeline: '',
    cost: 'reference',
    minutes: '',
    deliverable: 'Eight built-in platform render profiles — resolution and aspect ratio locked at proposal.',
    setupNote: 'Compose stage reads profile from checkpoint; see vendor/OpenMontage/README.md § Platform Output Profiles.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_production_governance',
    title: 'Production governance — quality gates & audit',
    body: `OpenMontage treats video production like real engineering — quality gates, audit trails, and enforcement at every stage.

QUALITY GATES
• Human approval gates are enforced, not suggested — proposal, script, scene plan, generated assets, and publish all pause for sign-off. Checkpoint writer rejects a "completed" gated stage without recorded approval; superseded checkpoints are archived for audit trail. Review on the Backlot board.
• Pre-compose validation — blocks render if delivery promise is violated (e.g. motion-led video with 80% still images), slideshow risk score is critical, or renderer family is missing.
• Post-render self-review — ffprobe validation, frames at 4 positions (black frames, broken overlays), audio level analysis (silence, clipping), delivery promise check, subtitle presence. Failed review = video not presented.
• Slideshow risk scoring — 6 dimensions: repetition, decorative visuals, weak motion, shot intent, typography overreliance, unsupported cinematic claims.
• Source media inspection — user-supplied footage probed (resolution, codec, audio channels, duration) before creative decisions. No hallucinating from filenames.

SCORED PROVIDER SELECTION
Every tool pick (video, image, TTS, music) runs 7-dimension scoring: task fit 30%, output quality 20%, control 15%, reliability 15%, cost 10%, latency 5%, continuity 5%. Winner + alternatives logged in decision trail.

Selectors normalize loose brief context before scoring (e.g. "Pixar-style animated short with character consistency" → scorer-friendly intent). Outputs surface chosen provider agent_skills for Layer 3 skill reads.

DECISION AUDIT TRAIL
Provider selection, playbook, music, voice, renderer family, fallbacks — logged with alternatives, confidence, reasoning. Cumulative log persists across stages.

BUDGET CONTROLS
• Estimate before execution · Reserve before call · Reconcile after
• Modes: observe (track), warn (log overruns), cap (hard limit)
• Per-action approval above threshold (default $0.50)
• Total budget cap default $10 — fully configurable

No surprise bills — agent states cost before spend.`,
    keywords: ['governance', 'quality gates', 'backlot', 'slideshow risk', 'budget', 'audit trail', 'pre-compose', 'post-render'],
    tags: ['governance', 'reference', 'gallery-guide', 'quality'],
    tier: 'Production Governance',
    pipeline: '',
    cost: 'reference',
    minutes: '',
    deliverable: 'Enforced gates, pre/post-compose validation, slideshow scoring, provider audit trail, and budget controls.',
    setupNote: 'Backlot: vendor/OpenMontage/backlot/ or SI Production board. Checkpoint schema: schemas/checkpoints/',
  }),
  galleryPrompt({
    id: 'pv_skill_video_agent_compatibility',
    title: 'Agent compatibility — platform instruction files',
    body: `OpenMontage works with any AI coding assistant that can read files and execute Python. Dedicated instruction files per platform:

PLATFORM — CONFIG FILE
• Claude Code — CLAUDE.md
• Cursor — CURSOR.md + .cursor/rules/
• GitHub Copilot — COPILOT.md + .github/copilot-instructions.md
• Codex — CODEX.md
• Windsurf — .windsurfrules

All platform files point to:
• AGENT_GUIDE.md — operating guide and agent contract
• PROJECT_CONTEXT.md — architecture reference

Social Imperialism adds brain/skills/video-studio/ and packages/core/src/imperialVideoStudio.js as the SI integration layer.

Coming soon: local LLM support via Ollama and LM Studio — full pipeline without cloud LLM.`,
    keywords: ['agent', 'cursor', 'claude', 'copilot', 'codex', 'windsurf', 'agent_guide', 'project_context'],
    tags: ['agent', 'reference', 'gallery-guide', 'compatibility'],
    tier: 'Agent Compatibility',
    pipeline: '',
    cost: 'reference',
    minutes: '',
    deliverable: 'Per-platform config files mapping to AGENT_GUIDE.md and PROJECT_CONTEXT.md.',
    setupNote: 'SI agents: read vendor/OpenMontage/AGENT_GUIDE.md first, then brain/skills/video-studio/INDEX.md.',
  }),
  galleryPrompt({
    id: 'pv_skill_video_contributing',
    title: 'Contributing — add tools & pipelines',
    body: `OpenMontage is built to be extended. Two most common contributions:

ADDING A NEW TOOL
1. Create a Python file in the appropriate tools/ subdirectory
2. Inherit from BaseTool and implement the tool contract
3. Registry auto-discovers it — no manual registration
4. Add a skill file if the tool needs usage guidance

ADDING A NEW PIPELINE
1. Create a YAML manifest in pipeline_defs/
2. Create stage director skills in skills/pipelines/<your-pipeline>/
3. Reference existing tools — or add new ones if needed

Technical references:
• docs/ARCHITECTURE.md — full technical reference
• docs/PROVIDERS.md — provider guide (setup, pricing, free tiers)
• AGENT_GUIDE.md — agent contract

Community: GitHub Discussions — Show and Tell for videos/prompts, Ideas for features.`,
    keywords: ['contributing', 'basetool', 'pipeline_defs', 'architecture', 'extend', 'registry'],
    tags: ['contributing', 'reference', 'gallery-guide', 'developer'],
    tier: 'Contributing',
    pipeline: '',
    cost: 'reference',
    minutes: '',
    deliverable: 'Tool and pipeline contribution checklist plus links to ARCHITECTURE.md, PROVIDERS.md, AGENT_GUIDE.md.',
    setupNote: 'Registry discovery: python -c "from tools.tool_registry import registry; registry.discover()"',
  }),
];

/** Strip gallery header/footer for brief fields (Video Studio, agent handoff). */
function extractGalleryBrief(body) {
  const text = String(body || '').trim();
  if (!text) return '';
  const whatIdx = text.indexOf('\n\nWhat you get:');
  const core = whatIdx >= 0 ? text.slice(0, whatIdx) : text;
  const lines = core.split('\n');
  let start = 0;
  while (start < lines.length) {
    const line = lines[start].trim();
    if (!line) {
      start += 1;
      continue;
    }
    if (
      line.startsWith('[OpenMontage')
      || line.startsWith('Estimated time:')
      || line.startsWith('Est. time:')
      || line.startsWith('Pipeline:')
      || line.startsWith('Cost:')
    ) {
      start += 1;
      continue;
    }
    break;
  }
  while (start < lines.length && !lines[start].trim()) start += 1;
  return lines.slice(start).join('\n').trim();
}

module.exports = {
  VIDEO_PROMPT_GALLERY_SEED,
  galleryPrompt,
  formatEstimatedTime,
  extractGalleryBrief,
};