# Feature: THEE_MICHAEL Overlord Protocol

**Domain:** socialimperialism.com  
**Status:** Live foundation (v1.2.30+), roadmap items pending  
**Brain:** [../THEE_MICHAEL_OVERLORD.md](../THEE_MICHAEL_OVERLORD.md)

## Components

| Surface | Path |
|---------|------|
| Core engine | `apps/web/src/lib/theeMichaelOverlord.ts` |
| Session enclave | `apps/web/src/lib/overlordEnclave.ts` |
| Protocol host | `apps/web/src/components/OverlordProtocolHost.tsx` |
| Cognitive trace | `apps/web/src/components/OverlordCognitiveTrace.tsx` |
| Interventions | `apps/web/src/components/OverlordInterventionBanner.tsx` |
| Risk gate | `apps/web/src/components/OverlordConfirmModal.tsx` |
| Field guard | `apps/web/src/components/OverlordFieldGuard.tsx` |
| Guide executor | `apps/web/src/lib/guide_executor.ts` + `GuideExecutorHost.tsx` |
| Live guide admin | `apps/web/src/components/LiveGuideRedirectPanel.tsx` → `/dashboard/admin` |

## Protocols

| Protocol | Capability |
|----------|------------|
| Alpha — Hyper-Ingestion | File/text/CSV parse → enclave |
| Beta — Page Mutation | `router.push`, UI highlight, typing simulation |
| Gamma — Symbiosis | Health correlation, Issue Control audit route |
| Delta — Predictive Matrix | Dwell-time interventions, Success Velocity Index |

## Guide APIs

- `POST /api/guide/actions/plan`
- `GET /api/guide/remote/poll`
- `POST /api/guide/remote/push` (admin)

## Roadmap (not yet built)

- Video/screencast frame analysis (Protocol Alpha full)
- Per-tenant Success Velocity benchmarking
- Desktop Electron parity for UI mutation
- PR/changelog millisecond sync (Protocol Gamma full)

## Audit accuracy rule (mandatory)

Before any past/current/future update, comply with [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md): verify claims against code, run `node apps/api/_audit-accuracy-check.js`, run production QA, update Brain docs if counts change.