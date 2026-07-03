# Feature: Prompt Vault

**Domain:** socialimperialism.com  
**Status:** Live (June 2026)  
**Brain:** [../PROMPT_VAULT.md](../PROMPT_VAULT.md)  
**Core:** `packages/core/src/promptVault.js`

## Web route

`/prompt-vault` — `PromptVaultPanel`, `PromptVaultPicker`

## Seeded templates (**8** starters)

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

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run production QA, update Brain docs if counts change.