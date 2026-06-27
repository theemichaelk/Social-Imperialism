# Social Imperialism — iOS (SwiftUI)

Native iOS client for the Social Imperialism SaaS API.

## Requirements

- macOS with Xcode 15+
- iOS 17+ deployment target

## Open in Xcode

1. In Xcode: **File → New → Project → App** (or open if you already created `SocialImperialism.xcodeproj`).
2. Add all files under `SocialImperialism/` to the app target.
3. Set **Bundle Identifier** to `com.socialimperialism.mobile`.
4. Copy `Info.plist` URL scheme (`socialimperialism://`) for Stripe return deep links.
5. Build and run on simulator or device.

Alternatively, drag the `SocialImperialism` folder into a new SwiftUI App project and replace the generated `App` file with `SocialImperialismApp.swift`.

## API

Production default: `https://api.socialimperialism.com`

Override for local dev:

```bash
SI_API_URL=http://localhost:4000
```

Set in Xcode scheme → Run → Arguments → Environment Variables.

## MVP tabs

| Tab | Channels |
|-----|----------|
| Mission Control | `get-dashboard-stats` |
| Create | `get-linked-accounts`, `generate-ai`, `publish-post`, `schedule-post` |
| Vault | `search-prompt-vault`, `load-prompt-vault-item` |
| Engage | `get-engagement-queue`, `retry-engagement-queue` |
| Settings | `get-billing-plan`, `create-subscription-checkout` |

## Billing

Premium features gate when `billing.status !== "active"`. Checkout opens in `SFSafariViewController`.

Deep link returns: `socialimperialism://billing/success` (configure in Stripe success URL).