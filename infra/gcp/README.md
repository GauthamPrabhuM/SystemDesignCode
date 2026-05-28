# GCP Cloud Run Deployment

## Architecture

```
Cloud Run (sdc-web)     ──▶  Cloud Run (sdc-api)  ──▶  Cloud SQL (Postgres 16)
                                      │                  Memorystore (Redis 7)
                              Cloud Run (sdc-executor)
                              (sandboxed code execution)
```

All images are stored in **Artifact Registry** and deployed automatically by GitHub Actions on every push to `main`.

## First-time setup

```bash
chmod +x infra/gcp/setup.sh
./infra/gcp/setup.sh YOUR_PROJECT_ID us-central1
```

Then add the 7 secrets to your GitHub repo (Settings → Secrets → Actions):

| Secret | Value |
|---|---|
| `GCP_PROJECT_ID` | your GCP project ID |
| `GCP_SA_KEY` | service account JSON key |
| `GCP_REGION` | e.g. `us-central1` |
| `DATABASE_URL` | Cloud SQL connection string |
| `REDIS_URL` | `redis://MEMORYSTORE_HOST:6379/0` |
| `JWT_SECRET` | `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | from console.anthropic.com |

## Cost estimate

| Scale | Monthly cost |
|---|---|
| 0–100 users | ~$30–50 (Cloud SQL + Redis dominate) |
| ~1k MAU | ~$80–120 |
| ~10k MAU | ~$300–500 |

Cloud Run itself scales to zero — you only pay for API + DB + Redis baseline.

## Custom domain

```bash
gcloud run domain-mappings create --service sdc-web --domain systemdesigncode.com --region us-central1
```
