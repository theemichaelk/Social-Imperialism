# Feature: Page Focus UX

**Domain:** socialimperialism.com  
**Status:** Live (June 2026)  
**Brain:** [../FEATURES.md](../FEATURES.md) (Page focus UX section)

## Verified coverage (do not overstate)

| Mechanism | Count | Pages / routes |
|-----------|-------|----------------|
| `PageShell` + `PageFocusRail` | **24** | All authenticated module routes in `pageFocus.ts` |
| `ManageableTabNav` focus mode | **7** | dashboard, browse-posts, history, settings, integrations, content-library, account-creator |
| `ContentHubTabNav` focus mode | **1** | content-hub |
| Sidebar hints | **all nav items** | `apps/web/src/lib/nav.ts` |

## Key files

- `apps/web/src/lib/pageFocus.ts` — outcomes, flows, actions per route
- `apps/web/src/components/PageShell.tsx`
- `apps/web/src/components/PageFocusRail.tsx`
- `apps/web/src/components/ManageableTabNav.tsx`
- `apps/web/src/components/ContentHubTabNav.tsx`

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run production QA, update Brain docs if counts change.