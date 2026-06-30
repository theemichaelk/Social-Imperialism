# Feature: Site Blueprint (Public Pages)

**Domain:** socialimperialism.com  
**Status:** Live (June 2026)  
**Code:** `apps/web/src/lib/siteBlueprint.ts`

## Purpose

Marketing and public pages self-update from the same sources as the product Brain:

- `apps/web/src/lib/nav.ts` — module routes (25 items → features grid, module count, ticker)
- `brain/FEATURES.md` — capability catalog
- `brain/features/*.md` — per-feature indexes
- `PRD.md` — product blueprint
- `apps/web/src/lib/platforms.ts` — platform chips

When nav, features, or brain docs change, **do not hand-edit** home page stats — update `nav.ts` / brain and verify `siteBlueprint.ts` recomputes.

## Surfaces powered by blueprint

| Surface | Blueprint export |
|---------|------------------|
| Demo, Features, Platforms, How It Works, Pricing | `PUBLIC_NAV_ANCHORS` |
| Founder nav link | `PUBLIC_NAV_ROUTES` |
| Sign In, Open Dashboard | `getPublicNavActions()` |
| Footer: Sign In, Dashboard, Integrations, Settings, Founder | `FOOTER_LINKS` |
| © + Powered By TSB Michael K | `SITE_FOOTER` + `FooterCredit` |
| Capability tiles (IPC, Platforms, Modules) | `getSiteCapabilities()` |
| Features grid | `getAllModuleFeatures()` from `NAV_SECTIONS` |
| Platforms strip | `getMarketingPlatforms()` |
| Pricing cards | `BILLING_PLANS` |
| Onboarding steps | `getOnboardingSteps()` |
| Home ticker | `getTickerItems()` |
| Founder highlights | `getFounderHighlights()` |

## Components

- `HomePublicNav.tsx` — shared header for `/` and `/founder`
- `HomeFooter.tsx` — uses `FOOTER_LINKS` + `SITE_FOOTER`
- `FooterCredit.tsx` — TSB credit line

## Static S3 landing

`s3-website/index.html` stats should match `getModuleCount()` and `BLUEPRINT_METRICS`. Update manually when module count changes until a generate step is added.

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run production QA, update Brain docs if counts change.