# SystemDesignCode — Complete Engineering Blueprint

> A premium, free-tier-deployable web platform for **machine coding, low-level design (LLD), and backend architecture interviews**. Think LeetCode × VSCode × Linear, focused on backend systems.

This blueprint is opinionated. Where there are choices, I pick one and explain why, then list the tradeoff.

---

## Table of Contents

1. [Product Thesis & Differentiation](#1-product-thesis--differentiation)
2. [System Architecture (MVP & Scaled)](#2-system-architecture)
3. [Tech Stack Decisions](#3-tech-stack-decisions)
4. [Repository & Folder Structure](#4-repository--folder-structure)
5. [Database Schema (Postgres)](#5-database-schema)
6. [API Design (REST + WebSocket)](#6-api-design)
7. [Code Execution Engine](#7-code-execution-engine)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Authentication & RBAC](#9-authentication--rbac)
10. [Real-time Layer (Submissions, Collaboration)](#10-realtime-layer)
11. [Sample Problem Spec Format](#11-sample-problem-spec-format)
12. [AI Evaluation Pipeline](#12-ai-evaluation-pipeline)
13. [Security & Anti-Cheating](#13-security--anti-cheating)
14. [Observability](#14-observability)
15. [Deployment — Free-Tier MVP](#15-deployment--free-tier-mvp)
16. [Deployment — Scaled Production](#16-deployment--scaled-production)
17. [Cost Modeling](#17-cost-modeling)
18. [Roadmap (V1 → V3)](#18-roadmap)
19. [Business / SaaS Strategy](#19-business--saas-strategy)
20. [Open Questions & Risks](#20-open-questions--risks)

---

## 1. Product Thesis & Differentiation

### The gap in the market

LeetCode optimizes for **algorithmic DSA**. Educative and ByteByteGo teach **conceptual** system design. There is no first-class platform for **machine coding & LLD rounds** — the 60–120 minute "build a working parking lot / Splitwise / rate limiter" rounds that companies like Uber, Atlassian, Nutanix, Flipkart, Swiggy, Stripe, Razorpay, and Atlassian use as a *hiring filter*.

These rounds are evaluated on:
- Working code (compiles, runs, passes tests)
- Object-oriented design (SOLID, design patterns)
- Extensibility (can you add a new feature in 5 min?)
- Concurrency handling
- API ergonomics

SystemDesignCode is purpose-built for this round.

### Key differentiators

| Feature | LeetCode | Educative | **SystemDesignCode** |
|---|---|---|---|
| Multi-file IDE | ✗ | ✗ | ✓ |
| Run unit tests against your classes | ✗ | ✗ | ✓ |
| Extensibility scoring (add feature X in editor) | ✗ | ✗ | ✓ |
| AI design review (SOLID, patterns) | partial | ✗ | ✓ |
| Architecture whiteboard linked to code | ✗ | ✗ | ✓ |
| Interview proctoring + recording | ✗ | ✗ | ✓ |
| Backend-language-first (Java/Go/Python) | ✗ | ✗ | ✓ |

### Non-goals (for V1)

- Competitive programming / DSA ladders
- Mobile-first experience (desktop-only is fine for the MVP)
- Frontend machine coding rounds (React component design) — V3
- HLD whiteboarding as a primary product — V2 add-on

---

## 2. System Architecture

### MVP architecture (modular monolith + worker pool)

```
                    ┌─────────────────────────────────────┐
                    │              Browser                 │
                    │  Next.js 15 (Vercel) + Monaco       │
                    └──────────────┬──────────────────────┘
                                   │ HTTPS + WSS
                                   ▼
                    ┌─────────────────────────────────────┐
                    │  Next.js BFF (API routes / Server   │
                    │  Actions) — thin pass-through       │
                    └──────────────┬──────────────────────┘
                                   │ HTTP/JSON  +  WebSocket
                                   ▼
        ┌──────────────────────────────────────────────────────┐
        │           FastAPI Monolith (Render/Fly.io)            │
        │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
        │  │  auth    │ │ problems │ │ submit   │ │ realtime │ │
        │  │  module  │ │  module  │ │  module  │ │  (WS)    │ │
        │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
        │  ┌──────────┐ ┌──────────┐ ┌──────────┐              │
        │  │ contests │ │  admin   │ │   ai     │              │
        │  └──────────┘ └──────────┘ └──────────┘              │
        └────────┬──────────────┬──────────────┬───────────────┘
                 │              │              │
       ┌─────────▼──┐   ┌───────▼────┐   ┌─────▼────────────┐
       │ Postgres   │   │   Redis    │   │  Submission       │
       │ (Neon)     │   │ (Upstash)  │   │  Queue            │
       │            │   │ cache+pub  │   │  (Redis Streams)  │
       └────────────┘   └────────────┘   └─────┬─────────────┘
                                               │ BRPOP
                                               ▼
                                  ┌──────────────────────────┐
                                  │  Executor Workers        │
                                  │  (Fly Machines / VPS)    │
                                  │  - pull job              │
                                  │  - spawn ephemeral       │
                                  │    Docker container      │
                                  │  - stream logs to Redis  │
                                  │  - publish result        │
                                  └──────────────────────────┘
```

**Why a modular monolith first**: One deploy unit, one DB connection pool, one set of secrets, no cross-service auth. Modules become services only when their scaling profile diverges. The boundary is the *package*, not the *process*. (Shopify, GitHub, and Stack Overflow all run as monoliths.)

### Scaled architecture (when MAU > ~50k)

Split out:
- **Executor service** → its own cluster (already isolated by worker pool, just give it its own deploy)
- **Realtime service** → dedicated WebSocket fleet behind sticky-session LB
- **AI evaluation** → async, separately rate-limited service (LLM cost is the dominant variable)

Everything else stays in the monolith until measured pain appears.

---

## 3. Tech Stack Decisions

| Layer | Choice | Why | Alt considered |
|---|---|---|---|
| Frontend framework | Next.js 15 (App Router) | RSC, streaming, edge runtime, Vercel free tier | Remix, SvelteKit |
| Styling | Tailwind v4 + shadcn/ui | Speed of iteration, design tokens, no CSS-in-JS runtime cost | Mantine, Chakra |
| Editor | Monaco | Same engine as VSCode; LSP-friendly | CodeMirror 6 (lighter but less familiar) |
| State | Zustand + TanStack Query | Zustand for UI state, TQ for server state. Redux is overkill | Redux Toolkit |
| Animation | Framer Motion | Industry-standard, gesture support | GSAP |
| Backend | FastAPI (Python) | Async-first, Pydantic v2, type safety, fastest dev velocity | NestJS, Go/Echo |
| ORM | SQLAlchemy 2.0 + Alembic | Mature, async, full SQL escape hatch | Prisma (via Node sidecar), SQLModel |
| DB | Postgres 16 (Neon) | Branching, free tier, scale-to-zero | Supabase |
| Cache / Queue | Redis (Upstash) | Streams for queue, pub/sub for WS fanout | RabbitMQ |
| Object storage | Cloudflare R2 | No egress fees, S3-compatible | Backblaze B2 |
| Auth | Auth.js (NextAuth v5) with JWT + OAuth providers | Self-hosted, no per-MAU pricing | Clerk (free tier caps at 10k MAU) |
| Sandbox | Docker + gVisor (runsc) | gVisor gives strong syscall isolation on commodity Linux | Firecracker (heavier ops), nsjail |
| AI | Claude (Anthropic API) for evaluation | Long context for full submission review | OpenAI |
| Observability | OpenTelemetry → Grafana Cloud free tier | Vendor-neutral, free tier generous | Datadog (too expensive) |
| CI/CD | GitHub Actions | Free for public repos / 2000 min for private | Earthly, Buildkite |

---

## 4. Repository & Folder Structure

Monorepo using **pnpm workspaces** + **Turborepo** for frontend, plus a Python project for backend. Two top-level languages, one repo.

```
systemdesigncode/
├── apps/
│   ├── web/                          # Next.js 15 frontend
│   │   ├── app/
│   │   │   ├── (marketing)/          # Landing, pricing, docs
│   │   │   ├── (app)/                # Authenticated app
│   │   │   │   ├── dashboard/
│   │   │   │   ├── problems/
│   │   │   │   │   └── [slug]/       # The IDE route
│   │   │   │   ├── contests/
│   │   │   │   ├── interviews/
│   │   │   │   └── settings/
│   │   │   ├── (admin)/
│   │   │   └── api/                  # BFF routes only
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn primitives
│   │   │   ├── editor/               # Monaco wrappers, tabs, panels
│   │   │   ├── problem/              # Problem statement, hints, examples
│   │   │   ├── execution/            # Test results, console, runtime stats
│   │   │   ├── architecture/         # Whiteboard, node palette
│   │   │   ├── interview/            # Timer, proctoring, collab cursors
│   │   │   └── shared/               # CommandPalette, ThemeSwitcher, Layout
│   │   ├── lib/
│   │   │   ├── api.ts                # TanStack Query hooks
│   │   │   ├── ws.ts                 # WebSocket client
│   │   │   ├── monaco/               # Language configs, themes
│   │   │   └── store/                # Zustand slices
│   │   ├── hooks/
│   │   └── styles/
│   └── docs/                         # Docusaurus or Nextra
│
├── packages/
│   ├── ui/                           # Shared shadcn components
│   ├── types/                        # Shared TS types (generated from Pydantic)
│   ├── eslint-config/
│   └── tsconfig/
│
├── services/
│   ├── api/                          # FastAPI monolith
│   │   ├── app/
│   │   │   ├── core/                 # config, security, deps, logging
│   │   │   ├── db/                   # session, base, migrations
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── router.py
│   │   │   │   │   ├── service.py
│   │   │   │   │   ├── schemas.py
│   │   │   │   │   └── models.py
│   │   │   │   ├── users/
│   │   │   │   ├── problems/
│   │   │   │   ├── submissions/
│   │   │   │   ├── execution/        # talks to worker pool
│   │   │   │   ├── realtime/         # WS hub
│   │   │   │   ├── contests/
│   │   │   │   ├── interviews/
│   │   │   │   ├── ai/               # design review pipeline
│   │   │   │   └── admin/
│   │   │   ├── main.py
│   │   │   └── tasks/                # background jobs (cleanup, scoring)
│   │   ├── alembic/
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── Dockerfile
│   │
│   └── executor/                     # Sandbox worker (Python)
│       ├── worker/
│       │   ├── main.py               # consume from Redis stream
│       │   ├── runner.py             # spawn docker container, stream logs
│       │   ├── languages/            # per-language run configs
│       │   └── security.py           # gVisor, seccomp, cgroups
│       ├── runtimes/                 # Per-language Docker base images
│       │   ├── python.Dockerfile
│       │   ├── java.Dockerfile
│       │   ├── cpp.Dockerfile
│       │   ├── go.Dockerfile
│       │   └── node.Dockerfile
│       └── Dockerfile
│
├── problems/                          # Problem definitions (yaml + tests)
│   ├── parking-lot/
│   │   ├── problem.yaml              # metadata
│   │   ├── statement.md
│   │   ├── starter/
│   │   │   ├── python/
│   │   │   ├── java/
│   │   │   └── ...
│   │   ├── tests/
│   │   │   ├── public/
│   │   │   └── hidden/
│   │   └── rubric.yaml               # AI evaluation rubric
│   ├── splitwise/
│   ├── rate-limiter/
│   └── ...
│
├── infra/
│   ├── docker-compose.yml            # full local stack
│   ├── docker-compose.prod.yml
│   ├── k8s/                          # production manifests (when scaled)
│   ├── terraform/                    # optional, for IaC adopters
│   └── nginx/
│
├── scripts/
│   ├── seed.py                       # seed DB with problems
│   ├── load-problems.py              # ingest /problems → DB
│   └── generate-types.py             # Pydantic → TS types
│
├── .github/workflows/
│   ├── ci.yml
│   ├── deploy-web.yml
│   ├── deploy-api.yml
│   └── deploy-executor.yml
│
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

**Why this layout**: Apps and services are deployable units; packages are shared code. Problems are content, not code — they live at the top level so non-engineers (or a future CMS) can edit them without touching app code.

---

## 5. Database Schema

Postgres. Designed for the MVP; indexes called out where the access pattern is obvious.

```sql
-- ============================================================
-- USERS & AUTH
-- ============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT UNIQUE NOT NULL,
  username        TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  avatar_url      TEXT,
  password_hash   TEXT,                    -- nullable; OAuth-only users have none
  role            TEXT NOT NULL DEFAULT 'user',   -- user | admin | interviewer
  plan            TEXT NOT NULL DEFAULT 'free',   -- free | pro | team
  email_verified  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE oauth_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL,                -- github | google
  provider_id TEXT NOT NULL,
  access_token TEXT,                         -- encrypted at rest
  refresh_token TEXT,
  UNIQUE(provider, provider_id)
);

CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  user_agent  TEXT,
  ip          INET,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON sessions(user_id);
CREATE INDEX ON sessions(expires_at);

-- ============================================================
-- PROBLEMS
-- ============================================================
CREATE TABLE problems (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  difficulty    TEXT NOT NULL,              -- easy | medium | hard
  category      TEXT NOT NULL,              -- lld | machine-coding | distsys | api-design
  statement_md  TEXT NOT NULL,
  constraints   JSONB NOT NULL DEFAULT '{}',
  time_limit_minutes INT NOT NULL DEFAULT 90,
  is_premium    BOOLEAN NOT NULL DEFAULT false,
  is_published  BOOLEAN NOT NULL DEFAULT false,
  rubric        JSONB,                      -- for AI evaluation
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON problems(category, difficulty) WHERE is_published;

CREATE TABLE problem_tags (
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  tag        TEXT NOT NULL,
  PRIMARY KEY (problem_id, tag)
);
CREATE INDEX ON problem_tags(tag);

CREATE TABLE problem_companies (
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  company    TEXT NOT NULL,
  PRIMARY KEY (problem_id, company)
);
CREATE INDEX ON problem_companies(company);

CREATE TABLE starter_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id  UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  language    TEXT NOT NULL,                -- python | java | cpp | go | typescript
  files       JSONB NOT NULL,               -- [{path, contents}]
  entrypoint  TEXT NOT NULL,                -- e.g. "main.py" or "Main.java"
  UNIQUE(problem_id, language)
);

CREATE TABLE test_cases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id  UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,                -- public | hidden | sample
  weight      INT NOT NULL DEFAULT 1,
  input       JSONB NOT NULL,
  expected    JSONB NOT NULL,
  timeout_ms  INT NOT NULL DEFAULT 5000
);
CREATE INDEX ON test_cases(problem_id, kind);

-- ============================================================
-- SUBMISSIONS
-- ============================================================
CREATE TABLE submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id    UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  language      TEXT NOT NULL,
  files         JSONB NOT NULL,             -- [{path, contents}]
  status        TEXT NOT NULL,              -- queued | running | done | failed | timeout
  score         NUMERIC(5,2),               -- 0..100
  passed_tests  INT,
  total_tests   INT,
  runtime_ms    INT,
  memory_kb     INT,
  error         TEXT,
  ai_review_id  UUID,                       -- → ai_reviews
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX ON submissions(user_id, created_at DESC);
CREATE INDEX ON submissions(problem_id, status);

CREATE TABLE test_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  test_case_id  UUID NOT NULL REFERENCES test_cases(id),
  status        TEXT NOT NULL,              -- passed | failed | error | timeout
  runtime_ms    INT,
  stdout        TEXT,
  stderr        TEXT,
  diff          TEXT                        -- pretty diff vs expected
);
CREATE INDEX ON test_results(submission_id);

-- ============================================================
-- AI REVIEWS
-- ============================================================
CREATE TABLE ai_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  model           TEXT NOT NULL,
  overall_score   NUMERIC(5,2),
  dimensions      JSONB NOT NULL,           -- {solid: 8, extensibility: 7, ...}
  comments        JSONB NOT NULL,           -- [{file, line, severity, message}]
  summary_md      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- DRAFTS (autosave)
-- ============================================================
CREATE TABLE drafts (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id    UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  language      TEXT NOT NULL,
  files         JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, problem_id, language)
);

-- ============================================================
-- CONTESTS
-- ============================================================
CREATE TABLE contests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description_md TEXT,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'public',  -- public | private | invite
  created_by  UUID REFERENCES users(id)
);
CREATE INDEX ON contests(starts_at);

CREATE TABLE contest_problems (
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES problems(id),
  position   INT NOT NULL,
  PRIMARY KEY (contest_id, problem_id)
);

CREATE TABLE contest_participants (
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score      NUMERIC(8,2) DEFAULT 0,
  finished_at TIMESTAMPTZ,
  PRIMARY KEY (contest_id, user_id)
);

-- ============================================================
-- INTERVIEWS (collaborative rooms)
-- ============================================================
CREATE TABLE interviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code     TEXT UNIQUE NOT NULL,
  host_id       UUID NOT NULL REFERENCES users(id),
  candidate_id  UUID REFERENCES users(id),
  problem_id    UUID REFERENCES problems(id),
  scheduled_at  TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  recording_url TEXT,
  notes_md      TEXT
);
CREATE INDEX ON interviews(host_id);
CREATE INDEX ON interviews(candidate_id);

-- ============================================================
-- DISCUSSIONS
-- ============================================================
CREATE TABLE discussions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id  UUID REFERENCES problems(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  parent_id   UUID REFERENCES discussions(id),
  title       TEXT,
  body_md     TEXT NOT NULL,
  upvotes     INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON discussions(problem_id, created_at DESC);

-- ============================================================
-- AUDIT & SECURITY
-- ============================================================
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   UUID,
  metadata    JSONB,
  ip          INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_log(actor_id, created_at DESC);
```

### Indexing strategy

- Hot path 1: "user opens a problem" → drafts lookup by `(user_id, problem_id, language)` — PK covers this.
- Hot path 2: "user submits" → insert into submissions → fan out to test_results. PK on submissions; insert-only.
- Hot path 3: "show me my submission history" → `submissions(user_id, created_at DESC)`.
- Hot path 4: "leaderboard" → `contest_participants(contest_id, score DESC)`; add `(contest_id, score DESC)` index when contests launch.

### Scaling notes

- All `files` and `input/expected` payloads are JSONB; size grows fast. At ~1M submissions move `files` to R2 and store an object key. Don't do this early — premature.
- Partition `audit_log` and `test_results` by month once tables exceed ~50M rows. Until then, vanilla.
- Replicas: Neon gives read replicas; route discussion/leaderboard reads there once write QPS justifies it.

---

## 6. API Design

REST for everything synchronous, WebSocket for streaming submission status and collaboration.

### Conventions

- Base path: `/api/v1`
- JSON only. snake_case keys (FastAPI default with Pydantic alias generators).
- Auth: `Authorization: Bearer <access_token>` (JWT, 15-min TTL). Refresh via HttpOnly cookie.
- Errors: RFC 7807 problem+json.

```json
{
  "type": "https://systemdesigncode.dev/errors/submission-quota-exceeded",
  "title": "Submission quota exceeded",
  "status": 429,
  "detail": "Free tier allows 10 submissions per hour.",
  "instance": "/api/v1/submissions"
}
```

### Core endpoints

#### Auth
```
POST   /auth/register                 { email, password, username }
POST   /auth/login                    { email, password } → { access, refresh }
POST   /auth/refresh                  cookie → { access }
POST   /auth/logout
GET    /auth/me
GET    /auth/oauth/{provider}         redirect
GET    /auth/oauth/{provider}/callback
```

#### Problems
```
GET    /problems?category=lld&difficulty=medium&page=1&q=parking
GET    /problems/{slug}               → full statement + public test cases
GET    /problems/{slug}/starter?language=python
GET    /problems/{slug}/editorial     (premium)
```

#### Submissions
```
POST   /submissions                   { problem_slug, language, files }
                                      → { id, status: "queued" }
GET    /submissions/{id}              → full submission with test_results
GET    /submissions?problem_slug=...&mine=true
WS     /submissions/{id}/stream       see §10
```

#### Drafts
```
PUT    /drafts/{problem_slug}         { language, files }   (debounced autosave)
GET    /drafts/{problem_slug}?language=python
DELETE /drafts/{problem_slug}
```

#### Contests
```
GET    /contests
GET    /contests/{slug}
POST   /contests/{slug}/join
GET    /contests/{slug}/leaderboard
```

#### Interviews
```
POST   /interviews                    { problem_slug?, scheduled_at? } → { room_code }
GET    /interviews/{room_code}
WS     /interviews/{room_code}/live   see §10 (Yjs-over-WS)
POST   /interviews/{room_code}/end
```

#### Admin
```
POST   /admin/problems
PATCH  /admin/problems/{id}
POST   /admin/problems/{id}/publish
GET    /admin/analytics
```

### Versioning

URL versioning (`/v1/`) — simplest, gives clean dual-running window. Breaking changes ship as `/v2/` with overlap. Pydantic v2 makes it cheap to maintain two schema versions side by side.

---

## 7. Code Execution Engine

This is the most operationally risky component. Design for **isolation first, performance second**.

### Execution flow

```
1. User clicks "Run" / "Submit"
2. API:
   - Quota check (Redis: INCR with TTL)
   - Insert submission row (status=queued)
   - XADD to Redis stream `submissions:queue`
   - Return submission_id
   - Client opens WS to /submissions/{id}/stream
3. Worker (blocking XREADGROUP):
   - Claim job
   - Mark submission running, publish `status` event to channel
   - Materialize files into a tmpdir
   - Build & start sandbox container (one of the runtime images)
     - --rm, --network=none, --read-only, --tmpfs /tmp,
     - --memory=256m, --memory-swap=256m, --pids-limit=64,
     - --cpus=0.5, --ulimit nofile=64:64
     - --security-opt=no-new-privileges
     - --runtime=runsc (gVisor) when available
   - For each test case:
     - Stream stdin / args to container
     - Capture stdout/stderr with hard timeout
     - Stream incremental log lines to Redis pubsub channel `submission:{id}`
     - Compare output → mark test_result
   - On finish: update submission status=done, score, runtime, memory
   - Publish terminal `done` event
4. WS hub forwards Redis pubsub → client
```

### Worker pseudocode

```python
# services/executor/worker/main.py
import asyncio, json, os, signal
from redis.asyncio import Redis
from runner import run_submission

STREAM = "submissions:queue"
GROUP = "executors"
CONSUMER = os.environ["HOSTNAME"]

async def main():
    r = Redis.from_url(os.environ["REDIS_URL"])
    try:
        await r.xgroup_create(STREAM, GROUP, id="0", mkstream=True)
    except Exception:
        pass

    while True:
        msgs = await r.xreadgroup(GROUP, CONSUMER, {STREAM: ">"}, count=1, block=5000)
        if not msgs:
            continue
        for _, entries in msgs:
            for msg_id, data in entries:
                job = json.loads(data[b"job"])
                try:
                    await run_submission(r, job)
                    await r.xack(STREAM, GROUP, msg_id)
                except Exception as e:
                    # send to dead letter, ack to avoid poison loop
                    await r.xadd("submissions:dlq", {"msg_id": msg_id, "err": str(e)})
                    await r.xack(STREAM, GROUP, msg_id)

if __name__ == "__main__":
    asyncio.run(main())
```

### Sandboxing options (MVP → scale)

| Option | Isolation | Cold start | Ops cost | When |
|---|---|---|---|---|
| **Docker + seccomp** | Medium (shared kernel) | ~200ms | Low | Local dev only |
| **Docker + gVisor (runsc)** | High (user-space kernel) | ~400ms | Low | **MVP recommendation** |
| **Judge0 self-hosted** | Medium | ~300ms | Medium (separate service) | If you want pre-built |
| **Firecracker microVMs** | Very high | ~125ms | High (custom orchestrator) | Scale phase only |
| **Kubernetes Jobs** | Medium-High | 1–3s | Medium | Bursty load > 100 rps |

**Recommendation**: Start with Docker + gVisor on a single $5/mo VPS (Hetzner CX11 or Fly Machine). Move to Firecracker only when you're processing > 50k submissions/day and the per-job cold start matters.

### Per-language runtime images

Pre-pulled images; fixed digests; rebuilt weekly with security patches.

```dockerfile
# runtimes/python.Dockerfile
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    procps && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/bash runner
WORKDIR /workspace
USER runner
# No pip install at runtime; pre-bake commonly used libs:
# RUN pip install --no-cache-dir pytest pydantic
```

```dockerfile
# runtimes/java.Dockerfile
FROM eclipse-temurin:21-jdk-alpine
RUN addgroup -S runner && adduser -S runner -G runner
WORKDIR /workspace
USER runner
```

### Resource limits (production defaults)

```yaml
memory: 256Mi
cpu: 0.5
pids: 64
disk: 64Mi (tmpfs)
walltime: 10s (per test case)
total_walltime: 60s
network: none
capabilities: drop ALL
syscalls: gVisor profile
```

### Anti-cheating at execution layer

- Strip environment variables before exec.
- Disallow outbound network at network namespace level (not just iptables).
- Reject submissions that exceed 200KB total source size.
- Static-analyze for obvious cheese (calling `subprocess`, reading `/etc/passwd`, accessing test fixture paths).
- All file I/O sandboxed to `/workspace`.

---

## 8. Frontend Architecture

### Routing (Next.js App Router)

```
app/
├── (marketing)/
│   ├── page.tsx                 # landing
│   ├── pricing/page.tsx
│   └── changelog/page.tsx
├── (app)/
│   ├── layout.tsx               # shell: top bar, command palette
│   ├── dashboard/page.tsx
│   ├── problems/
│   │   ├── page.tsx             # list
│   │   └── [slug]/
│   │       ├── page.tsx         # the IDE
│   │       └── layout.tsx       # full-bleed, no marketing chrome
│   ├── contests/
│   ├── interviews/[code]/
│   └── settings/
└── (admin)/
    └── admin/...
```

### The IDE layout (the centerpiece)

```
┌──────────────────────────────────────────────────────────────────────┐
│  TopBar:  Logo  |  Problem title       Timer ⌛  Run ▶  Submit ⏫    │
├───────────────────────┬──────────────────────────────────────────────┤
│                       │  Tabs:  Main.java  |  ParkingLot.java  |  +  │
│   Description         │ ┌──────────────────────────────────────────┐ │
│   Constraints         │ │                                          │ │
│   Examples            │ │            Monaco Editor                 │ │
│   Hints               │ │                                          │ │
│   Discussion          │ │                                          │ │
│   Editorial 🔒         │ │                                          │ │
│   Architecture        │ └──────────────────────────────────────────┘ │
│                       ├──────────────────────────────────────────────┤
│                       │  Console │ Tests │ Output │ AI Review        │
│                       │                                              │
│                       │  [streaming test results, runtime, memory]   │
└───────────────────────┴──────────────────────────────────────────────┘
```

Implemented with `react-resizable-panels` (works flawlessly with Monaco's ResizeObserver).

### State architecture

Three layers:

1. **Server state** — TanStack Query. Caches problem data, submission history, leaderboards.
2. **UI state** — Zustand. Panel sizes, active tab, theme, command palette open, modal stack.
3. **Editor state** — Monaco models, held in a ref-keyed map per `(problem, language)`. Synced to `drafts` table with 1.5s debounce.

```typescript
// lib/store/editor.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface EditorState {
  activeFile: string
  files: Record<string, string>
  language: Language
  setFile: (path: string, contents: string) => void
  setActiveFile: (path: string) => void
}

export const useEditor = create<EditorState>()(
  persist(
    (set) => ({
      activeFile: 'main.py',
      files: {},
      language: 'python',
      setFile: (path, contents) =>
        set((s) => ({ files: { ...s.files, [path]: contents } })),
      setActiveFile: (path) => set({ activeFile: path }),
    }),
    { name: 'sdc-editor' }
  )
)
```

### Command palette (⌘K)

Built with `cmdk`. Surfaces:
- Run / Submit
- Switch language
- Jump to file
- Go to problem (fuzzy across catalogue)
- Toggle panel
- Theme
- Recent submissions

### Keyboard shortcuts

```
⌘K          Command palette
⌘↵          Run code
⌘⇧↵         Submit
⌘B          Toggle problem panel
⌘J          Toggle console
⌘P          Quick open file
⌘/          Comment selection
F11         Fullscreen IDE
```

### Performance budget

- LCP < 1.5s on the IDE route (Monaco lazy-loaded after first paint).
- INP < 200ms.
- Monaco loaded via dynamic import; tokenizers loaded on demand per language.
- No client-side data fetching on the IDE shell — RSC fetches problem + draft on the server.

---

## 9. Authentication & RBAC

### Token model

- **Access token**: JWT, 15-min TTL, signed with rotating EdDSA keypair, contains `{sub, role, plan, sid}`.
- **Refresh token**: opaque 32-byte random, hashed in DB (`sessions` table), 30-day sliding window, HttpOnly+Secure+SameSite=Lax cookie.

### OAuth flow (GitHub example)

```
Browser ──► /auth/oauth/github ──► GitHub OAuth (state=csrf)
       ◄── 302
GitHub ──► /auth/oauth/github/callback?code=...&state=...
            ├─ verify state
            ├─ exchange code → access_token
            ├─ fetch profile + verified emails
            ├─ upsert user + oauth_accounts row
            ├─ create session, set refresh cookie
            └─ 302 → /dashboard with access in fragment (consumed by client)
```

### RBAC

Three coarse roles, fine-grained via plan tier and resource ownership:

```python
class Permission(str, Enum):
    PROBLEM_VIEW = "problem.view"
    PROBLEM_VIEW_EDITORIAL = "problem.view_editorial"  # plan-gated
    PROBLEM_CREATE = "problem.create"                  # admin
    INTERVIEW_HOST = "interview.host"                  # admin | interviewer
    ADMIN_ANALYTICS = "admin.analytics"

ROLE_PERMS = {
    "user": {Permission.PROBLEM_VIEW},
    "interviewer": {Permission.PROBLEM_VIEW, Permission.INTERVIEW_HOST},
    "admin": set(Permission),
}

# FastAPI dep
async def require(perm: Permission, user: User = Depends(current_user)):
    if perm not in ROLE_PERMS[user.role]:
        if perm == Permission.PROBLEM_VIEW_EDITORIAL and user.plan in ("pro", "team"):
            return
        raise HTTPException(403)
```

---

## 10. Realtime Layer

Two distinct use cases, **same WebSocket connection**, different channel namespaces.

### A. Submission streaming

Worker publishes events to Redis `submission:{id}`. WS hub subscribes and fans out to clients in that submission's room.

Events:
```typescript
type SubmissionEvent =
  | { type: 'status'; status: 'queued' | 'running' | 'done' | 'failed' }
  | { type: 'log'; stream: 'stdout' | 'stderr'; line: string }
  | { type: 'test'; test_id: string; status: 'passed' | 'failed' | 'error'; runtime_ms: number; diff?: string }
  | { type: 'result'; score: number; passed: number; total: number; runtime_ms: number; memory_kb: number }
  | { type: 'ai_review_started' }
  | { type: 'ai_review_done'; review_id: string }
```

### B. Collaborative interview rooms

Yjs document over WebSocket. Each interview room has:
- A shared `Y.Doc` with `Y.Text` for each file
- Awareness protocol for cursors + selections + presence
- Server-side persistence: snapshot every 10s + on disconnect, into `interviews.snapshot` JSONB blob

Why Yjs over OT: simpler conflict resolution, mature ecosystem (`y-monaco` binding is one line of glue), CRDT properties make offline edits safe.

### WS hub (FastAPI)

```python
# modules/realtime/router.py
@router.websocket("/submissions/{sid}/stream")
async def submission_stream(ws: WebSocket, sid: UUID, user = Depends(ws_auth)):
    await assert_owns_submission(user, sid)
    await ws.accept()
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"submission:{sid}")
    try:
        async for msg in pubsub.listen():
            if msg["type"] != "message": continue
            await ws.send_text(msg["data"])
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(f"submission:{sid}")
```

---

## 11. Sample Problem Spec Format

Problems live as files in `/problems/<slug>/`. One source of truth, importable into DB via `scripts/load-problems.py`.

```yaml
# problems/parking-lot/problem.yaml
slug: parking-lot
title: "Design a Parking Lot System"
difficulty: medium
category: lld
time_limit_minutes: 90
companies: [amazon, uber, atlassian]
tags: [oop, design-patterns, state-machine]
constraints:
  max_floors: 10
  vehicle_types: [motorcycle, car, truck, ev]
  payment_modes: [hourly, monthly_pass, free]
rubric:
  dimensions:
    correctness:        { weight: 40 }
    oop_design:         { weight: 20 }
    extensibility:      { weight: 15 }
    concurrency:        { weight: 10 }
    api_ergonomics:     { weight: 10 }
    edge_cases:         { weight: 5 }
  expected_patterns: [strategy, factory, singleton, observer]
  red_flags: [god_class, hardcoded_pricing, mutable_global_state]
```

```markdown
<!-- problems/parking-lot/statement.md -->
# Parking Lot System

Design a parking lot that supports multiple floors, vehicle types, and pricing strategies. Build a working `ParkingLotService` your tests can exercise.

## Functional requirements
- Park a vehicle, returning a ticket
- Unpark by ticket, returning the bill
- Query free spots by floor / vehicle type
- Support hourly, day-pass, and monthly-pass pricing
- Allow at least 2 pricing strategies to be swapped at runtime

## Non-functional
- Concurrent parking attempts must be safe (consider 100 concurrent threads)
- Adding a new vehicle type (e.g. `BICYCLE`) must require modifying only 1 file

## Inputs
You implement the `ParkingLotService` interface in the starter template. Tests call your service directly.

## Scoring
See the AI Review tab after submission for design feedback. Test pass rate gives the base score.
```

Starter templates ship per-language; tests run them.

---

## 12. AI Evaluation Pipeline

### Goal

After a submission passes its unit tests, generate structured design feedback: SOLID compliance, pattern usage, extensibility, code quality.

### Pipeline

```
submission done ──► enqueue ai_review job (Redis stream `ai:queue`)
   │
   ▼
ai_worker:
  1. Fetch submission files
  2. Fetch problem.rubric
  3. Build prompt:
     - system: "You are reviewing an LLD interview submission..."
     - rubric (dimensions, weights, expected patterns)
     - files (concatenated with path headers)
     - test results summary
  4. Call Claude API with structured output schema
  5. Persist ai_reviews row
  6. Publish `ai_review_done` event to submission's pubsub channel
```

### Structured output schema

```python
class ReviewComment(BaseModel):
    file: str
    line: int | None
    severity: Literal["info", "suggestion", "warning", "critical"]
    category: Literal["solid", "pattern", "concurrency", "naming", "style", "extensibility"]
    message: str

class AIReview(BaseModel):
    overall_score: float = Field(ge=0, le=100)
    dimensions: dict[str, float]
    comments: list[ReviewComment]
    summary_md: str
    detected_patterns: list[str]
    missing_patterns: list[str]
```

### Cost control

- Cache reviews: same (problem, code_hash) → reuse stored review.
- Free tier: 3 reviews per day per user.
- Use Haiku for first-pass triage; Sonnet for full review only on submissions scoring above 50% on tests.

---

## 13. Security & Anti-Cheating

### Sandbox

Covered in §7. The chain of defense:
1. Containerization (namespaces)
2. gVisor (syscall filtering)
3. seccomp profile (deny dangerous syscalls)
4. Network namespace with no interfaces
5. Read-only root, tmpfs scratch
6. Drop all capabilities
7. cgroup limits (CPU, memory, PIDs)
8. Wall-clock and CPU-time timeouts

### API security

- HTTPS only, HSTS, secure cookies
- CSRF tokens on state-changing form posts (not needed for token-auth XHR, but the OAuth callback uses one)
- CSP with `script-src 'self'` (Monaco worker loaded same-origin)
- Rate limits: per-IP and per-user (Redis sliding window)
  - 60 req/min unauth
  - 600 req/min authenticated
  - Submissions: 10/hour free, 60/hour pro
- All inputs validated by Pydantic; SQL via parameterized SQLAlchemy
- Secret rotation: monthly via GH Actions secret rotation playbook

### Anti-cheating

- Submission diff vs. starter — high-overlap submissions flagged (likely copy from internet solution; track repeat offenders).
- During contests/interviews: paste-rate monitoring (multiple large pastes within seconds), tab-blur tracking with `visibilitychange`.
- Fingerprint via session + device hash; one account, one device for active contest.
- AI-content detector on submitted code (perplexity-based) — informational only, not blocking. False positives are common.
- Interviewer-mode: record full keystroke timeline (option, off by default; opt-in).

---

## 14. Observability

### Stack

- **Tracing & metrics**: OpenTelemetry SDK in API and executor → OTLP → Grafana Cloud (free tier: 10k series, 50GB logs).
- **Logs**: structured JSON via `structlog`, shipped via Vector or Grafana Alloy.
- **Errors**: Sentry (free tier 5k events/mo).
- **Uptime**: BetterStack Uptime (free tier 10 monitors).

### What to instrument from day 1

- HTTP request duration histogram, by route
- Submission lifecycle: queued → running → done timings
- Worker queue depth
- AI review latency + cost (token counts)
- Redis pubsub lag

### SLOs (post-launch targets)

| SLO | Target |
|---|---|
| API p95 latency (excl. submissions) | < 200ms |
| Submission queue wait p95 | < 2s |
| End-to-end submission p95 (with tests) | < 15s |
| Availability | 99.5% (free), 99.9% (pro) |

---

## 15. Deployment — Free-Tier MVP

Goal: deploy and run for **$0–$10/month** at launch.

| Component | Provider | Free tier | Notes |
|---|---|---|---|
| Frontend | Vercel Hobby | 100GB bandwidth | Edge runtime where possible |
| API | Fly.io | 3 shared-cpu-1x, 256MB | Single region (BLR if your audience is India) |
| Executor worker | Fly Machines | Pay-per-second | Auto-stop when queue empty |
| Postgres | Neon free | 0.5GB, scale-to-zero | Branch per PR for dev |
| Redis | Upstash free | 10k commands/day | Plenty for MVP |
| Object storage | Cloudflare R2 | 10GB free, no egress | Submission artifacts |
| Auth (OAuth) | Auth.js self-hosted | $0 | GitHub & Google free |
| AI | Anthropic API | Pay-per-use | Cache aggressively |
| CDN | Cloudflare | Free | In front of R2 + custom domain |
| CI/CD | GitHub Actions | 2000 min/mo | Plenty |
| Errors | Sentry free | 5k events | |
| Metrics | Grafana Cloud free | 10k series | |
| Uptime | BetterStack free | 10 monitors | |

### One-command local dev

```bash
git clone https://github.com/you/systemdesigncode
cd systemdesigncode
cp .env.example .env
docker compose up
# Web on :3000, API on :8000, executor running, Postgres + Redis up
```

### Free-tier traps to avoid

- **Vercel function timeout** is 10s on Hobby — don't put submissions through Next.js API routes; go direct from client → FastAPI WS.
- **Neon scale-to-zero** adds ~1s cold start — fine for marketing pages, but keep API instances warm.
- **Fly free tier auto-suspends** — accept this for the worker (good thing) but use a paid $1.94/mo `shared-cpu-1x-256MB` for the API to keep it always-on.
- **Upstash command limit** — every Redis op counts. Cache the cache key first in-memory.

---

## 16. Deployment — Scaled Production

When you hit ~10k MAU or ~5k submissions/day, the shape changes.

### Production topology

```
                              Cloudflare (DNS, WAF, CDN)
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
     Vercel (frontend)          NGINX / Caddy LB         Cloudflare R2
                                       │
                  ┌────────────────────┼────────────────────┐
                  ▼                    ▼                    ▼
            API (k8s deploy)    Realtime (sticky)    AI worker pool
                  │                    │                    │
                  └──────────┬─────────┴────────────────────┘
                             ▼
                     ┌───────────────┐
                     │ Managed Redis │  ← sentinel/cluster
                     │ Managed Pg    │  ← primary + read replicas
                     └───────────────┘
                             │
                             ▼
              Executor cluster (firecracker microVMs)
```

### Kubernetes manifests (sketch)

```yaml
# infra/k8s/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: sdc-api }
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
  selector: { matchLabels: { app: sdc-api } }
  template:
    metadata: { labels: { app: sdc-api } }
    spec:
      containers:
      - name: api
        image: ghcr.io/you/sdc-api:${VERSION}
        ports: [{ containerPort: 8000 }]
        envFrom: [{ secretRef: { name: sdc-api-env } }]
        resources:
          requests: { cpu: 250m, memory: 256Mi }
          limits:   { cpu: 1,    memory: 512Mi }
        readinessProbe: { httpGet: { path: /healthz, port: 8000 }, periodSeconds: 5 }
        livenessProbe:  { httpGet: { path: /healthz, port: 8000 }, periodSeconds: 15 }
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: sdc-api-hpa }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: sdc-api }
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource: { name: cpu, target: { type: Utilization, averageUtilization: 60 } }
```

### Migration triggers

| Trigger | Action |
|---|---|
| Submission queue p95 wait > 5s | Add executor replicas / move to k8s Jobs |
| API CPU > 60% sustained | Bump HPA min, scale Postgres |
| Pg write QPS > 500 | Add PgBouncer, route reads to replica |
| WS connection count > 5k per node | Shard realtime by user_id hash |
| AI cost > $500/mo | Add prompt caching, distill cheaper model |

---

## 17. Cost Modeling

Assumptions: average submission = 10s of compute, 80% pass tests, 20% trigger AI review (which uses ~3k input tokens / 1k output tokens of Sonnet).

### 100 users (early beta)

| Item | Cost/mo |
|---|---|
| Everything | **$0** |
| Maybe API host | $1.94 (Fly shared-1x always-on) |
| **Total** | **~$2** |

### 1,000 users (~50 DAU, ~200 submissions/day)

| Item | Cost/mo |
|---|---|
| Vercel | $0 |
| Fly.io API + worker | ~$15 |
| Neon Pro | $19 (when you exceed 0.5GB) |
| Upstash | $0 (still under free tier) |
| R2 | < $1 |
| AI (40 reviews/day) | ~$30 |
| Sentry | $0 |
| **Total** | **~$65** |

### 10,000 users (~500 DAU, ~2,000 submissions/day)

| Item | Cost/mo |
|---|---|
| Vercel Pro | $20 |
| Fly.io API (3x shared-2x) | $60 |
| Executor cluster (2x dedicated-2x) | $60 |
| Neon scale plan | $69 |
| Upstash Pro | $10 |
| R2 (200GB) | $3 |
| AI (~400 reviews/day, with caching) | ~$200 |
| Grafana Cloud | $0–$20 |
| Sentry team | $26 |
| **Total** | **~$450–$500** |

Per-user cost: **~5¢/month**. With Pro pricing of $9/mo capturing 5% of MAU, ARPU = $0.45 → ~9x margin. Healthy.

### Cost levers (in order of impact)

1. **AI evaluation** is the dominant variable cost. Cache by `(problem_id, sha256(code))`. Use Haiku for warm-up triage.
2. **Executor compute** — auto-stop when queue empty. Per-second billing on Fly Machines makes this huge.
3. **Postgres** — vacuum aggressively, drop noisy tables (audit logs > 90d to R2), use JSONB sparingly.
4. **WebSocket** — don't broadcast log lines char-by-char; debounce to 100ms.

---

## 18. Roadmap

### V1 — "Solo dev launches" (2–4 weeks)
- [ ] Auth (email/pass + GitHub OAuth)
- [ ] 10 curated problems (parking lot, splitwise, LRU cache, rate limiter, snake & ladder, elevator, BookMyShow, URL shortener, in-memory key-value store, notification service)
- [ ] Monaco IDE with single-file + Python/Java/Go runtimes
- [ ] Sandboxed execution (Docker + gVisor)
- [ ] Public/hidden test cases
- [ ] Submission streaming via WS
- [ ] Drafts autosave
- [ ] Dashboard (solved count, last 7 days)
- [ ] Landing page
- [ ] Docker Compose for local dev

**Ship goal**: deployable on free tier, 1 user (you) → 100 users via HN/Reddit/Twitter.

### V2 — "Multi-file + AI + Contests" (weeks 5–10)
- [ ] Multi-file editor
- [ ] All 5 language runtimes
- [ ] AI design review (Claude-based)
- [ ] Editorials (premium)
- [ ] Contests with leaderboard
- [ ] Discussion threads per problem
- [ ] Profile pages
- [ ] Stripe billing (Pro tier)

### V3 — "Interviews + Collaboration" (weeks 11–20)
- [ ] Pair interview rooms (Yjs collaboration)
- [ ] Architecture whiteboard (React Flow)
- [ ] Voice via LiveKit (free tier)
- [ ] Interview recordings
- [ ] Company-branded assessments
- [ ] AI mock interviewer (voice agent)
- [ ] Mobile-responsive view-only mode
- [ ] LSP integration (proper Java/Python autocomplete)

### V4+ — "Platform"
- API for embedding the IDE in third-party sites
- Resume → roadmap (AI-generated prep plan)
- Company subscriptions (assessment hosting, ATS integration)
- Self-hosted enterprise edition

---

## 19. Business / SaaS Strategy

### Pricing

| Plan | Price | Quotas | Audience |
|---|---|---|---|
| Free | $0 | 10 submissions/hr, 3 AI reviews/day, 30 problems | Students, casual prep |
| Pro | $9/mo or $79/yr | Unlimited submissions, 50 AI reviews/day, all problems, editorials, contest entry | Active job-seekers |
| Pro+ | $19/mo | Pro + voice mock interviews, priority queue | Senior candidates |
| Teams | $99/mo (10 seats) | Pro features + private problem sets + admin dashboard | Bootcamps, prep cohorts |
| Enterprise | Custom | SSO, SCIM, white-label assessments, ATS hooks | Companies for hiring |

### Go-to-market

1. **Open-source the core**. Repo with `docker compose up` → working clone. Drives developer adoption, SEO, GH stars.
2. **Content moat**. Publish solutions, design patterns, weekly "LLD of the week" newsletter. Targets the keywords nobody owns yet (e.g., "Parking lot LLD Java solution").
3. **Distribution partnerships**. Free seats for top YC backend programs, Outlier-style bootcamps, university CS clubs.
4. **Build in public**. Twitter/X + Indie Hackers narrative ("solo dev competing with Interviewing.io").

### Why this can win

- Existing players (LeetCode, AlgoExpert) treat machine coding as an afterthought.
- New grad and 1–3 YoE Indian/SE-Asia market is huge and underserved here (Naukri, AmbitionBox keyword search shows ~70% of mid-tier backend interviews include a machine-coding round).
- Open-core + AI eval = lower CAC and a defensible moat (proprietary rubrics + problem-test corpus).

### Risk / countermove

- **LeetCode adds LLD section** → likely happens within 18 months. Stay differentiated: deep AI feedback, contest realism, interviewer mode, OSS community.

---

## 20. Open Questions & Risks

| Question | Suggested resolution |
|---|---|
| Should the editor support LSPs (full autocomplete) in V1? | No. Monaco built-ins are enough. Add LSP in V3 — it's a separate connection per language and adds infra complexity. |
| Is gVisor enough sandboxing for an OSS, publicly accessible runner? | Yes for V1–V2 with strict rate limits. For V3 enterprise, plan Firecracker migration. |
| Run AI reviews synchronously or async? | Async only. UX: "AI review will arrive in ~20s." Sync blocks the UI and ties up an API worker. |
| Multi-region from day 1? | No. Single region (closest to target audience) until you have paying customers in another region. |
| Build your own executor or use Judge0? | Build. Judge0 is great for DSA-style single-file IO problems but doesn't fit multi-file LLD workflows. |
| Yjs vs ShareJS for collab? | Yjs. CRDT + Monaco binding is a 50-LOC integration. |
| Charge for AI reviews on free tier? | Give 3/day free as the hook. AI review *is* the differentiator — let people taste it. |

---

## Appendix: Sequence Diagram — End-to-End Submission

```
Client      Next.js     FastAPI      Postgres    Redis Stream   Worker     Sandbox    Redis Pub
  │           │            │            │            │             │           │           │
  │─Submit───►│            │            │            │             │           │           │
  │           │─POST /sub─►│            │            │             │           │           │
  │           │            │─INSERT────►│            │             │           │           │
  │           │            │◄───id──────│            │             │           │           │
  │           │            │─XADD──────────────────►│             │           │           │
  │           │◄──{id}─────│            │            │             │           │           │
  │◄─{id}─────│            │            │            │             │           │           │
  │═WS:/stream═════════════►│            │            │             │           │           │
  │           │            │─SUBSCRIBE────────────────────────────────────────────────────►│
  │           │            │            │            │─XREADGROUP─►│           │           │
  │           │            │            │            │             │─spawn────►│           │
  │           │            │            │            │             │           │           │
  │           │            │            │            │             │─PUBLISH "running"─────►│
  │◄══status: running═══════════════════════════════════════════════════════════════════════│
  │           │            │            │            │             │◄─stdout──│           │
  │           │            │            │            │             │─PUBLISH "log"─────────►│
  │◄══log: ...═══════════════════════════════════════════════════════════════════════════════│
  │           │            │            │            │             │  (per test case)       │
  │           │            │            │            │             │─PUBLISH "test"────────►│
  │◄══test: passed/failed══════════════════════════════════════════════════════════════════│
  │           │            │            │            │             │─UPDATE submission     │
  │           │            │            │            │             │─XADD ai:queue         │
  │           │            │            │            │             │─PUBLISH "result"──────►│
  │◄══result: score=85, ...═════════════════════════════════════════════════════════════════│
  │           │            │            │            │             │           │           │
  │           │            │     (ai_worker picks up, ~20s later, publishes ai_review_done) │
  │◄══ai_review_done: review_id=...═════════════════════════════════════════════════════════│
```
