# Agent Registry

**Audit rule (mandatory):** All agents and features must comply with [features/AUDIT_ACCURACY_RULE.md](./features/AUDIT_ACCURACY_RULE.md) before any past/current/future update is documented or deployed.

| ID | Name | System prompt | Surfaces |
|----|------|---------------|----------|
| `live-support-growth` | Imperialism Brain (Live Support) | [LIVE_SUPPORT_AGENT.md](./LIVE_SUPPORT_AGENT.md) | Web panel (`LiveSupportPanel`), `/support`, sidebar search routing |
| `guardian-gatekeeper` | Guardian & Self-Healing Gatekeeper | [GUARDIAN_GATEKEEPER.md](./GUARDIAN_GATEKEEPER.md) | Settings → Guardian & API, Partner API `/guardian/status`, inbound `/guardian/hooks/:id` |
| `sovereign-threat-capture` | THEE_MICHAEL Security Control | [SOVEREIGN_THREAT_CAPTURE.md](./SOVEREIGN_THREAT_CAPTURE.md) | API edge shield, Settings → THEE_MICHAEL Security Control — [features/THEE_MICHAEL_SECURITY.md](./features/THEE_MICHAEL_SECURITY.md) |
| `omni-brain-planner` | Imperialism Brain (Planner) | [OMNI_BRAIN_PLANNER.md](./OMNI_BRAIN_PLANNER.md) | Universal prompt bar (`ImperialismBrainPromptBar`), all authenticated pages |
| `grok-engine` | Grok Engine | `brain/GROK.md` (desktop + settings) | Content Hub, Design Studio, Grok Imagine |
| `growth-lab` | Growth Lab | `brain/GROWTH_ENGINE.md` | Reddit AI, Quora Ops |
| `thee-michael-self-heal` | THEE_MICHAEL Self-Heal | [THEE_MICHAEL_SELF_HEAL.md](./THEE_MICHAEL_SELF_HEAL.md) | `/api/self-heal/*`, IPC self-heal handlers, Live Support improvements banner |
| `thee-michael-seo-intel` | THEE_MICHAEL SEO Intelligence | [THEE_MICHAEL_SEO_INTELLIGENCE.md](./THEE_MICHAEL_SEO_INTELLIGENCE.md) | `/api/seo/*`, Live Support SERP pulse, guide actions |
| `thee-michael-overlord` | THEE_MICHAEL Overlord Protocol | [THEE_MICHAEL_OVERLORD.md](./THEE_MICHAEL_OVERLORD.md) | `OverlordProtocolHost`, guide executor, `/dashboard/admin` push |
| `issue-control-plane` | Issue Control Plane | [features/ISSUE_CONTROL_PLANE.md](./features/ISSUE_CONTROL_PLANE.md) | `/dashboard/issues`, web-augmented GitOps repairs |
| `campaign-mastery` | Campaign Mastery A→Z | [features/CAMPAIGN_MASTERY.md](./features/CAMPAIGN_MASTERY.md) | Dashboard mastery panel, `theeMichaelMasteryExpert` |
| `onboarding-intelligence` | Onboarding Intelligence | [features/ONBOARDING_INTELLIGENCE.md](./features/ONBOARDING_INTELLIGENCE.md) | `/onboarding`, brand research orchestrator |

## Search routing keywords

| Query pattern | Route |
|---------------|-------|
| `THEE_MICHAEL`, `ask THEE_MICHAEL`, `admin approval` | Live Support → admin approval flow |
| `connect platform`, `oauth`, `integration` | `/integrations` |
| `fix reply`, `reply engine`, `ai replies` | `/history` |
| `campaign not posting`, `schedule`, `calendar` | `/calendar` or `/integrations` |
| `mission control`, `dashboard`, `live feed` | `/dashboard` |
| `help`, `support`, `stuck` | `/support` or Live Support panel |
| `create post`, `schedule`, `find people`, `workflow`, `plan` | Imperialism Brain prompt bar |
| `what should I improve`, `run audit`, `self heal` | Live Support → self-heal recommendations |
| `SEO`, `AEO`, `GEO`, `local SEO`, `SERP` | Live Support → SEO intelligence brief |
| `issue control`, `gitops`, `broken module` | `/dashboard/issues` |
| `campaign mastery`, `setup checklist` | Dashboard → Campaign Mastery panel |

## Approval gate

Actions matching global automation, billing, server config, or mass posting require `THEE_MICHAEL` approval before execution. See `liveSupportAgent.ts` → `requiresAdminApproval()`.

**THEE_MICHAEL Security Control** applies to every agent and surface. Actions stay pending until THEE_MICHAEL Accept or Deny. See [SOVEREIGN_THREAT_CAPTURE.md](./SOVEREIGN_THREAT_CAPTURE.md). Decrypt requires kinetic 2FA; Accept/Deny does not.