# Prompt Vault

Reusable prompt templates per campaign — searched by the Growth Brain before drafting, replying, or automating.

**Audit accuracy rule (mandatory):** Before any past/current/future update, comply with [features/AUDIT_ACCURACY_RULE.md](./features/AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run production QA, update Brain docs if counts change.

## Web UI

- **Route:** `/prompt-vault`
- **Picker:** embedded in Content Hub (Quick Post), Grok toolbar, Keywords
- **Nav:** Discovery & Replies → Prompt Vault

## IPC channels

| Channel | Purpose |
|---------|---------|
| `get-prompt-vault` | List templates; optional `query`, `feature` filter |
| `search-prompt-vault` | Keyword search |
| `save-prompt-vault-item` | Create or update template |
| `create-prompt-vault-from-keyword` | AI-assisted create from keyword |
| `load-prompt-vault-item` | Resolve `{{brandName}}`, `{{domain}}`, `{{tone}}`, `{{keyword}}`; increment usage |
| `delete-prompt-vault-item` | Remove template by id |
| `export-prompt-vault` | JSON export (filtered optional) |

## Feature tags (`feature` field)

`general`, `content-hub`, `grok`, `keywords`, `replies`, `engagement`, `quora`, `reddit`, `seo`, `automations`, `analytics`, `sovereign`, `guardian`, `support`, `omni-brain`

Pickers filter by feature + `general` fallbacks.

## Placeholders (resolved on Load)

- `{{brandName}}` — active campaign brand
- `{{domain}}` — campaign website
- `{{tone}}` — campaign tone of voice
- `{{keyword}}` — search keyword or first keyword on template

## Storage

- Desktop / SaaS bridge: `promptVault_{activeCampaignId}` in project store
- Seeded with 4 starter templates on first access
- Does not overwrite keywords, post history, or automation rules on delete

## THEE_MICHAEL Security Control (security)

All Prompt Vault workflows on socialimperialism.com must comply with [SOVEREIGN_THREAT_CAPTURE.md](./SOVEREIGN_THREAT_CAPTURE.md). Seeded template: `pv_seed_sovereign_threat` (`feature: sovereign`) — user-facing title **THEE_MICHAEL Security Control — incident response**. Never store credentials, exploit details, or raw PII in vault templates.

## Brain integration

1. **Brain-check** → `search-prompt-vault` with user intent keyword
2. If match → `load-prompt-vault-item` → route to feature (`generate-ai`, `grok-*`, `draft-post-reply`, etc.)
3. If no match → `create-prompt-vault-from-keyword` optional, then draft for review
4. After successful workflow → `save-prompt-vault-item` to crystallize winning patterns (manual or future auto)

## Implementation

- Core: `packages/core/src/promptVault.js`
- Web: `apps/web/src/components/PromptVaultPanel.tsx`, `PromptVaultPicker.tsx`