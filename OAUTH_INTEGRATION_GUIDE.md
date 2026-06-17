# Social Imperialism: Complete OAuth & API Integration Guide

This guide details exactly how to create developer applications, obtain the necessary API credentials, and configure the OAuth 2.0 scopes for all 12 supported platforms in Social Imperialism.

**Important Global Configuration:**
*   All redirect URIs / callbacks must match the custom protocol handler: `social-imperialism://oauth-callback`
*   Add these keys to your `.env` file in the root `apps/desktop` directory.

---

## 1. Twitter / X (OAuth 2.0)
You will use the modern X API v2 with OAuth 2.0.

1.  **Portal:** Go to the [X Developer Portal](https://developer.x.com/en/portal/dashboard).
2.  **Create App:** Click **Create App**, give it a name ("Social Imperialism").
3.  **User Authentication Settings:** Click **Set up** under User authentication.
4.  **Configuration:**
    *   **App permissions:** Read and Write (needed to publish).
    *   **Type of App:** Native App (desktop apps fall under this).
    *   **Callback URI / Redirect URL:** `social-imperialism://oauth-callback`
    *   **Website URL:** Your website URL (required).
5.  **Save Credentials:** Copy the **Client ID** and **Client Secret**.

**Scopes needed:** `tweet.read`, `tweet.write`, `users.read`, `offline.access`

**.env Configuration:**
```env
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
```

---

## 2. LinkedIn (OAuth 2.0)
You need access to the "Share on LinkedIn" and "Sign In with LinkedIn" products.

1.  **Portal:** Go to [LinkedIn Developers](https://developer.linkedin.com/).
2.  **Create App:** Click **My apps** -> **Create app**.
3.  **Configuration:** Fill in the App name, associate it with your Company Page, upload a logo, and verify.
4.  **Products:** Navigate to the **Products** tab and request access to:
    *   Sign In with LinkedIn using OpenID Connect
    *   Share on LinkedIn
5.  **Auth Settings:** Go to the **Auth** tab.
    *   Add Redirect URL: `social-imperialism://oauth-callback`
6.  **Save Credentials:** Under "Application credentials", copy the **Client ID** and **Client Secret**.

**Scopes needed:** `openid`, `profile`, `email`, `w_member_social`

**.env Configuration:**
```env
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
```

---

## 3. Meta Platforms (Facebook, Instagram, WhatsApp, Threads)
All Meta platforms are managed through the single Meta for Developers portal.

1.  **Portal:** Go to [Meta for Developers](https://developers.facebook.com/).
2.  **Create App:** Click **My Apps** -> **Create App**.
3.  **Type:** Select **Business** or **Other** (depending on exact business verification status).
4.  **Setup Products:** Add the following products to your app:
    *   **Facebook Login for Business** (for Facebook Page access).
    *   **Instagram Graph API** (for Instagram accounts linked to FB Pages).
    *   **WhatsApp Business API** (requires a Meta Business Manager account).
    *   **Threads API** (new, separate product card).
5.  **Auth Settings (Facebook Login):**
    *   Under Facebook Login -> Settings, enable "Login with the JavaScript SDK" or standard OAuth.
    *   Valid OAuth Redirect URIs: `social-imperialism://oauth-callback` (Note: Meta often requires `https` or `localhost`, you may need a local relay server like `http://localhost:3000/callback` that bounces to the custom protocol).
6.  **Save Credentials:** Go to **App Settings** -> **Basic** and copy the **App ID** and **App Secret**.

**Scopes needed:**
*   **Facebook:** `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `public_profile`
*   **Instagram:** `instagram_basic`, `instagram_content_publish`, `pages_show_list`
*   **WhatsApp:** `whatsapp_business_messaging`, `whatsapp_business_management`
*   **Threads:** `threads_basic`, `threads_content_publish`

**.env Configuration:**
```env
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
```

---

## 4. YouTube (Google OAuth 2.0)
Google manages YouTube through the Google Cloud Console.

1.  **Portal:** Go to [Google Cloud Console](https://console.cloud.google.com/).
2.  **Create Project:** Create a new project named "Social Imperialism".
3.  **Enable APIs:** Go to **APIs & Services** -> **Library**. Search for and enable the **YouTube Data API v3**.
4.  **OAuth Consent Screen:** Go to **APIs & Services** -> **OAuth consent screen**.
    *   Select **External**.
    *   Fill in app name, support email, and developer contact.
    *   Add scopes: `https://www.googleapis.com/auth/youtube.upload`, `https://www.googleapis.com/auth/youtube.readonly`
5.  **Create Credentials:** Go to **Credentials** -> **Create Credentials** -> **OAuth client ID**.
    *   Application type: **Desktop app**.
    *   Name: Social Imperialism Desktop.
6.  **Save Credentials:** Copy the **Client ID** and **Client Secret**.

**Scopes needed:** `https://www.googleapis.com/auth/youtube.upload`

**.env Configuration:**
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

---

## 5. TikTok (OAuth 2.0)
TikTok requires registering a developer account for the Login Kit and Content Posting API.

1.  **Portal:** Go to [TikTok for Developers](https://developers.tiktok.com/).
2.  **Create App:** Click **Manage Apps** -> **Add an app**.
3.  **App Details:** Provide name, icon, description, and website URL.
4.  **Products:** Ensure you request access to:
    *   Login Kit
    *   Content Posting API (or Video Kit).
5.  **Auth Settings:** Add the Redirect URI: `social-imperialism://oauth-callback`
6.  **Save Credentials:** Copy the **Client Key** and **Client Secret**.

**Scopes needed:** `user.info.basic`, `video.publish`, `video.upload`

**.env Configuration:**
```env
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
```

---

## 6. Pinterest (OAuth 2.0)
1.  **Portal:** Go to [Pinterest Developers](https://developers.pinterest.com/).
2.  **Create App:** Click **Connect your app**.
3.  **App Details:** Fill in the application name and description.
4.  **Auth Settings:** Add the Redirect URI: `social-imperialism://oauth-callback`
5.  **Save Credentials:** Copy the **App ID** and **App Secret**.

**Scopes needed:** `boards:read`, `boards:write`, `pins:read`, `pins:write`

**.env Configuration:**
```env
PINTEREST_APP_ID=your_app_id
PINTEREST_APP_SECRET=your_app_secret
```

---

## 7. Snapchat (Snap Kit)
1.  **Portal:** Go to [Snap Kit Portal](https://kit.snapchat.com/portal).
2.  **Create App:** Click **Create App** and give it a name.
3.  **Select Kits:** Choose **Login Kit** and **Creative Kit** (for sharing).
4.  **Auth Settings:** Under the Setup section, configure your Platforms. For Desktop, you may need to register it as a Web App or use their specific desktop flows.
    *   Add Redirect URI: `social-imperialism://oauth-callback`
5.  **Save Credentials:** Copy the **Client ID**.

**Scopes needed:** `https://auth.snapchat.com/oauth2/api/user.display_name`

**.env Configuration:**
```env
SNAPCHAT_CLIENT_ID=your_client_id
SNAPCHAT_CLIENT_SECRET=your_client_secret
```

---

## 8. Discord (OAuth 2.0)
1.  **Portal:** Go to [Discord Developer Portal](https://discord.com/developers/applications).
2.  **Create App:** Click **New Application**.
3.  **OAuth2 Settings:** Go to the **OAuth2** tab.
    *   Add Redirect URI: `social-imperialism://oauth-callback`
4.  **Bot Setup:** If you intend to post to channels, you will need to create a Bot user under the **Bot** tab.
5.  **Save Credentials:** Under OAuth2 -> General, copy the **Client ID** and **Client Secret**.

**Scopes needed:** `identify`, `guilds`, `bot`, `messages.read`

**.env Configuration:**
```env
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
```

---

## 9. Telegram (Bot API / Login Widget)
Telegram doesn't use standard OAuth 2.0 in the same way. You authenticate via phone number or Telegram Login Widget, and publish via the Bot API.

1.  **Portal:** Open Telegram and search for the `@BotFather`.
2.  **Create Bot:** Send `/newbot` and follow the prompts.
3.  **Save Credentials:** BotFather will give you a **Bot Token** (e.g., `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`).
4.  **Authentication:** The app will need to ask the user to forward a message to the bot to link their account (chat ID), or use the Telegram Login Widget for web authentication.

**.env Configuration:**
```env
TELEGRAM_BOT_TOKEN=your_bot_token
```

---

## 10. Reddit (OAuth 2.0)
1.  **Portal:** Go to [Reddit App Preferences](https://www.reddit.com/prefs/apps).
2.  **Create App:** Click **create another app...**
3.  **Type:** Choose **installed app** (for desktop/mobile apps).
4.  **Auth Settings:** Add the Redirect URI: `social-imperialism://oauth-callback`
5.  **Save Credentials:** Copy the **Client ID** (under the app name) and the **Client Secret**.

**Scopes needed:** `identity`, `submit`, `read`

**.env Configuration:**
```env
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
```

---

## Final Setup

Once you have gathered these keys, place them inside an `.env` file in the same directory as your `package.json` (`apps/desktop/`). 

The `index.js` file has been updated to read these environment variables and construct the proper OAuth authorization URLs when a user clicks "Connect" on the frontend.
