# Social Imperialism — SaaS Edition

Cloud-hosted version of the desktop app with **full feature parity** via IPC bridge.

## Architecture

```
apps/
  web/       Next.js 14 — all 18 pages, JWT auth
  api/       Express — REST + /api/invoke/:channel (180+ handlers)
  worker/    Background jobs (scheduled publish, auto-rules)
  desktop/   Original Electron app (unchanged)
packages/
  db/        Prisma + SQLite/Postgres multi-tenant schema
  core/      PrismaStore + desktop service bridge
```

## Quick Start

```powershell
cd "E:\OneDrive\Documents\Factory AI.02.20.26\Social Imperialism"
npm install
copy apps\api\.env.example apps\api\.env
npm run db:push
npm run db:seed
npm run dev
```

- **Web:** http://localhost:3000
- **API:** http://localhost:4000
- **Login:** admin@acmegrowth.com / admin123 (after seed)

## Feature Coverage

| Desktop Page | SaaS Route | Backend |
|-------------|------------|---------|
| Dashboard | /dashboard | get-live-feed, get-dashboard-stats, trending |
| Browse Posts | /browse-posts | draft-post-reply, engage |
| Setup Wizard | /onboarding | get-setup-status, save-settings |
| Content Hub | /content-hub | publish-post, generate-ai |
| Calendar | /calendar | schedule-post, publish-scheduled-post-now |
| Engagement | /engagement | engagement lists IPC |
| AI Replies | /history | get-ai-replies, publish-ai-reply |
| Keywords | /keywords | generate-keywords, CRUD |
| SEO Tools | /seo-tools | run-seo-tool |
| Growth Lab | /reddit-ai | reddit AI modules |
| Quora Ops | /quora-traffic | quora traffic ops |
| Visual Builder | /automations | automation flow IPC |
| Auto-Rules | /rules | auto-rules engine |
| Account Hub | /account-hub | connect-platform, linked accounts |
| Acct Creator | /account-creator | profile kits |
| Settings | /settings | global keys, billing |

All desktop IPC channels are available at `POST /api/invoke/:channel`.

## Production

1. Set `DATABASE_URL` to PostgreSQL
2. Set `JWT_SECRET` and Stripe keys
3. Deploy API + worker + web (Vercel/Railway/Fly)
4. Copy `apps/desktop/.env` API keys to server environment