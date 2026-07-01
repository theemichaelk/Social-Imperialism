# THEE_MICHAEL v3.0-Aethelgard — Crystallized Capabilities

**Domain:** socialimperialism.com  
**Updated:** July 2026  
**Status:** Live (partial — see gaps in brain/features/AUDIT_ACCURACY_RULE.md)

## Section 1 — Sovereignty & Tenancy

| Capability | Implementation |
|------------|----------------|
| Admin omni-access | `adminAccess.ts`, `isPlatformAdmin`, Issue Control Plane |
| Tenant isolation | Prisma `projectId` / `organizationId`, `INVALID_PROJECT` 403 |
| Model downscaling | `saasAi.js` `SAAS_MODEL_DOWNSCALE` map |

## Section 2 — Imperiliasm Center Pipelines

| Pipeline | Steps | Code |
|----------|-------|------|
| Content Engine (A) | 18 | `packages/core/src/imperialContentPipeline.js` |
| Strategy Engine (B) | 8 | same |
| Humanization | 16 max | `packages/core/src/contentHumanization.js` |

IPC: `get-imperial-pipeline-config`, `run-imperial-pipeline`

## Section 6 — Automation Hub

| Capability | Implementation |
|------------|----------------|
| R2 edge storage | `apps/api/src/r2.js` (S3-compatible, account `ba963879a02685a50956ea17870c2f32`) |
| AWS S3 fallback | `apps/api/src/s3.js` |
| 5s lead modal | `LeadCaptureModal.tsx` + `POST /api/leads/capture` |
| Drip cold rule (30d) | `leadCaptureService.processColdContactRules` + scheduler |
| Onboarding drip | `onboardingEmailSequences.js` |

## Compound memory rule

Layer new skills onto existing agents. Update this file when IPC channels or step counts change.