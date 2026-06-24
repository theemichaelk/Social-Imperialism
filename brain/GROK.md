# Grok Engine — Browser Session (No API)

Social Imperialism uses **native browser automation** against https://grok.com/ — not the xAI API. A persistent Microsoft Edge profile keeps the login alive between runs.

## Account (keep these)

| Field | Value |
|-------|-------|
| Platform | `grok` |
| URL | https://grok.com/ |
| Email | `theesaintmichael@gmail.com` |
| Password | `Kingme05$85$$` |
| Auto-login | enabled |

## Browser settings (default)

| Setting | Value |
|---------|-------|
| Browser | Microsoft Edge (`edge`) |
| Launch mode | Dedicated profile (`app_profile`) |
| Profile key | `grok` |
| Profile path | `C:\Users\PC54\AppData\Roaming\Social Imperialism\native-browser-profiles\edge\grok` |

## Capabilities

| Feature | IPC channel | Where in UI |
|---------|-------------|-------------|
| Grok Text (new chat) | `grok-ask-text` | Content Hub, Grok bar on all integrated pages |
| **Grok Imagine** (images) | `grok-imagine` | Content Hub → Grok Imagine button |
| Grok Video + auto Extend | `grok-generate-video` | Content Hub → Grok Video |
| Grok Infographic | `grok-generate-infographic` | Content Hub → Infographic panel |
| Session status | `grok-get-status` | Settings → Grok Engine |
| Connect / authorize | `grok-connect` | Settings → Connect & Authorize |
| Save credentials | `save-grok-settings` | Settings → Save Grok Credentials |

## Prompt behavior

- Prompts are **keyword-aware** — built from the active campaign + tracked keywords (`grokPromptBuilder.js`).
- Imagine saves assets to `%APPDATA%\Social Imperialism\grok-assets\` as `grok_imagine_<timestamp>_<n>.png`.
- Video mode waits ~60s per part, then clicks **Extend** based on prompt part count.

## Setup (one-time)

1. Open **Settings → Native Browser Automation** — confirm Edge + dedicated profile.
2. Open **Settings → Grok Engine** — credentials are pre-filled from brain defaults.
3. Click **Connect & Authorize Grok** — complete CAPTCHA/2FA manually if prompted.
4. Or run: `node apps/desktop/scripts/run-grok-imagine-edge.js "your prompt"`

## Skill reference

Full workflow for image generation: [skills/grok-imagine/SKILL.md](./skills/grok-imagine/SKILL.md)