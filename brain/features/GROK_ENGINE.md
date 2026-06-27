# Feature: Grok Engine

**Domain:** socialimperialism.com  
**Status:** Live (June 2026)  
**Brain:** [../GROK.md](../GROK.md) · **Skill:** [../skills/grok-imagine/SKILL.md](../skills/grok-imagine/SKILL.md)

## Platform split

| Capability | Desktop | Web/SaaS |
|------------|---------|----------|
| Native Edge browser + session | Source of truth | Settings bridge |
| Grok Imagine / Video | `grokBrowserAutomation` | Content Hub tabs |
| IPC | `grok-*` channels in `grokIpc.js` | Via API invoke |

Desktop is the **source of truth** for Grok browser automation — web invokes the same channels through the API bridge.

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run production QA, update Brain docs if counts change.