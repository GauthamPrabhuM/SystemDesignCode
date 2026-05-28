# SystemDesignCode

> A **free, open-source** interview platform for **machine coding, low-level design (LLD), and backend architecture rounds**. Think LeetCode × VSCode × Linear — built specifically for the rounds that decide backend offers.

[![CI](https://github.com/GauthamPrabhuM/systemdesigncode/actions/workflows/ci.yml/badge.svg)](https://github.com/GauthamPrabhuM/systemdesigncode/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/gauthamprabhum)

---

## What is this?

Most prep platforms optimize for **algorithmic DSA**. SystemDesignCode is the missing piece: a real IDE, sandboxed test runner, and AI design reviewer purpose-built for the **60–120 minute "build a working parking lot / Splitwise / rate limiter" rounds** that companies like Uber, Atlassian, Nutanix, Stripe, Flipkart, and Razorpay use as their hiring filter.

**What you get out of the box:**

- Monaco-based multi-file IDE with 6 languages (Python, Java, C++, Go, TypeScript, JavaScript)
- Hardened sandboxed execution (Docker + gVisor) with per-test resource caps
- WebSocket-streamed test results, runtime, and memory stats
- AI design review (SOLID, patterns, extensibility, concurrency) via Claude
- Contest mode, pair-programming interview rooms (Yjs CRDT collaboration)
- Self-hostable end-to-end with one `docker compose up`
- Free-tier deployable on Vercel + Fly.io + Neon + Upstash — **~$0–$10/mo for an MVP**

For the full architectural rationale, see [`BLUEPRINT.md`](./BLUEPRINT.md).

---

## Quickstart — local development

Prerequisites: Docker Desktop (with Compose v2) and Node 20+ if you want to run web outside Docker.

```bash
git clone https://github.com/GauthamPrabhuM/systemdesigncode
cd systemdesigncode
cp .env.example .env

# Pre-build language sandbox images (one-time, ~3 min)
docker build -t sdc-runtime-python:3.12 -f services/executor/runtimes/python.Dockerfile .
docker build -t sdc-runtime-java:21     -f services/executor/runtimes/java.Dockerfile   .
docker build -t sdc-runtime-go:1.22     -f services/executor/runtimes/go.Dockerfile     .
docker build -t sdc-runtime-node:20     -f services/executor/runtimes/node.Dockerfile   .
docker build -t sdc-runtime-cpp:13      -f services/executor/runtimes/cpp.Dockerfile    .

# Bring up the stack
docker compose up
```

That brings up:
- **Web** → http://localhost:3000
- **API** → http://localhost:8000 (Swagger UI at `/docs`)
- **Postgres** on `:5432`
- **Redis** on `:6379`
- **Executor** worker (consumes Redis stream `submissions:queue`)

The API container runs `alembic upgrade head` then `scripts/load_problems.py /problems` on boot — your seed problems are live the moment the container is healthy.

---

## Try it

Open http://localhost:3000/problems/parking-lot, click **Run** (⌘↵), and watch test results stream in.

The first request will be slow (Docker pulls the runtime image into the executor's cache); subsequent runs are sub-second.

---

## Repository layout

```
systemdesigncode/
├── apps/web/                 # Next.js 15 frontend
├── services/
│   ├── api/                  # FastAPI monolith (auth, problems, submissions, realtime, ...)
│   └── executor/             # Sandbox worker (consumes Redis stream)
├── problems/                 # Problem definitions (yaml + starters + tests)
├── infra/
│   ├── fly/                  # Fly.io deploy configs
│   ├── k8s/                  # Kubernetes manifests (scaled production)
│   └── nginx/
├── .github/workflows/        # CI + deploy pipelines
├── docker-compose.yml
├── BLUEPRINT.md              # ← full engineering spec; start here for architecture
└── .env.example
```

---

## Authoring a new problem

Drop a folder into `/problems/<your-slug>/`:

```
problems/your-slug/
├── problem.yaml              # metadata + rubric
├── statement.md              # markdown problem statement
├── starter/
│   ├── python/main.py        # one folder per language
│   ├── java/Main.java
│   └── go/main.go
└── tests/
    └── cases.yaml            # public + hidden test cases
```

Reboot the API container (or hit the admin reload endpoint) and your problem is live.

See [`problems/parking-lot/`](./problems/parking-lot/) for a worked example.

---

## Free-tier production deployment (Fly.io + Vercel)

| Component | Provider | Free tier | Notes |
|---|---|---|---|
| Frontend | Vercel Hobby | 100GB bandwidth | `vercel link` in `apps/web/` |
| API | Fly.io | 3× shared-1x machines | `flyctl deploy --config infra/fly/api.toml` |
| Executor | Fly Machines | pay-per-second | Auto-stops when queue empty |
| Postgres | Neon | 0.5 GB | Connection pool via PgBouncer endpoint |
| Redis | Upstash | 10k cmds/day | More than enough for MVP |
| Object storage | Cloudflare R2 | 10 GB | No egress fees |
| Errors | Sentry | 5k events/mo | |
| Metrics | Grafana Cloud | 10k series | Use OTLP from API + executor |

Expected cost: **$0–$10/mo for the first 100 users**, **~$65/mo at 1k users**, **~$500/mo at 10k users**. See [`BLUEPRINT.md §17`](./BLUEPRINT.md#17-cost-modeling) for the full model.

---

## Scaled production on GCP (Cloud Run)

When you need autoscaling and managed infra, use the GCP path in [`infra/gcp/`](./infra/gcp/):

```bash
# One-time project setup
gcloud projects create systemdesigncode --set-as-default
gcloud services enable run.googleapis.com sqladmin.googleapis.com redis.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com

# Push images and deploy (handled by GitHub Actions after you set secrets — see below)
```

Set these secrets in your GitHub repo (`Settings → Secrets`):

| Secret | Where to get it |
|---|---|
| `GCP_PROJECT_ID` | `gcloud config get project` |
| `GCP_SA_KEY` | Service account JSON with `roles/run.admin`, `roles/storage.admin` |
| `GCP_REGION` | e.g. `us-central1` |
| `DATABASE_URL` | Cloud SQL connection string |
| `REDIS_URL` | Memorystore Redis URL |
| `JWT_SECRET` | Generate with `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | console.anthropic.com |

Once secrets are set, push to `main` — the [GCP deploy workflow](.github/workflows/deploy-gcp.yml) handles the rest.

Full architecture and k8s migration path: [`BLUEPRINT.md §16`](./BLUEPRINT.md#16-deployment--scaled-production).

---

## Scaled production

When you cross ~10k MAU or ~5k submissions/day, follow the migration path in [`BLUEPRINT.md §16`](./BLUEPRINT.md#16-deployment--scaled-production):

1. Extract the executor to a dedicated cluster (it's already isolated by the worker-pool architecture)
2. Split the realtime WebSocket fleet onto sticky sessions
3. Move AI evaluation to its own rate-limited service
4. Add Postgres read replicas, PgBouncer
5. Move to k8s (manifests in `infra/k8s/`)

The monolith stays the monolith — you only extract services when their scaling profile genuinely diverges.

---

## Security model

The executor is the highest-risk component. Defense in depth:

1. **Network namespace** with no interfaces (`--network=none`)
2. **Read-only root filesystem** + tmpfs scratch space
3. **All Linux capabilities dropped** + `no-new-privileges`
4. **gVisor runtime** (user-space kernel) when `EXECUTOR_RUNTIME=runsc`
5. **cgroup limits**: 256 MB memory, 0.5 CPU, 64 PIDs
6. **Per-test wall-clock timeout** + total submission walltime ceiling
7. **Source-size guard** (200 KB max)

Authentication, rate-limiting, anti-cheating, and audit logging are covered in [`BLUEPRINT.md §13`](./BLUEPRINT.md#13-security--anti-cheating).

---

## Tech stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui, Monaco, Zustand, TanStack Query, Framer Motion
- **Backend**: FastAPI, Pydantic v2, SQLAlchemy 2 async, Alembic
- **Data**: Postgres 16, Redis 7 (Streams + pubsub)
- **Sandbox**: Docker + gVisor (runsc) — optional Firecracker at scale
- **AI**: Claude API for structured design reviews
- **Realtime**: WebSockets (submissions) + Yjs CRDT (collaborative rooms)
- **Observability**: OpenTelemetry → Grafana Cloud, Sentry for errors

---

## Support this project

SystemDesignCode is **100% free** and will always be. If it helps you land an offer:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black&style=for-the-badge)](https://buymeacoffee.com/gauthamprabhum)

Coffee → server bills → more problems → more engineers getting offers. That's the loop.

---

## Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide.

The easiest first contribution is **authoring a new problem** in `/problems/`. For code changes:

1. `pnpm install` in `apps/web/`, `pip install -r requirements.txt` in `services/api/`
2. `ruff check` and `pytest` must pass before opening a PR
3. Frontend changes need `npm run typecheck && npm run lint`
4. Run `docker compose up` and smoke-test the parking-lot problem end-to-end

---

## License

MIT. Use it, fork it, run it for your bootcamp, embed it in your hiring stack.

---

## Acknowledgments

Inspired by Interviewing.io, LeetCode, AlgoExpert, and the trial-by-fire interview rounds at Atlassian, Nutanix, and Uber.
