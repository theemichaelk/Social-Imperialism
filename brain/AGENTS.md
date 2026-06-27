# Agent Registry

| ID | Name | System prompt | Surfaces |
|----|------|---------------|----------|
| `live-support-growth` | Live Support Growth Agent | [LIVE_SUPPORT_AGENT.md](./LIVE_SUPPORT_AGENT.md) | Web panel (`LiveSupportPanel`), `/support`, sidebar search routing |
| `guardian-gatekeeper` | Guardian & Self-Healing Gatekeeper | [GUARDIAN_GATEKEEPER.md](./GUARDIAN_GATEKEEPER.md) | Settings → Guardian & API, Partner API `/guardian/status`, inbound `/guardian/hooks/:id` |
| `sovereign-threat-capture` | Sovereign Threat Capture Layer | [SOVEREIGN_THREAT_CAPTURE.md](./SOVEREIGN_THREAT_CAPTURE.md) | API edge shield, Settings → Sovereign panel, all modules — see [features/SOVEREIGN_THREAT_CAPTURE.md](./features/SOVEREIGN_THREAT_CAPTURE.md) |
| `omni-brain-planner` | Omni-Brain Strategic Workflow Planner | [OMNI_BRAIN_PLANNER.md](./OMNI_BRAIN_PLANNER.md) | Universal prompt bar (`OmniBrainPromptBar`), all authenticated pages |
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
| `create post`, `schedule`, `find people`, `workflow`, `plan` | Omni-Brain prompt bar |

## Approval gate

Actions matching global automation, billing, server config, or mass posting require `THEE_MICHAEL` approval before execution. See `liveSupportAgent.ts` → `requiresAdminApproval()`.

**Sovereign Threat Capture** applies to every agent and surface on socialimperialism.com. Security events use the template in [SOVEREIGN_THREAT_CAPTURE.md](./SOVEREIGN_THREAT_CAPTURE.md). Decrypt, production patch, and live release require kinetic 2FA through the registered administrator channel.