# Social Imperialism — Android (Jetpack Compose)

Native Android client for the Social Imperialism SaaS API.

## Requirements

- Android Studio Ladybug or newer
- JDK 17
- Android SDK 35

## Build & run

```bash
cd apps/mobile-android
./gradlew :app:assembleDebug
./gradlew :app:installDebug
```

Or open the folder in Android Studio and run on emulator/device.

## API

Production: `BuildConfig.API_BASE` = `https://api.socialimperialism.com`

Override in `app/build.gradle.kts` `buildConfigField` for local dev.

## MVP tabs

| Tab | Channels |
|-----|----------|
| Mission Control | `get-dashboard-stats` |
| Create | `get-linked-accounts`, `generate-ai`, `publish-post`, `schedule-post` |
| Vault | `search-prompt-vault`, `load-prompt-vault-item` |
| Engage | `get-engagement-queue`, `retry-engagement-queue` |
| Settings | `get-billing-plan`, `create-subscription-checkout` |

## Billing

Premium features gate when `billing.status !== "active"`. Checkout opens in Chrome Custom Tabs.

Deep link: `socialimperialism://billing/success` (registered in `AndroidManifest.xml`).