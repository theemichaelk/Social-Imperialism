# Imperial Video Studio — Agent Skills Index

**Catalog size:** 620 skills (machine index: `get-imperial-video-skills-index`)  
**Layers:** Tool contracts (L1) · Studio conventions (L2) · Provider prompting (L3)

## Rule zero — pipeline first

Treat every video request as a **pipeline selection problem**:

1. **Pick pipeline** — `get-imperial-video-studio-config` or OpenMontage `pipeline_defs/`
2. **Read manifest** — `pipeline_defs/<pipeline>.yaml` (stages, tools, gates)
3. **Read stage skill** — `pipelines/<id>/<stage>.md` (this tree) or OM `skills/pipelines/<pipeline>/<stage>-director.md`
4. **Use tools** — registry preflight, then only manifest-allowed tools for that stage

No ad-hoc scripts. No skipping straight to API calls.

## Meta skills (`brain/skills/video-studio/meta/`)

| Skill | Role |
|-------|------|
| `onboarding.md` | First-time studio discovery |
| `reviewer.md` | Multi-point self-review before deliverable |
| `checkpoint-protocol.md` | Stage resume + artifact paths |
| `video-reference-analyst.md` | Reference URL → grounded concepts |
| `bespoke-composition.md` | Atelier vs templated compose |
| `cost-governance.md` | Budget estimate → reserve → reconcile |
| `provider-selection.md` | 7-dimension provider scoring |
| `distinctness-review.md` | Hero work must not look generic |

## Pipeline stage directors

For each of 12 pipelines, read `{pipeline}/{stage}.md` where stage ∈  
`research | proposal | script | scene_plan | assets | edit | compose`.

## Tool skills

Each of 52 tools has `tools/{tool-id}.md` plus Layer-3 `{capability}.md` and `{capability}-qa.md`.

## Imperialism Brain cross-skills

Reuses `grok-imagine`, SEO intel, campaign mastery, design compositor, prompt vault, and security skills — indexed as `si-brain-*` variants in the catalog.

## Prompt Vault video seeds

36 OpenMontage Prompt Gallery templates (`pv_skill_video_*`, `feature: video-studio`) — seeded from `packages/core/src/promptVaultVideoGallery.js`:

| Tier | Seeds |
|------|-------|
| Zero-Key Demo | `pv_skill_video_demo_*` (4) — `make demo` / `render_demo.py` |
| Zero-Key | `pv_skill_video_zero_*` (4) — Piper + Remotion, $0 |
| One-Key FAL | `pv_skill_video_one_*` (3) — FLUX visuals |
| Animation | `pv_skill_video_anime_*` (4) — image_animation ~$0.15 |
| HyperFrames | `pv_skill_video_hf_*` (3) — HTML/GSAP, `npx hyperframes` |
| Full Setup (~$1–$3) | `pv_skill_video_full_brand_film` — motion clips + premium compose |
| Broadcast Quality | sci-fi trailer, quantum premium, avatar rebrand — Veo/Kling/Runway + ElevenLabs + Suno |
| For Specific Audiences | teachers, dev advocates, indie hackers, content creators |
| Tips | `pv_skill_video_tips_better_results` — charts, duration, audience, zero-key, anime |
| How OM works | `pv_skill_video_arch_*` — agent-first flow, repo map, three-layer knowledge |
| Supported providers | `pv_skill_video_providers_*` — full README tables + setup order (`docs/PROVIDERS.md`) |
| Style system | `pv_skill_video_style_playbooks` — clean-professional, flat-motion, ghibli |
| Platform profiles | `pv_skill_video_platform_output_profiles` — 8 render targets (9:16, 16:9, 1:1, 21:9) |
| Production governance | `pv_skill_video_production_governance` — gates, audit trail, budget controls |
| Agent compatibility | `pv_skill_video_agent_compatibility` — per-platform instruction files |
| Contributing | `pv_skill_video_contributing` — extend tools and pipelines |

Load via Video Studio brief **Prompt Vault** picker or `/prompt-vault` filtered to Imperial Video Studio.