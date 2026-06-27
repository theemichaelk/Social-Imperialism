# Mobile API Contract

Native iOS and Android apps share the same SaaS backend as web/desktop.

## Base URL

| Environment | URL |
|-------------|-----|
| Production | `https://api.socialimperialism.com` |
| Local dev | `http://localhost:4000` |

## Authentication

```
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/me
```

**Headers (authenticated requests):**

```
Authorization: Bearer <jwt>
x-project-id: <projectId>
Content-Type: application/json
```

**Session storage:**

| Platform | Storage |
|----------|---------|
| iOS | Keychain (`si_token`, `si_project_id`) |
| Android | EncryptedSharedPreferences |

Reject stale project IDs starting with `camp_`. On `project not found`, clear project ID and re-fetch `/api/auth/me`.

## Invoke bridge

```
POST /api/invoke/:channel
Body: { "args": [ ... ] }
Response: { "success": true, "data": <handler result>, "pendingOAuthUrl": "..." }
```

Checkout responses embed `checkoutUrl` in `data` (handler return value). Mobile clients should also check top-level envelope if added later.

## MVP channels

### Mission Control

| Channel | Args | Returns |
|---------|------|---------|
| `get-dashboard-stats` | `[]` | `{ totalPosts, aiDrafts, totalEngagement, activeKeywords, linkedAccounts, scheduled, workerStatus, autoRulesEnabled }` |

### Create (Quick Post)

| Channel | Args | Returns |
|---------|------|---------|
| `get-linked-accounts` | `[]` | `LinkedAccount[]` |
| `generate-ai` | `[prompt: string]` | `string` |
| `publish-post` | `[{ accountId, platform, content, hasMedia, humanLike }]` | `{ success, error? }` |
| `schedule-post` | `[{ platform, accountId, content, scheduleTime, mediaUrl? }]` | schedule record |

### Prompt Vault

| Channel | Args | Returns |
|---------|------|---------|
| `search-prompt-vault` | `[{ query, keyword }]` | `{ prompts[], count }` |
| `load-prompt-vault-item` | `[{ id }]` | `{ success, prompt, item }` |

### Engage

| Channel | Args | Returns |
|---------|------|---------|
| `get-engagement-queue` | `[]` | `EngagementQueueItem[]` |
| `retry-engagement-queue` | `[]` | processing results |

### Billing (premium gate)

| Channel | Args | Returns |
|---------|------|---------|
| `get-billing-plan` | `[]` | `{ plan, planName, status, priceLabel, billingEmail, catalog, allPlans }` |
| `create-subscription-checkout` | `[{ planId, billingEmail }]` | `{ success, checkoutUrl?, error? }` |

**Paywall rule:** Gate Create, Vault, and Engage when `status !== "active"`.

**Plans:** `starter` ($49/mo), `growth` ($149/mo), `enterprise` (sales).

## Deep links

| Platform | Scheme |
|----------|--------|
| iOS / Android | `socialimperialism://billing/success` |
| Cancel | `socialimperialism://billing/cancel` |

Configure Stripe success/cancel URLs to these schemes when testing mobile checkout return.

## Projects

```
apps/mobile-ios/     SwiftUI — see README.md
apps/mobile-android/ Jetpack Compose — see README.md
```

`apps/mobile/` (Expo) is archived; use native projects above.