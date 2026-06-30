---
name: grok-imagine
description: >
  Generate images via Grok Imagine using native Microsoft Edge browser automation
  with a persistent grok.com login. Use for Social Imperialism Content Hub visuals,
  thumbnails, and infographics when no API key is available. Triggers: grok imagine,
  grok image, generate with grok, run grok imagine edge.
metadata:
  short-description: "Grok Imagine image gen via Edge browser session"
---

# Grok Imagine (Social Imperialism)

Generate images through **https://grok.com/imagine** using the logged-in Edge profile — not the xAI API.

## When to use

- User wants an image from Grok (not FLUX/FAL/DALL-E API).
- Content Hub, thumbnail studio, or infographic needs a Grok visual.
- Desktop app or agent should run Imagine with saved session cookies.

## Prerequisites

1. **Grok account** configured in Settings → Grok Engine (see `brain/GROK.md` — credentials live in local storage only)
2. **Edge profile** at `%APPDATA%\Social Imperialism\native-browser-profiles\edge\grok`
3. Session valid (`grok-get-status` → `session.loggedIn` or `settings.sessionValid`)

## How to run

### From desktop UI

1. Settings → Grok Engine → Connect & Authorize (once).
2. Content Hub → **Grok Imagine** button, or Grok bar on any integrated page.
3. Asset saves to `grok-assets/` and attaches to the post composer.

### From script

```bash
cd apps/desktop
node scripts/run-grok-imagine-edge.js "your image prompt here"
```

### From IPC (in-app)

```js
await ipcRenderer.invoke('grok-imagine', { prompt: 'futuristic dashboard, neon cyan', pageId: 'content-hub' });
```

## Prompt craft

- Lead with subject, then mood, lighting, style (2–5 sentences).
- Campaign keywords are auto-injected by `grokPromptBuilder.js` — user prompt is the creative direction.
- Prefer positive descriptions over negative prompts.

## Output

- Primary asset: `grok_imagine_<timestamp>_0.png` in `%APPDATA%\Social Imperialism\grok-assets\`
- Response shape: `{ success, primaryAsset: { path, url, type }, assets[] }`

## Edge cases

- **CAPTCHA / 2FA:** Browser opens visibly; user completes manually, then automation continues.
- **Session expired:** Run `grok-connect` or open grok.com in Edge test tab from Settings.
- **Wrong image captured:** Page may show prior Imagine results — re-run with a fresh prompt or improve `collectImagineAssets` filtering.

## Related channels

| Channel | Use |
|---------|-----|
| `grok-generate-video` | Video mode with auto-Extend |
| `grok-ask-text` | New-chat text (not images) |
| `grok-generate-infographic` | Research + Imagine composite |

## Files

- `apps/desktop/services/grokBrowserAutomation.js` — `generateGrokImagine()`
- `apps/desktop/services/nativeBrowserLauncher.js` — Edge launch + cookies
- `apps/desktop/services/grokIpc.js` — IPC handlers
- `packages/core/src/grokDefaults.js` — canonical defaults