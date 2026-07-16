# Mobile API Contract

Expo Command Center (`apps/mobile`) and native shells share the same SaaS backend as web/desktop.

## Base URL

| Environment | URL |
|-------------|-----|
| Production | `https://api.socialimperialism.com` |
| Local dev | `http://localhost:4000` |
| Expo web | Same-origin `/api/*` proxy via `metro.config.js` |

## Authentication

```
POST /api/auth/login
POST /api/auth/logout
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
| iOS / Android | SecureStore with memory fallback (`si_token`, `si_project_id`) |
| Web | localStorage |

Reject stale project IDs starting with `camp_`. On `project not found`, clear project ID and re-fetch `/api/auth/me`.

## Brands / projects

```
GET  /api/orgs/projects
POST /api/orgs/projects
POST /api/orgs/projects/:id/activate
PATCH /api/orgs/projects/:id
```

Also available on `GET /api/auth/me` as `projects`, `project`, `billing`.

**Plan brand limits (API):**

| Plan | Max brands |
|------|------------|
| free / trial / inactive | 1 |
| starter | 3 |
| growth | 10 |
| enterprise / other | 50 |

On limit: `403` with `code: PLAN_BRAND_LIMIT`, `planLimit: true`, friendly error string.

## Invoke bridge

```
POST /api/invoke/:channel
Body: { "args": [ ... ] }
Response: { "success": true, "data": <handler result>, "pendingOAuthUrl": "..." }
```

## Mobile Command Center v2 screens

| Tab | Primary channels / routes |
|-----|---------------------------|
| Home | `get-dashboard-stats`, `get-live-feed`, brand switcher |
| Browse | `get-live-feed` (+ platform filters) |
| Content | `get-linked-accounts`, `generate-ai`, `publish-post` |
| Studio | `generate-ai` briefs + web deep links |
| More | web deep links + sign out |

## Billing

| Channel | Returns |
|---------|---------|
| `get-billing-plan` | plan status |
| `create-subscription-checkout` | checkoutUrl |

Deep links: `socialimperialism://billing/success` / `cancel`

## Offline cache (v2.2)

Client caches invoke results in AsyncStorage / localStorage:

| Key pattern | Source | TTL |
|-------------|--------|-----|
| `{projectId}:dashboard-stats` | `get-dashboard-stats` | 10m |
| `{projectId}:live-feed-quick` | `get-live-feed` | 5m |
| `{projectId}:ai-replies` | `get-ai-replies` | 10m |

On network failure, last good payload is served with an offline banner.

## Push notifications

```
POST   /api/mobile/device-token     { token, platform, appVersion }
DELETE /api/mobile/device-token     { token }
GET    /api/mobile/device-tokens
POST   /api/mobile/notify           { title, body, data? }
```

Native: Expo push token via `expo-notifications`. Web: browser `Notification` for local alerts.

## Deploy

```powershell
npm run deploy:mobile
# or: apps/mobile/scripts/deploy-mobile.ps1
```

Publishes Expo web export to `apps/web/public/mobile`, `s3://social-imperialism/static/mobile/`, and `s3://social-imperialism/mobile/`.

## App path

```
apps/mobile/     Expo Router — Command Center v2.2 (primary mobile UI)
apps/mobile-ios/ SwiftUI shell
apps/mobile-android/ Jetpack Compose shell
```
