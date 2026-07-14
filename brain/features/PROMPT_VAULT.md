# Feature: Prompt Vault

**Domain:** socialimperialism.com  
**Status:** Live (June 2026)  
**Brain:** [../PROMPT_VAULT.md](../PROMPT_VAULT.md)  
**Core:** `packages/core/src/promptVault.js`

## Web route

`/prompt-vault` — `PromptVaultPanel`, `PromptVaultPicker`

## SERP → vault (complement)

`feature: seo` templates may be seeded from `serp-search` `relatedTerms` / `serpFeatures` when **Social Imperialism SERP** or SerpAPI is connected — see [SOCIAL_IMPERIALISM_SERP.md](./SOCIAL_IMPERIALISM_SERP.md). Does not add new seed ids by default.

## Seeded templates (**44** total)

### General starters (**8**)

| Seed id | Feature tag |
|---------|-------------|
| `pv_seed_linkedin_post` | content-hub |
| `pv_seed_reply_helpful` | replies |
| `pv_seed_grok_imagine` | grok |
| `pv_seed_keyword_monitor` | keywords |
| `pv_seed_live_support` | support |
| `pv_seed_omni_brain` | omni-brain |
| `pv_seed_guardian_gatekeeper` | guardian |
| `pv_seed_sovereign_threat` | sovereign |

### OpenMontage Prompt Gallery (**36**, `feature: video-studio`)

Source: `vendor/OpenMontage/PROMPT_GALLERY.md` → `packages/core/src/promptVaultVideoGallery.js`

| Tier | Count | Seed id prefix |
|------|-------|----------------|
| Zero-Key Demo (CLI) | 4 | `pv_skill_video_demo_*` |
| Zero-Key pipeline | 4 | `pv_skill_video_zero_*` |
| One-Key (FAL_KEY) | 3 | `pv_skill_video_one_*` |
| Animation (~$0.15) | 4 | `pv_skill_video_anime_*` |
| HyperFrames (zero-key) | 3 | `pv_skill_video_hf_*` |
| Full Setup (~$1–$3) | 1 | `pv_skill_video_full_brand_film` |
| Broadcast Quality | 3 | `pv_skill_video_full_scifi_trailer`, `pv_skill_video_full_quantum_soundtrack`, `pv_skill_video_broadcast_avatar_rebrand` |
| For Specific Audiences | 4 | `pv_skill_video_audience_*` |
| Tips for Better Results | 1 | `pv_skill_video_tips_better_results` |
| How OpenMontage Works | 2 | `pv_skill_video_arch_how_it_works`, `pv_skill_video_arch_repo_layers` |
| Supported Providers | 2 | `pv_skill_video_providers_capability_map` (full README tables), `pv_skill_video_providers_setup_order` |
| Style System | 1 | `pv_skill_video_style_playbooks` — YAML playbooks (typography, palette, motion) |
| Platform Profiles | 1 | `pv_skill_video_platform_output_profiles` — YouTube, Reels, TikTok, LinkedIn, cinematic |
| Production Governance | 1 | `pv_skill_video_production_governance` — gates, validation, slideshow risk, budget |
| Agent Compatibility | 1 | `pv_skill_video_agent_compatibility` — Claude, Cursor, Copilot, Codex, Windsurf configs |
| Contributing | 1 | `pv_skill_video_contributing` — add tools/pipelines; ARCHITECTURE.md, PROVIDERS.md |

Broadcast tier uses Veo/Kling/Runway motion clips, ElevenLabs TTS, Suno/music, HeyGen avatars where noted.

Provider reference mirrors `vendor/OpenMontage/docs/PROVIDERS.md` — preflight via `provider_menu_summary()`, not raw `support_envelope()`.

Architecture guides document agent-first orchestration (no code orchestrator), repo layout (`tools/`, `pipeline_defs/`, `skills/`), and L1/L2/L3 knowledge layers.

Gallery fields on each template: `galleryTier`, `pipeline`, `estimatedCost`, `estimatedMinutes`, `deliverable`. Header line uses `Estimated time: … minutes | Cost: …` (OpenMontage Prompt Gallery format).

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run production QA, update Brain docs if counts change.