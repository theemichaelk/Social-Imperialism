# Feature: Imperial Video Studio

**Domain:** socialimperialism.com `/video-studio`  
**Status:** Live (July 2026)  
**Audit rule:** [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md)  
**User-facing:** Imperial Video Studio — agentic video production

World's first **open-source, agentic video production system** integrated into Social Imperialism: turn Imperialism Brain (or any connected coding agent) into a full video studio with structured pipelines, tool registry, and 500+ instruction skills.

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
| Ad-hoc agent prompts | **500+ cataloged agent skills** (stage directors, tool layers, playbooks) |
| Manual publish after clip | Pipeline ends at compose + routes to Content Hub publish |

---

## Architecture

```
Imperialism Brain / coding agent
        │
        ▼
brain/skills/video-studio/  (500+ skills — stage directors, tools, meta)
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

### 12 pipelines

| ID | Label | Stability |
|----|-------|-----------|
| `social-explainer` | Social Explainer | production |
| `kinetic-promo` | Kinetic Promo | production |
| `avatar-presenter` | Avatar Presenter | production |
| `cinematic-teaser` | Cinematic Teaser | production |
| `clip-repurpose` | Clip Repurpose | beta |
| `stock-montage` | Stock Montage | production |
| `hybrid-boost` | Hybrid Boost | production |
| `localize-dub` | Localize & Dub | beta |
| `podcast-to-video` | Podcast to Video | beta |
| `product-demo` | Product Demo | production |
| `talking-head` | Talking Head | beta |
| `character-short` | Character Short | beta |

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
| `get-imperial-video-skills-index` | 500+ skill catalog |
| `run-imperial-video-pipeline` | Run pipeline (async default) |
| `get-imperial-video-pipeline-result` | Poll job + storyboard |
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

## Agent contract

1. **Every video request → pick a pipeline** from `get-imperial-video-studio-config`.
2. **Preflight** → `get-imperial-video-tool-registry` capability menu before spending on assets.
3. **Reference URL** → `analyze-reference-video` before creative work.
4. **Stage-by-stage** → read matching skill from `brain/skills/video-studio/pipelines/{id}/{stage}.md`.
5. **Approval gates** → record in notification ledger; user approves before asset generation.
6. **Compose** → `run-imperial-video-compose` then publish via Content Hub.

---

## Verification

```bash
node apps/api/_audit-accuracy-check.js
API_URL=https://api.socialimperialism.com node apps/api/_test-qa-all-pages.js
npm run build -w @si/web
```