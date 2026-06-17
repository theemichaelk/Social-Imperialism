# Social Imperialism - Master API Reference & Intelligence Guide

This document serves as the internal brain for Social Imperialism's AI when it needs to implement new API connections, build data pullers, or understand how to interact with different social platforms.

## Core Directives

1. **When adding a new platform**: Read the relevant section below to understand the authentication flow (OAuth 2.0 vs API Keys) and the available endpoints.
2. **Account Intelligence Profile**: When an account is linked, the AI uses these endpoints to pull raw data (followers, likes, impressions) and generates a profile containing:
   - Growth Velocity (followers gained / time)
   - Best Posting Times (analyzed from historical engagement)
   - Audience Demographics
   - Niche Trending Topics

---

## 1. Reddit Developer API

**Documentation Hub**: [https://developers.reddit.com/](https://developers.reddit.com/)
**Authentication**: OAuth 2.0 (Confidential Clients require `client_id` and `client_secret`)

### Key Capabilities for Social Imperialism
- **Authentication**: `https://www.reddit.com/api/v1/access_token`
- **User Identity**: `GET /api/v1/me` (Karma, account age, verified status)
- **Subreddit Discovery**: `GET /subreddits/popular` or `GET /subreddits/search`
- **Posting**: `POST /api/submit` (Supports text, link, image/video)
- **Engagement**: `POST /api/vote` (Upvote/Downvote), `POST /api/comment`
- **Trends**: `GET /r/all/hot` or `GET /r/{subreddit}/hot`

### Intelligence Profile Strategy (Reddit)
- Pull top 100 historical comments/posts for the user.
- Analyze karma distribution to determine which subreddits the brand performs best in.
- Monitor `/r/all/hot` filtered by brand keywords to discover engagement opportunities.

---

## 2. TikTok API for Business & Creators

**Documentation Hub**: [https://developers.tiktok.com/doc/overview/](https://developers.tiktok.com/doc/overview/)
**Creative Center (Trends)**: [https://ads.tiktok.com/business/creativecenter/pc/en](https://ads.tiktok.com/business/creativecenter/pc/en)

### Key Capabilities for Social Imperialism
- **Login Kit**: OAuth 2.0 to access user profiles and videos.
- **Content Posting API**: `POST /v2/post/publish/video/init/` (Direct posting to TikTok). Requires specific scope approvals.
- **Data Portability API**: Access to historical video metrics (views, likes, shares, comments).
- **Research API**: (If approved) Deep access to public video data and trends.
- **Trending Intelligence**: TikTok Creative Center API provides top hashtags, trending songs, and top creators by region.

### Intelligence Profile Strategy (TikTok)
- Pull historical video metrics to calculate average engagement rate (Likes + Comments + Shares / Views).
- Use timestamp data from top-performing videos to map exact "Best Time to Post" for that specific creator.
- Map the creator's dominant hashtags against the Creative Center's current trending hashtags to recommend new content angles.

---

## 3. Quora API

**Documentation Hub**: [https://www.quora.com/api/docs](https://www.quora.com/api/docs)
*(Note: Quora's public API is notoriously restricted. Advanced integrations often require partner access or headless browser automation for specific read operations, though official endpoints exist for partner networks).*

### Key Capabilities for Social Imperialism (Partner/Official Routes)
- **Identity**: Profile data, follower counts, credential tags.
- **Spaces**: Reading Space posts, following Spaces.
- **Engagement**: Answering questions, upvoting, commenting.
- **Discovery**: Searching for questions related to brand keywords that have high view counts but few answers (The "Imperialism" strategy).

### Intelligence Profile Strategy (Quora)
- Scan the user's historical answers to determine their "Expertise Authority" score (Views per Answer).
- Monitor Quora for high-traffic questions containing the brand's keywords and flag them in the Social Imperialism dashboard as immediate targets for engagement.

---

## 4. WhatsApp Business API (Cloud API)

**Documentation Hub**: Meta for Developers (WhatsApp Cloud API)

### Key Capabilities for Social Imperialism
- **Messaging**: Sending template messages (for marketing/updates) and free-form messages (within the 24-hour customer service window).
- **Communities/Groups**: Managing group metadata, sending broadcasts to opted-in lists.
- **Automation**: Setting up auto-replies based on keyword triggers.

### Intelligence Profile Strategy (WhatsApp)
- Track message open rates and reply rates to determine list health.
- Segment audiences based on which keywords they use when messaging the business number.

---

## 5. Facebook Groups & Pages

**Documentation Hub**: Meta Graph API

### Key Capabilities for Social Imperialism
- **Pages**: `POST /{page-id}/feed` (Publishing), `GET /{page-id}/insights` (Demographics, reach, engagement).
- **Groups**: `POST /{group-id}/feed` (Publishing to groups where the user is an admin or has permissions).
- **Engagement**: Replying to comments on Page posts automatically.

### Intelligence Profile Strategy (Facebook)
- Pull Page Insights to determine the exact age, gender, and geographic location of the audience.
- Calculate peak online times using the `page_fans_online` metric.

---

## Universal API Tracking Protocol

When Social Imperialism needs to integrate a new tool not listed above:
1. Refer to [APITracker.io](https://apitracker.io) to locate the official documentation and SDKs.
2. Determine if the API is REST or GraphQL.
3. Identify the authentication method (OAuth2, Bearer Token, API Key).
4. Map the necessary scopes required for Social Imperialism's features.
5. Create a simulated/mock version of the API in `index.js` first for UI testing, then replace it with the live `fetch` or SDK calls once API keys are provided.
