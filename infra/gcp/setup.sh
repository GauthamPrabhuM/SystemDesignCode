#!/usr/bin/env bash
# One-time GCP project setup for SystemDesignCode.
# Run this once, then let GitHub Actions handle all deploys.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (`gcloud auth login`)
#   - Billing account attached to the project

set -euo pipefail

PROJECT_ID="${1:-systemdesigncode}"
REGION="${2:-us-central1}"
REGISTRY_REPO="systemdesigncode"

echo "==> Setting project to $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

echo "==> Enabling required APIs"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  vpcaccess.googleapis.com \
  --project "$PROJECT_ID"

echo "==> Creating Artifact Registry repository"
gcloud artifacts repositories create "$REGISTRY_REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --project "$PROJECT_ID" \
  --description="SystemDesignCode container images" || true

echo "==> Creating Cloud SQL (Postgres 16) instance"
# ~$10/mo on db-f1-micro; upgrade to db-g1-small at 1k MAU
gcloud sql instances create sdc-postgres \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region="$REGION" \
  --storage-type=SSD \
  --storage-size=10GB \
  --backup-start-time="02:00" \
  --project "$PROJECT_ID" || true

gcloud sql databases create sdc --instance=sdc-postgres --project "$PROJECT_ID" || true
gcloud sql users create sdc --instance=sdc-postgres --password="$(openssl rand -base64 20)" --project "$PROJECT_ID" || true

echo "==> Creating Memorystore Redis instance"
# ~$35/mo for 1GB Basic; scale up at 5k MAU
gcloud redis instances create sdc-redis \
  --size=1 \
  --region="$REGION" \
  --redis-version=redis_7_0 \
  --tier=BASIC \
  --project "$PROJECT_ID" || true

echo "==> Creating deploy service account"
SA_EMAIL="sdc-deploy@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts create sdc-deploy \
  --display-name="SystemDesignCode deploy SA" \
  --project "$PROJECT_ID" || true

for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE"
done

echo ""
echo "==> Setup complete. Next steps:"
echo "   1. Note the Cloud SQL connection string:"
echo "      postgresql+asyncpg://sdc:<PASSWORD>@/sdc?host=/cloudsql/${PROJECT_ID}:${REGION}:sdc-postgres"
echo "   2. Note the Redis host:"
gcloud redis instances describe sdc-redis --region="$REGION" --format='value(host)' 2>/dev/null && echo ":6379" || echo "   (run: gcloud redis instances describe sdc-redis --region=$REGION --format='value(host)')"
echo "   3. Create a JSON key for the service account and add it as GCP_SA_KEY in GitHub Secrets:"
echo "      gcloud iam service-accounts keys create key.json --iam-account=${SA_EMAIL}"
echo "   4. Add these GitHub Secrets: GCP_PROJECT_ID, GCP_SA_KEY, GCP_REGION, DATABASE_URL, REDIS_URL, JWT_SECRET, ANTHROPIC_API_KEY"
