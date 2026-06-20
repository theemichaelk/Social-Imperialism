# Product Requirements Document (PRD): Social Imperialism
## Critical Development Rule
**Always check with the blueprint/PRD and do not delete or override any features when updating or adding new features.**
**When adding a feature or fixing any feature, make sure that you check with the blueprint/prd and not delete or override any features.**

## 1. Product Overview
**Name:** Social Imperialism
**Type:** Desktop Application
**Purpose:** A powerful, dashboard-driven tool designed to automate social media management, brand visibility, and engagement.
**Target Audience:** Brand owners, affiliate marketers, content creators, and agencies managing multiple client brands who want to put their social media growth on autopilot.

## 2. Complete Product & Feature Blueprint

### 1. Core Concept & Flow
#### 1.1 User Journey (High-Level)
1.  **[x] Create Project & Brand Profile**
    *   [x] Enter brand name.
    *   [x] Enter brand domain.
    *   [x] Add brand description.
    *   [x] (Optional) Brand tone, voice rules, target audience.
2.  **[x] Define Keywords & Platforms**
    *   [x] AI suggests relevant keywords based on brand data.
    *   [x] User can add/edit/delete keywords manually.
    *   [x] User selects which social platforms to track.
    *   [x] Per-platform keyword selection.
3.  **[x] Browse & Filter Posts**
    *   [x] System fetches posts matching selected keywords for chosen platforms (Simulated).
    *   [x] “Browse Posts” page (Dashboard).
    *   [x] Advanced Settings to refine what is fetched (Filters UI built, logic pending).
    *   [x] “View Post” original links.
4.  **[x] AI Reply Engine**
    *   [x] Generate tailored AI reply mentioning brand name/domain.
    *   [x] Use brand tone and guidelines.
    *   [x] Custom Prompts override per keyword/post.
    *   [x] "AI Replies" metrics must reflect 100% real data from tracked "keywords".
    *   [x] Export Data feature must be functional.
    *   [x] Command Center metrics (Total Posts Published, AI Replies Drafted, Start Auto-Rules, Worker Idle, Total Engagement, Active Keywords) must reflect real account data.
5.  **[x] Automation & Scheduling**
    *   [x] Set up automations (Auto-reply, auto-like, etc.).
    *   [x] Cron / Scheduler for daily searches.
    *   [x] Being First to Reply/Comment real-time monitors.

### 2. Detailed Feature Set
#### 2.1 Project & Brand Setup
*   **[x] User-facing features:** Wizard/Settings page capturing Name, Domain, Description, Tone.
*   **[x] Connect social accounts:** Account linking interface (Account Hub).
    *   [x] Must show all connected accounts at all times.
    *   [x] Disconnect button must function.
    *   [x] "+ Add Platform Link" must support multi-select (e.g., Facebook profiles, groups, pages; YouTube accounts within Google email).
    *   [x] Must use real API data, not mock data.
    *   [x] AI Intelligence Profile must pull real, relevant data based on social accounts.
*   **[x] Backend entities:** LocalStorage currently handling Project/Brand data.

#### 2.2 Keywords & Social Media Selection
*   **[x] AI Keyword Suggestions:** Dynamic generation via Gemini 3.1 Pro.
*   **[x] Manual Keywords:** CRUD UI built.
*   **[x] Platform Selection:** UI built, backend logic pending for 10+ platforms.

#### 2.3 Browsing Posts & Advanced Filtering
*   **[x] Core browsing:** "Post Explorer" Dashboard built with futuristic UI and charts.
*   **[x] Advanced Settings:** Save fetch profiles, language/location filters.
*   **[x] View Post:** Buttons and AI reply previews integrated.

#### 2.4 AI Replies – Brand-Mentioning & Custom Prompts
*   **[x] Key behaviors:** AI analyzes post and uses brand guidelines to generate replies.
*   **[x] Brand Mentioning:** System prompt enforces brand inclusion naturally.
*   **[x] Custom Prompts:** UI for granular prompt overrides needed.
*   **[x] Autonomous vs Approval Mode:** History page Command Center built for approvals.

#### 2.5 Real-Time Monitoring & “Be First to Reply”
*   **[x] Monitoring Targets:** Keywords and specific accounts.
*   **[x] Logic:** Polling/streaming workers needed.
*   **[x] Preventing Spam:** Rate limits and randomized delays needed.

#### 2.6 One-Click Auto Search & Multi-Platform Tracking
*   **[x] Scheduler:** Daily jobs per project.
*   **[x] Multi-Platform Tracking:** Unified search across 10+ platforms.

#### 2.7 Use-Case Oriented Features
*   **[x] Brand Visibility:** AI replies designed for acquisition.
*   **[x] Affiliate Products:** Specific keyword tagging for affiliate links.
*   **[x] Client Brands (Agency Use):** Multi-project switching support.
*   **[x] Q&A / Question Discovery:** Answer Composer and Unanswered Tracker.
*   **[x] Auto Content Creation & Scheduling:** FAL image API integration and RSS feed parsing.
*   **[x] Facebook Fanpage Automation:** Targeted fan acquisition loops.

#### 2.8 Content Hub
*   **[x] Core Features:** Unified hub for all PRD/Blueprint features. Fully functional login, post, share, reply, auto-reply rules, and scheduling.
*   **[x] Content Calendar:** View scheduled content of all types, edit, add, delete, and re-schedule.
*   **[x] Functional Buttons:** "Draft AI Reply", "Like", "Share", "View Original" must work and use AI intelligence.
*   **[x] Content Creation:** Standard Post, Video/Reel/Media, Manage Comments/Replies, Caption Writing, Drag & Drop Media (MP4, JPG, PNG).
*   **[x] Formatting:** Supports Stories & Reels formatting.
*   **[x] AI Tools:** Generate Image, Stock Photo, Enhance.
*   **[x] Publishing:** Schedule, Publish Now (with account selection). Must be fully tested by posting real content.

#### 2.9 Dashboard Widgets
*   **[x] Trending News:** Displays exactly 4 random but highly relevant titles. Clicking a title opens a new research page utilizing AI. Fix "globalKeys is not defined" error.

### 3. Technical Architecture Overview
1.  **[x] API Gateway / Backend Service:** Currently using Electron IPC and Node logic. Needs expansion for OAuth.
2.  **[x] Workers & Schedulers:** Redis/Queue system needed for background polling.
3.  **[x] Databases:** Currently using `node-localstorage`. Needs migration to Prisma/SQLite or Postgres for relational data.
4.  **[x] AI Layer:** Gemini 3.1 Pro integrated. FAL API pending.
5.  **[x] Integrations:** Social APIs (Meta, X, LinkedIn, etc.) pending.

### 4. Data Model (Key Entities)
*   **[x] users**
*   **[x] projects** (brand + domain + description + guidelines)
*   **[x] social_accounts** (per platform, with encrypted tokens)
*   **[x] keywords** (with per-platform flags and custom prompts)
*   **[x] platform_settings** (per project & platform – frequency, auto vs manual)
*   **[x] posts** (fetched external posts, with metadata)
*   **[x] ai_replies** (generated replies for posts, with status: draft, sent, failed)
*   **[x] automations** (rules: watch keywords/accounts, auto reply, schedule content, like, share, follow, unfollow, first to comment/reply)
*   **[x] rss_feeds** (source URLs linked to projects)
*   **[x] scheduled_posts** (content to be published later)
*   **[x] notifications** (email/Slack/Discord events & subscriptions)
*   **[x] metrics** (stats per project: replies sent, clicks if tracked, page growth)

## 5. Next Steps & Development Plan
1. **[x] Auto-Rules Engine:** Build the scheduling and automation rules interface.
2. **[x] Account Linking:** Build the OAuth/Token connection interface for the 10+ target platforms.
3. **[~] Database Migration:** Prisma schema defined; runtime still uses `node-localstorage` via `entityStore.js`.
4. **[~] Worker Queues:** In-process `workerLoop()` runs auto-search, be-first, RSS, fanpage; Redis/Bull queue is stub only.

## 6. Blueprint Implementation Audit (June 2026)

### Fully implemented
- **Project setup:** brand name, domain, description, tone, audience, guidelines, affiliate/USPs (`onboarding.html`, `settings.html`)
- **Keywords:** AI suggest, manual CRUD, per-platform selection, intent tags (brand/affiliate/client/qa), custom prompts (`keywords.html`)
- **Browse Posts:** pagination, advanced filters, fetch profiles, view post, engage, AI reply preview (`dashboard.html`)
- **AI Replies:** brand mention, global/keyword/post custom prompts, approval vs auto modes (`history.html`, `brandGuidelines.js`)
- **Be First to Reply:** watch keyword/account/page/post, worker polling, delay jitter, rate limits (`workerMonitor.js`, `rules.html`)
- **One-Click Auto Search:** manual + scheduled (5m–monthly), dashboard frequency control (`trigger-full-auto-search`)
- **Q&A suite:** discover questions, answer composer, unanswered tracker, email/Slack/Discord notifications (`qaDiscovery.js`, `quora-traffic-ops.html`)
- **Auto content:** AI text + FAL images + RSS curation + calendar scheduling (`content-hub.html`, `calendar.html`)
- **Facebook Fanpage:** RSS auto-post, fan acquisition engagement, hands-free worker (`fanpageAutomation.js`)
- **Agency multi-project:** campaign CRUD + per-campaign keywords/accounts (`settings.html`)
- **All 14 platforms in UI:** Facebook, Instagram, WhatsApp, YouTube, TikTok, X, Pinterest, Snapchat, Threads, Twitch, LinkedIn, Reddit, Discord, Telegram (`platformCatalog.js`)

### Partial — UI + connect/publish exist; depth varies by platform
| Area | Status |
|------|--------|
| **Keyword feed/search** | API-native: Reddit, Twitter, Quora. Web-discovery: all 14 sites via `discoverAllPlatformPosts`. Linked-account timelines: Meta, YouTube. |
| **Publish** | Working: Twitter, LinkedIn, Meta/IG, Reddit, YouTube, TikTok, Discord, Telegram, WhatsApp, Quora. Pinterest: board + image required. Threads/Snapchat/Twitch: connect only. |
| **Engage (like/reply)** | Twitter, LinkedIn, Facebook, Instagram, Reddit, Quora. |
| **WhatsApp** | Business API connect + publish; no public post search (by design). |
| **Backend** | localStorage + in-process worker (not Prisma/Redis production stack). |

### Remaining engineering (not omitted from blueprint — staged)
1. Prisma runtime migration from localStorage
2. Redis/Bull job queue for worker tasks
3. Threads / Snapchat / Twitch native publish APIs
4. Stripe billing (SaaS blueprint §3.1)
5. Full API engage on web-discovered posts (platform API limits)
