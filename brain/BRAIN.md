# Social Imperialism — Agent Brain

This folder is the **internal intelligence layer** for Social Imperialism desktop and web/SaaS. AI agents, automations, and developers should read these files before implementing or extending features.

## Structure

| File / folder | Purpose |
|---------------|---------|
| [GROWTH_ENGINE.md](./GROWTH_ENGINE.md) | **Autonomous Social Growth Brain Engine** — decision core, brain-check, validation loop, UI pass-back |
| [OMNI_BRAIN_PLANNER.md](./OMNI_BRAIN_PLANNER.md) | **Omni-Brain Strategic Workflow Planner** — cross-module blueprints, universal prompt bar |
| [LIVE_SUPPORT_AGENT.md](./LIVE_SUPPORT_AGENT.md) | **Live Support Growth Agent** — in-product support, troubleshooting, THEE_MICHAEL approvals |
| [GUARDIAN_GATEKEEPER.md](./GUARDIAN_GATEKEEPER.md) | **Guardian & Self-Healing Gatekeeper** — monitoring, sandbox tests, webhooks, admin gate |
| [SOVEREIGN_THREAT_CAPTURE.md](./SOVEREIGN_THREAT_CAPTURE.md) | **Sovereign Threat Capture Layer** — capture, contain, encrypt, kinetic 2FA, production freeze |
| [features/SOVEREIGN_THREAT_CAPTURE.md](./features/SOVEREIGN_THREAT_CAPTURE.md) | Feature index — security requirement for all modules |
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
0b. **Sovereign Threat Capture** — all modules must comply with [SOVEREIGN_THREAT_CAPTURE.md](./SOVEREIGN_THREAT_CAPTURE.md); threats captured, contained, encrypted; live release requires THEE_MICHAEL kinetic 2FA.
1. **Never delete existing features** when adding new ones — check PRD first.
2. **Desktop is source of truth** for Grok browser automation (native Edge/Chrome/Firefox).
3. **Web/SaaS** invokes the same IPC channels via the desktop bridge or API worker.
4. **Credentials** live in local storage (`grokEngineSettings`, `nativeBrowserSettings`) — not in git.

## Quick links

- Grok login: https://grok.com/
- Edge profile: `%APPDATA%\Social Imperialism\native-browser-profiles\edge\grok`
- Generated assets: `%APPDATA%\Social Imperialism\grok-assets\`
- Desktop script: `apps/desktop/scripts/run-grok-imagine-edge.js`