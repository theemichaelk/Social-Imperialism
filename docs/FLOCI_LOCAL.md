# Floci for local S3 (stop burning Amplify / S3 charges)

## What is [floci-ui](https://github.com/floci-io/floci-ui)?

**Floci UI** is the **web console** for the Floci ecosystem — an open-source, local-first “AWS Console style” dashboard.

| Piece | Role | Port (default) |
|-------|------|----------------|
| **Floci core** (`floci/floci`) | Local AWS emulator (S3, DynamoDB, SQS, Lambda, …) — drop-in LocalStack-style on **4566** | `4566` |
| **floci-ui frontend** | React/Vite Cloud Explorer + Console Home | `4500` |
| **floci-ui API** | Cloud Proxy adapters (AWS / Azure / GCP) → local runtimes | `4501` |

### What floci-ui actually does today

- **Storage (best):** browse S3 buckets/objects, upload/download/delete, prefix folders (AWS, Azure Blob, GCP GCS via adapters).
- **AWS extras:** EC2, VPC/networking, EKS list/inspect, RDS list/inspect, Lambda (serverless schema), Secrets Manager page.
- **Azure:** Cosmos DB NoSQL workflows; other categories often placeholders.
- **GCP:** storage wired; other services often placeholders.
- **Rules:** no fake/demo rows — only real data from the local emulator (or explicit placeholders).

### How to run floci-ui alone (optional)

```bash
git clone https://github.com/floci-io/floci-ui.git
cd floci-ui
docker compose up          # AWS-only: UI :4500, API :4501, Floci :4566
# or
docker compose --profile multicloud up
```

Open http://localhost:4500 — credentials `test` / `test`, region `us-east-1`.

Manual dev: Node 20+, pnpm 9+, Bun; `pnpm install` → `pnpm dev` with Floci core on `4566`.

**License:** MIT · [floci.io](https://floci.io)

---

## How Social Imperialism uses it

| Work | Dev (local) | Go-live (prod) |
|------|-------------|----------------|
| **Web UI** | `npm run dev:web` on `:3000` — **do not** hit Amplify every change | **Amplify** (`deploy/amplify-deploy.ps1` / git-connected) |
| **Object storage** | **Floci S3** on `:4566` | **R2 or real AWS S3** |
| **API** | `npm run dev:api` on `:4000` | Elastic Beanstalk |
| **Floci UI console** | Optional browser for buckets | Not used |

**Floci does not replace Amplify.** Amplify hosts the static/Next site in production. Floci replaces **paid S3 (and accidental Amplify rebuild thrash)** during development.

---

## SI Quick Start (local free storage)

```powershell
# 1) Start emulator + create bucket
npm run floci:up

# 2) Point API at Floci — QP env block below → apps/api/.env

# 3) Run SI without Amplify
npm run dev
```

Optional console: clone [floci-ui](https://github.com/floci-io/floci-ui) and `docker compose up` → http://localhost:4500

---

## QP — exact env vars (Quick Path / local Floci)

Copy into **`apps/api/.env`** for local free storage.  
Also set the same storage block in **`apps/desktop/.env`** if you use Electron uploads.

```bash
# ─── QP: Social Imperialism local Floci storage ───
# Prefer Floci over R2/real S3 so uploads never hit paid cloud in dev
STORAGE_PROVIDER=floci
SI_STORAGE_PROVIDER=floci

# Emulator (Floci core — same as LocalStack port)
FLOCI_ENDPOINT=http://127.0.0.1:4566
AWS_S3_ENDPOINT=http://127.0.0.1:4566
AWS_S3_FORCE_PATH_STYLE=true
FLOCI_DEFAULT_REGION=us-east-1

# Dummy creds accepted by Floci (no real AWS account)
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_S3_ACCESS_KEY_ID=test
AWS_S3_SECRET_ACCESS_KEY=test

# Bucket + keys (created by npm run floci:bootstrap)
AWS_S3_BUCKET_NAME=social-imperialism
FLOCI_S3_BUCKET=social-imperialism
AWS_S3_REGION=us-east-1
AWS_S3_UPLOAD_PREFIX=social-imperialism/uploads
AWS_S3_PUBLIC_BASE_URL=http://127.0.0.1:4566/social-imperialism

# ─── Disable paid object stores in dev (leave blank) ───
# CLOUDFLARE_R2_ACCESS_KEY_ID=
# CLOUDFLARE_R2_SECRET_ACCESS_KEY=
# CLOUDFLARE_R2_BUCKET=
# CLOUDFLARE_R2_PUBLIC_BASE_URL=

# ─── Local app URLs (no Amplify) ───
WEB_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
API_PORT=4000
PORT=4000
```

### Go-live (prod) — leave Floci off

```bash
STORAGE_PROVIDER=auto
# or: STORAGE_PROVIDER=r2   /   STORAGE_PROVIDER=s3

# Unset local emulator endpoints on EB:
# FLOCI_ENDPOINT=
# AWS_S3_ENDPOINT=

# Real R2 and/or AWS_S3_* as already used on si-api-prod
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
# AWS_S3_BUCKET_NAME=social-imperialism
# ...

WEB_URL=https://www.socialimperialism.com
```

Web go-live remains: **`deploy/amplify-deploy.ps1`** / Amplify git `main` — not Floci.

---

## npm scripts

| Script | Action |
|--------|--------|
| `npm run floci:up` | Docker Floci on 4566 + bootstrap bucket |
| `npm run floci:bootstrap` | Create bucket + smoke put |
| `npm run floci:down` | Stop compose stack |

---

## Architecture (dev)

```text
Browser :3000 (Next local)
    → API :4000
         → S3 SDK → http://127.0.0.1:4566  (Floci)
              → bucket social-imperialism
Optional: Floci UI :4500 → Floci :4566
```

Prod:

```text
www (Amplify) → api.socialimperialism.com (EB) → R2 / real S3
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Uploads still hit AWS | Set `STORAGE_PROVIDER=floci` and clear R2 keys in `.env` |
| `ECONNREFUSED 4566` | `npm run floci:up` |
| Bucket missing | `npm run floci:bootstrap` |
| Amplify charges on every save | Use `npm run dev:web` only; deploy Amplify on release, not continuous |
| Health `/_floci/health` 404 | Container still booting; try list buckets via bootstrap script |

See also: [Floci quick start](https://floci.io/floci/getting-started/quick-start/), [floci-ui README](https://github.com/floci-io/floci-ui).
