# Social Imperialism — Agent Brain

This folder is the **internal intelligence layer** for Social Imperialism desktop and web/SaaS. AI agents, automations, and developers should read these files before implementing or extending features.

## Structure

| File / folder | Purpose |
|---------------|---------|
| [GROWTH_ENGINE.md](./GROWTH_ENGINE.md) | **Social Imperialism Social Growth Brain Engine** — decision core, brain-check, validation loop, UI pass-back |
| [OMNI_BRAIN_PLANNER.md](./OMNI_BRAIN_PLANNER.md) | **Imperialism Brain (Planner)** — cross-module blueprints, universal prompt bar |
| [LIVE_SUPPORT_AGENT.md](./LIVE_SUPPORT_AGENT.md) | **Imperialism Brain (Live Support)** — in-product support, troubleshooting, THEE_MICHAEL approvals |
| [GUARDIAN_GATEKEEPER.md](./GUARDIAN_GATEKEEPER.md) | **Guardian & Self-Healing Gatekeeper** — monitoring, sandbox tests, webhooks, admin gate |
| [SOVEREIGN_THREAT_CAPTURE.md](./SOVEREIGN_THREAT_CAPTURE.md) | **THEE_MICHAEL Security Control** — capture, Accept/Deny/Undo, encrypt, kinetic 2FA |
| [features/THEE_MICHAEL_SECURITY.md](./features/THEE_MICHAEL_SECURITY.md) | Feature index — THEE_MICHAEL Security Control |
| [features/AUDIT_ACCURACY_RULE.md](./features/AUDIT_ACCURACY_RULE.md) | **Audit Accuracy Rule** — mandatory verify-before-merge for all features |
| [features/SOVEREIGN_THREAT_CAPTURE.md](./features/SOVEREIGN_THREAT_CAPTURE.md) | Feature index — security requirement for all modules |
| [features/IMPERIALISM_BRAIN.md](./features/IMPERIALISM_BRAIN.md) | Feature index — planner + live support |
| [features/GUARDIAN_GATEKEEPER.md](./features/GUARDIAN_GATEKEEPER.md) | Feature index — ops health + approvals |
| [features/PAGE_FOCUS_UX.md](./features/PAGE_FOCUS_UX.md) | Feature index — focus rails + tab UX |
| [features/PROMPT_VAULT.md](./features/PROMPT_VAULT.md) | Feature index — prompt templates |
| [features/GROK_ENGINE.md](./features/GROK_ENGINE.md) | Feature index — Grok browser automation |
| [features/AETHELGARD_PROTOCOL.md](./features/AETHELGARD_PROTOCOL.md) | THEE_MICHAEL v3.0-Aethelgard — pipelines, R2, lead capture |
| [features/DESIGN_STUDIO.md](./features/DESIGN_STUDIO.md) | Design Studio — Imperialism Design Compositor |
| [AGENTS.md](./AGENTS.md) | Agent registry — IDs, surfaces, routing keywords |
| [PROMPT_VAULT.md](./PROMPT_VAULT.md) | Prompt Vault — create, search, load, export, delete templates per campaign |
| [FEATURES.md](./FEATURES.md) | Master feature catalog (desktop + web parity) |
| [GROK.md](./GROK.md) | Grok Engine session, credentials, Edge profile, IPC |
| [skills/grok-imagine/SKILL.md](./skills/grok-imagine/SKILL.md) | Skill: generate images via Grok Imagine in native Edge |
| `../API_REFERENCE.md` | Platform API integrations |
| `../PRD.md` | Product blueprint — check before adding/removing features |
| `../MEMORY.md` | Persistent agent memory |

## Operating rules

0. **Brain-check first** — read [GROWTH_ENGINE.md](./GROWTH_ENGINE.md) before any content, reply, publish, scan, or automation action.
0a. **Audit accuracy** — every update must pass [features/AUDIT_ACCURACY_RULE.md](./features/AUDIT_ACCURACY_RULE.md); run `node apps/api/_audit-accuracy-check.js` and production QA before merge.
0b. **THEE_MICHAEL Security Control** — all modules must comply with [SOVEREIGN_THREAT_CAPTURE.md](./SOVEREIGN_THREAT_CAPTURE.md); threats pending until THEE_MICHAEL Accept/Deny; run `npm run audit:accuracy` before claiming done.
1. **Never delete existing features** when adding new ones — check PRD first.
2. **Desktop is source of truth** for Grok browser automation (native Edge/Chrome/Firefox).
3. **Web/SaaS** invokes the same IPC channels via the desktop bridge or API worker.
4. **Credentials** live in local storage (`grokEngineSettings`, `nativeBrowserSettings`) — not in git.

## Quick links

- Grok login: https://grok.com/
- Edge profile: `%APPDATA%\Social Imperialism\native-browser-profiles\edge\grok`
- Generated assets: `%APPDATA%\Social Imperialism\grok-assets\`
- Desktop script: `apps/desktop/scripts/run-grok-imagine-edge.js`