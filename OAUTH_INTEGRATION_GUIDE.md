# Social Imperialism: OAuth & API Integration Guide

Production SaaS uses **HTTPS web callbacks**. Desktop Electron uses the custom protocol fallback.

## Global redirect URIs (register ALL of these)

| Environment | Redirect URI |
|-------------|--------------|
| **Production (primary)** | `https://www.socialimperialism.com/oauth/callback` |
| **Production (apex)** | `https://socialimperialism.com/oauth/callback` |
| **Desktop app only** | `social-imperialism://oauth-callback` |

**Website URL** (required by most consoles): `https://www.socialimperialism.com`

Copy-paste reference also lives in **Integrations Hub** inside the dashboard.

---

## 1. X / Twitter

1. [X Developer Portal](https://developer.x.com/en/portal/dashboard) → Create App
2. **User authentication** → App permissions: Read and Write
3. **Type:** Web App or Native App
4. **Callback URI:** `https://www.socialimperialism.com/oauth/callback`
5. Scopes: `tweet.read`, `tweet.write`, `users.read`, `offline.access`

```env
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
```

---

## 2. LinkedIn

1. [LinkedIn Developers](https://www.linkedin.com/developers/apps) → Create app
2. Products: Sign In with LinkedIn, Share on LinkedIn
3. **Auth → Redirect URLs:** `https://www.socialimperialism.com/oauth/callback`
4. Scopes: `openid`, `profile`, `email`, `w_member_social`, `w_organization_social`

```env
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
```

---

## 3. Meta (Facebook, Instagram, Threads)

1. [Meta for Developers](https://developers.facebook.com/apps) → Create Business app
2. Add products: Facebook Login, Instagram Graph API, Threads API
3. **Facebook Login → Settings → Valid OAuth Redirect URIs:**
   `https://www.socialimperialism.com/oauth/callback`

```env
META_APP_ID=...
META_APP_SECRET=...
```

---

## 4. YouTube (Google Cloud)

1. [Google Cloud Console](https://console.cloud.google.com/) → Create project
2. Enable **YouTube Data API v3**
3. OAuth consent screen → External
4. **Credentials → OAuth client ID → Web application** (not Desktop)
5. **Authorized redirect URIs:** `https://www.socialimperialism.com/oauth/callback`

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## 5. TikTok

1. [TikTok Developers](https://developers.tiktok.com/) → Add app
2. Products: Login Kit, Content Posting API
3. **Redirect URI:** `https://www.socialimperialism.com/oauth/callback`

```env
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
```

---

## 6. Pinterest

1. [Pinterest Developers](https://developers.pinterest.com/)
2. **Redirect URI:** `https://www.socialimperialism.com/oauth/callback`

```env
PINTEREST_APP_ID=...
PINTEREST_APP_SECRET=...
```

---

## 7. Reddit

1. [Reddit App Preferences](https://www.reddit.com/prefs/apps)
2. Create app type: **web app** (not installed app for SaaS)
3. **Redirect URI:** `https://www.socialimperialism.com/oauth/callback`

```env
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
```

---

## 8. Discord

1. [Discord Developer Portal](https://discord.com/developers/applications)
2. OAuth2 → Redirects: `https://www.socialimperialism.com/oauth/callback`

```env
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
```

---

## 9. Twitch

1. [Twitch Developer Console](https://dev.twitch.tv/console/apps)
2. OAuth Redirect URLs: `https://www.socialimperialism.com/oauth/callback`

```env
TWITCH_CLIENT_ID=...
TWITCH_CLIENT_SECRET=...
```

---

## 10. Snapchat

1. [Snap Kit Portal](https://kit.snapchat.com/portal)
2. Login Kit → Redirect URI: `https://www.socialimperialism.com/oauth/callback`

```env
SNAPCHAT_CLIENT_ID=...
SNAPCHAT_CLIENT_SECRET=...
```

---

## 11. Telegram (Bot API)

No OAuth redirect — use BotFather token:

```env
TELEGRAM_BOT_TOKEN=...
```

---

## Where to put keys

| Environment | Location |
|-------------|----------|
| **Production API** | `apps/api/.env` (bundled in EB deploy) or Settings → API Keys per org |
| **Local dev** | `apps/desktop/.env` and `apps/api/.env` |

After adding keys, go to **Account Hub → OAuth Connect**. A browser popup opens to the provider; after approval you return to Account Hub automatically.

---

## Machine-readable config

See `deploy/oauth-console-setup.json` for the full platform list with console URLs and scopes.