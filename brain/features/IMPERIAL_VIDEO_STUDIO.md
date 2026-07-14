# Feature: Imperial Video Studio

**Domain:** socialimperialism.com `/video-studio`  
**Status:** Live (July 2026)  
**Audit rule:** [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md)  
**User-facing:** Imperial Video Studio — agentic video production

World's first **open-source, agentic video production system** integrated into Social Imperialism: turn Imperialism Brain (or any connected coding agent) into a full video studio with structured pipelines, tool registry, and **620** instruction skills.

---

## What's new vs before

| Before (July 2026 pre-studio) | After (Imperial Video Studio) |
|------------------------------|-------------------------------|
| Grok video = single-shot browser generate in Media tab | **12 end-to-end pipelines** with 7-stage agent flow |
| 2 Imperial **text** pipelines (18 + 8 SEO steps) | Separate **video** orchestrator — research → compose |
| 1/12 content templates video-native (`promotional-video`) | Every pipeline has render path + tool manifest |
| No reference-video analysis | `analyze-reference-video` → pacing, concepts, cost estimate |
| No production visibility | **Production board** — live stage status + approval gates |
| Scattered tools (Grok, thumbnails, design) | **52-tool registry** with capability menu + key status |
| Ad-hoc agent prompts | **620 cataloged agent skills** (stage directors, tool layers, playbooks) |
| Manual publish after clip | Pipeline ends at compose + routes to Content Hub publish |

---

## How OpenMontage works (agent-first)

There is **no code orchestrator** — the AI coding assistant is the orchestrator. Python provides **tools** and **checkpoints**; YAML manifests and Markdown skills hold stages, review criteria, and quality bars.

```
User brief
  → pipeline_defs/<pipeline>.yaml (manifest)
  → skills/pipelines/<pipeline>/<stage>-director.md
  → tools/ (scored provider selection, 7 dimensions)
  → meta/reviewer.md self-review + checkpoint JSON
  → human approval at creative gates
  → pre-compose validation → Remotion or FFmpeg
  → post-render review (ffprobe, frames, audio) → final MP4
```

**Three-layer knowledge:** L1 `tools/` + `pipeline_defs/` (what exists) · L2 `skills/` (how OM wants it used) · L3 `.agents/skills/` (deep tech packs per tool).

Vault reference: `pv_skill_video_arch_how_it_works`, `pv_skill_video_arch_repo_layers` (`feature: video-studio`).

---

## Architecture (Social Imperialism integration)

```
Imperialism Brain / coding agent
        │
        ▼
brain/skills/video-studio/  (620 skills — stage directors, tools, meta)
        │
        ▼
packages/core/src/imperialVideoStudio.js
  · 12 pipelines · 52 tools · 7-stage machine
        │
        ▼
SaaS IPC bridge → Grok · Design Compositor · Content Studio · Publish
        │
        ▼
apps/web ImperialVideoStudioPanel + Production board
```

### Stage flow (all pipelines)

`research → proposal → script → scene_plan → assets → edit → compose`

Approval gates on proposal, script, scene_plan, and assets — wired to **THEE_MICHAEL** notification ledger (no repeat banners; history + resume).

### Pipelines

Each pipeline is a complete production workflow, from idea to finished video. OpenMontage manifests: `vendor/OpenMontage/pipeline_defs/*.yaml`.

| Pipeline (OM) | What it produces | Best for | SI `id` |
|---------------|------------------|----------|---------|
| Animated Explainer | Research, narration, visuals, music | Education, tutorials, topic breakdowns | `social-explainer` |
| Animation | Motion graphics, kinetic type | Social, product demos, abstract concepts | `kinetic-promo` |
| Avatar Spokesperson | Avatar presenter videos | Corporate comms, training | `avatar-presenter` |
| Cinematic | Trailers, teasers, mood edits | Brand films, promos | `cinematic-teaser` |
| Clip Factory | Ranked shorts from one long source | Long-form → social clips | `clip-repurpose` |
| Documentary Montage | CLIP corpus montage (Archive.org, NASA, Wikimedia, Pexels, Unsplash) | Video essays, real-footage mood pieces | `stock-montage` |
| Hybrid | Source footage + AI support visuals | Enhance footage with graphics | `hybrid-boost` |
| Localization & Dub | Subtitle, dub, translate | Multi-language distribution | `localize-dub` |
| Podcast Repurpose | Podcast highlights → video | Audiograms, podcast marketing | `podcast-to-video` |
| Screen Demo | Polished screen recordings | Product demos, docs | `product-demo` |
| Talking Head | Footage-led speaker videos | Vlogs, interviews | `talking-head` |
| Character Animation (OM) | SVG/GSAP character acting | Story shorts, cartoons | `character-short` |

**Stage flow (all pipelines):** `research → proposal → script → scene_plan → assets → edit → compose` — each stage has a director skill; web research runs before script (YouTube, Reddit, HN, news, academic sources → cited research brief).

### Composition runtimes

| Runtime | SI implementation |
|---------|-------------------|
| FFmpeg floor | Post-production via desktop toolchain |
| Design compositor | `compose-social-layout`, `render-design-post` |
| Grok motion | `grok-generate-video` + extend |
| HyperFrames-style | `generate-atelier-layout` bespoke scenes |

---

## IPC channels

| Channel | Purpose |
|---------|---------|
| `get-imperial-video-studio-config` | Pipelines, stages, counts |
| `get-imperial-video-tool-registry` | 52 tools + capability menu |
| `get-imperial-video-skills-index` | 620 skill catalog |
| `run-imperial-video-pipeline` | Run pipeline (async default) |
| `get-imperial-video-pipeline-result` | Poll job + storyboard |
| `clear-imperial-video-pipeline-result` | Reset production board / job store |
| `analyze-reference-video` | Reference URL → concepts + pipeline pick |
| `run-imperial-video-compose` | Queue final composition |

---

## Web UI

| Component | Path |
|-----------|------|
| Video Studio page | `apps/web/src/app/video-studio/page.tsx` |
| Studio panel | `apps/web/src/components/ImperialVideoStudioPanel.tsx` |
| Grok toolbar | `GrokToolbar` pageId=`video-studio` |
| Nav | `nav.ts` → Create & Publish → Video Studio |

---

## SERP research (complement)

Pipeline stage **Research** may call `serp-search` via tool `web-research`. When **Social Imperialism SERP** is configured ([SOCIAL_IMPERIALISM_SERP.md](./SOCIAL_IMPERIALISM_SERP.md)), prefer `{ query, extract: 1, engine: 'google' }` or megasearch for brief grounding. SerpAPI still works as fallback. Does not change pipeline/stage counts.

---

## Agent contract

**Rule zero:** Treat every video request as a **pipeline selection problem**. Pick the right pipeline first, then read the manifest, then read the stage skill, then use tools.

1. **Pick pipeline** — match the brief to one of 12 pipelines (`get-imperial-video-studio-config`) or OpenMontage `vendor/OpenMontage/pipeline_defs/*.yaml`. If unclear, ask.
2. **Read manifest** — `pipeline_defs/<pipeline>.yaml` (stages, `tools_available`, approval gates) before any creative work.
3. **Preflight** — `get-imperial-video-tool-registry` / registry `provider_menu()` so you only promise what is configured.
4. **Reference URL** — `analyze-reference-video` before creative work when the user supplies inspiration footage.
5. **Stage-by-stage** — for each stage, read `brain/skills/video-studio/pipelines/{id}/{stage}.md` (or OM `skills/pipelines/{pipeline}/{stage}-director.md`) **before** calling tools.
6. **Use tools** — only tools declared for that stage in the manifest; read Layer-3 tool skills before provider calls.
7. **Approval gates** — record in notification ledger; user approves gated stages before spend.
8. **Compose** → `run-imperial-video-compose` then publish via Content Hub.

Do **not** improvise orchestration, skip the manifest, or call APIs without reading the stage director skill first.

### What you get with zero API keys

You don't need paid API keys to make real videos. After `make setup` (or `deploy/setup-openmontage.ps1` / `.sh`):

| Capability | Free tool | What it does |
|------------|-----------|--------------|
| Narration | Piper TTS | Offline text-to-speech |
| Open footage | Archive.org + NASA + Wikimedia | Archival / documentary B-roll (no key) |
| Extra stock | Pexels + Unsplash + Pixabay | Free stock (free developer keys) |
| Composition (React) | Remotion | Spring scenes, cards, charts, word-level captions |
| Composition (HTML/GSAP) | HyperFrames | Kinetic type, promos, website-to-video, SVG character rigs |
| Post-production | FFmpeg | Encode, subtitle burn, mix, grade |
| Subtitles | Built-in | Word-level caption timing |

**`render_runtime`:** OpenMontage locks Remotion vs HyperFrames at proposal time. Remotion default for data-driven explainers; HyperFrames for motion-graphics-heavy briefs. Matrix: `vendor/OpenMontage/skills/core/hyperframes.md`.

**Two free-ish paths:** (1) zero-key — Piper + public-domain stock + Remotion/HyperFrames + FFmpeg; (2) free developer keys — Pexels/Pixabay/Unsplash for larger stock libraries.

**Three production modes (no paid keys):**

| Mode | How it works |
|------|----------------|
| Image-based video | Piper narrates → images as visuals → Remotion animates into a polished edit |
| Local character animation | SVG rigs, pose libraries, GSAP timelines → HyperFrames → `projects/<name>/renders/final.mp4` |
| Real-footage video | Documentary montage pipeline: CLIP corpus from Archive.org, NASA, Wikimedia + optional Pexels/Unsplash → cut real motion footage |

For real footage: prompt *documentary montage*, *tone poem*, or *stock-footage collage*, and say **use real footage only**.

**Try these prompts** (full list in Video Studio prerequisites):

| Tier | Example |
|------|---------|
| Reference video | *Analyze this Reel and give me 3 original variants…* · *Keep that pacing, 45s explainer about black holes* |
| Zero keys | *45s explainer why the sky is blue* · *60s history of the internet with captions* · *data-driven coffee consumption* · *90s quantum computing for middle school + soundtrack* |
| Real-footage | *90s city at 4am, real footage only* · *Adam-Curtis archival collage* · *dreamlike rain montage, music no VO* |
| ~$0.15–$1.50 | *Ghibli floating library* · *anime underwater temple* · *CRISPR with AI visuals* · *AquaPulse launch teaser* |
| Broadcast (~$1.50–$2.50) | *30s sci-fi trailer (Veo/Kling + Suno)* · *90s quantum explainer (ElevenLabs + FLUX)* · *60s avatar rebrand (HeyGen)* |
| For audiences | *photosynthesis for 8th graders* · *REST API demo* · *Product Hunt OKR launch* · *blog → 90s video* |
| ~$1–$3 | *premium brand film for {{brandName}}* |

More: `vendor/OpenMontage/PROMPT_GALLERY.md` (costs + output examples). Zero-key instant demos: `make demo` or `python render_demo.py` in OpenMontage root.

### API keys — `.env` (every key is optional; add what you have)

**Supported providers:** 14 video · 10 image · 4 TTS · Suno/ElevenLabs music · free stock · local GPU · Remotion/HyperFrames compose. Vault: `pv_skill_video_providers_*`. Full guide: `vendor/OpenMontage/docs/PROVIDERS.md`.

Add keys to expand the registry `provider_menu_summary()` beyond the free floor:

| Key | Unlocks (examples) |
|-----|-------------------|
| `FAL_KEY` | FLUX images, Kling / Veo / MiniMax video |
| `GOOGLE_API_KEY` | Google Imagen images, Google TTS (700+ voices) |
| `HEYGEN_API_KEY` | VEO, Sora, Runway, Kling via HeyGen gateway |
| `RUNWAY_API_KEY` | Runway Gen-4 direct |
| `VIDEO_GEN_LOCAL_ENABLED` | Free local video gen (GPU + diffusers) |
| `ELEVENLABS_API_KEY` | Premium TTS, AI music, sound effects |
| `OPENAI_API_KEY` | OpenAI TTS, GPT Image 2 images, Sora |
| `XAI_API_KEY` | Grok image edits/generation + Grok video |
| `PEXELS_API_KEY` / `PIXABAY_API_KEY` | Stock footage & stills |

Configure via **Settings → Integrations** (desktop syncs to `vendor/OpenMontage/.env`) or copy `vendor/OpenMontage/.env.example` → `.env`. Put your key before any inline `#` comment (`FAL_KEY=your-key  # …`); empty `KEY=  # …` lines do not count.

---

## Verification

```bash
node apps/api/_audit-accuracy-check.js
API_URL=https://api.socialimperialism.com node apps/api/_test-qa-all-pages.js
npm run build -w @si/web
```