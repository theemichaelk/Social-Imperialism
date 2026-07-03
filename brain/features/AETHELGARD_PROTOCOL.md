# THEE_MICHAEL v3.0-Aethelgard — Crystallized Capabilities

**Domain:** socialimperialism.com  
**Updated:** July 2026  
**Audit rule:** [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md) — run `npm run audit:accuracy` before claiming complete.

## Section 1 — Sovereignty & Tenancy

| Capability | Implementation |
|------------|----------------|
| Admin omni-access | `adminAccess.ts`, `isPlatformAdmin`, Issue Control Plane |
| Tenant isolation | Prisma `projectId` / `organizationId`, `INVALID_PROJECT` 403 |
| Model downscaling | `saasAi.js` `SAAS_MODEL_DOWNSCALE` map |

## Section 2 — Imperialism Center Pipelines

| Pipeline | Steps | Code |
|----------|-------|------|
| Content Engine (A) | 18 | `packages/core/src/imperialContentPipeline.js` |
| Strategy Engine (B) | 8 | same |
| Humanization | 16 max | `packages/core/src/contentHumanization.js` |

IPC: `get-imperial-pipeline-config`, `run-imperial-pipeline` (async default), `get-imperial-pipeline-result`  
Web UI: `ImperialContentStudio.tsx` — Run Imperial Pipeline panel (polls async result)  
QA: `_test-qa-all-pages.js` uses `quick: true` stub to avoid gateway timeout

## Section 6 — Automation Hub

| Capability | Implementation |
|------------|----------------|
| R2 edge storage | `apps/api/src/r2.js` (S3-compatible) |
| AWS S3 fallback | `apps/api/src/s3.js` |
| Storage status UI | `S3StatusPanel.tsx` via `get-s3-status` (includes R2) |
| 5s lead modal | `LeadCaptureModal.tsx` on `/` and `/founder` only |
| Lead capture API | `POST /api/leads/capture` + `leadRateLimit.js` |
| Welcome email job | `leadCaptureService.processLeadWelcomeEmails` |
| Drip cold rule (30d) | `leadCaptureService.processColdContactRules` + scheduler |
| Onboarding drip | `onboardingEmailSequences.js` |
| Predictive motivation | `PredictiveMotivationPanel.tsx` on dashboard |

## Verified counts (July 2026)

| Claim | Value | Verify |
|-------|-------|--------|
| SaaS IPC handlers | **398** | `npm run audit:accuracy` → handler registry count |
| Module routes | **28** | `pageFocus.ts` keys |
| Imperial pipeline A steps | **18** | `get-imperial-pipeline-config` |
| Imperial pipeline B steps | **8** | same |

## Compound memory rule

Layer new skills onto existing agents. Update this file when IPC channels or step counts change.