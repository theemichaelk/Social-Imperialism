# Social Imperialism — Agent Brain

This folder is the **internal intelligence layer** for Social Imperialism desktop and web/SaaS. AI agents, automations, and developers should read these files before implementing or extending features.

## Structure

| File / folder | Purpose |
|---------------|---------|
| [GROWTH_ENGINE.md](./GROWTH_ENGINE.md) | **Autonomous Social Growth Brain Engine** — decision core, brain-check, validation loop, UI pass-back |
| [PROMPT_VAULT.md](./PROMPT_VAULT.md) | Prompt Vault — create, search, load, export, delete templates per campaign |
| [FEATURES.md](./FEATURES.md) | Master feature catalog (desktop + web parity) |
| [GROK.md](./GROK.md) | Grok Engine session, credentials, Edge profile, IPC |
| [skills/grok-imagine/SKILL.md](./skills/grok-imagine/SKILL.md) | Skill: generate images via Grok Imagine in native Edge |
| `../API_REFERENCE.md` | Platform API integrations |
| `../PRD.md` | Product blueprint — check before adding/removing features |
| `../MEMORY.md` | Persistent agent memory |

## Operating rules

0. **Brain-check first** — read [GROWTH_ENGINE.md](./GROWTH_ENGINE.md) before any content, reply, publish, scan, or automation action.
1. **Never delete existing features** when adding new ones — check PRD first.
2. **Desktop is source of truth** for Grok browser automation (native Edge/Chrome/Firefox).
3. **Web/SaaS** invokes the same IPC channels via the desktop bridge or API worker.
4. **Credentials** live in local storage (`grokEngineSettings`, `nativeBrowserSettings`) — not in git.

## Quick links

- Grok login: https://grok.com/
- Edge profile: `%APPDATA%\Social Imperialism\native-browser-profiles\edge\grok`
- Generated assets: `%APPDATA%\Social Imperialism\grok-assets\`
- Desktop script: `apps/desktop/scripts/run-grok-imagine-edge.js`