# Credential Rotation Checklist

Passwords and API keys previously appeared in tracked docs and deploy state files. Rotate these in their respective consoles.

## Rotated locally (2026-06-30)

| Credential | Action |
|------------|--------|
| `JWT_SECRET` | New value in `apps/api/.env` — **update Elastic Beanstalk env var** |
| `SEED_PASSWORD` | New value in `apps/api/.env` — run `npm run db:seed` locally; update prod seed or reset user password in DB |

## Manual rotation required

| System | Steps |
|--------|-------|
| **Grok / x.ai** | Change password at https://grok.com/ → update in desktop Settings → Grok Engine |
| **RDS PostgreSQL** | AWS RDS → Modify master password → update `DATABASE_URL` on EB |
| **AWS IAM (S3)** | IAM → deactivate exposed access key → create new key → update EB env vars |
| **Instagram sessions** | Re-authenticate accounts in Account Hub (old session JSON was in deploy files) |
| **OAuth app secrets** | Meta, Google, Twitter developer consoles — rotate client secrets if exposed |

## Production EB update

```powershell
# Set new JWT on Elastic Beanstalk environment si-api-prod
aws elasticbeanstalk update-environment `
  --environment-name si-api-prod `
  --option-settings Namespace=aws:elasticbeanstalk:application:environment,OptionName=JWT_SECRET,Value=<new-secret>
```

## Verify after rotation

```powershell
npm run db:seed
npm run audit:accuracy
npm run test:content-hub
curl https://api.socialimperialism.com/health
```