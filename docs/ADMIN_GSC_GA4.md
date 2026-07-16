# Admin GSC + GA4 traffic

Platform administrators can view **Google Search Console** and **Google Analytics 4** traffic on:

- **Dashboard → Analytics** (admin-only panel)
- **Dashboard → Admin** (full traffic panel + directory)

## API

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/admin/traffic?days=28&forceRefresh=1` | Platform admin JWT |
| GET | `/api/admin/traffic/status` | Platform admin JWT |

## Server configuration

Set on the API host (Elastic Beanstalk / `.env`):

```bash
# Service account JSON (full key file contents) OR path to .json
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Or split form:
# GOOGLE_SERVICE_ACCOUNT_EMAIL=si-traffic@project.iam.gserviceaccount.com
# GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Search Console property (exact string from GSC)
GSC_SITE_URL=sc-domain:socialimperialism.com
# or: GSC_SITE_URL=https://www.socialimperialism.com/

# GA4 numeric property id (Admin → Property Settings) — NOT the G- tag
GA4_PROPERTY_ID=123456789

# Optional: measurement id for display only
GA4_MEASUREMENT_ID=G-XXXXXXXX
```

Also supported: `GOOGLE_APPLICATION_CREDENTIALS` pointing at a key file.

## Google Cloud setup checklist

1. Create a GCP service account with no user roles required on the project itself.
2. Enable **Google Search Console API** and **Google Analytics Data API**.
3. In **Search Console** → Settings → Users: add the service account email as **Full**.
4. In **GA4** → Admin → Property access management: add the service account as **Viewer**.
5. Set env vars above and redeploy the API.
6. Optionally save `gscSiteUrl` + `ga4PropertyId` in **Settings → Site & Tracking** (org store fallback).

## Notes

- Reports cache for **10 minutes** server-side.
- GSC date range ends **yesterday** (Search Console data lag).
- Non-admins receive **403** from `/api/admin/traffic`.
- Measurement ID alone cannot pull reports — property ID + service account are required.
