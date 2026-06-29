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

## Approval gate

Actions matching global automation, billing, server config, or mass posting require `THEE_MICHAEL` approval before execution. See `liveSupportAgent.ts` → `requiresAdminApproval()`.

**THEE_MICHAEL Security Control** applies to every agent and surface. Actions stay pending until THEE_MICHAEL Accept or Deny. See [SOVEREIGN_THREAT_CAPTURE.md](./SOVEREIGN_THREAT_CAPTURE.md). Decrypt requires kinetic 2FA; Accept/Deny does not.