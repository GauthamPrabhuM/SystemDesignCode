# Contributing to SystemDesignCode

Thanks for wanting to contribute. This is a free, open-source project — every PR, new problem, and bug report directly helps engineers prep for the rounds that decide offers.

## Ways to contribute

| Contribution | Effort | Impact |
|---|---|---|
| Author a new problem | Low — just YAML + markdown | High — more content = more value |
| Fix a bug | Low–Medium | High |
| Improve AI review prompts | Low | High |
| Frontend UX improvements | Medium | Medium |
| New language runtime | Medium | Medium |
| Infrastructure / k8s work | High | High |

---

## Authoring a new problem (easiest start)

Drop a folder into `problems/<your-slug>/`:

```
problems/your-slug/
├── problem.yaml          # metadata + rubric
├── statement.md          # problem statement (markdown)
├── starter/
│   ├── python/main.py
│   └── java/Main.java    # one folder per language you support
└── tests/
    └── cases.yaml        # public + hidden test cases
```

See [`problems/parking-lot/`](./problems/parking-lot/) for a worked example.

Once your folder is added, restart the API container (`docker compose restart api`) and hit `/problems/your-slug` to test it live.

---

## Setting up the dev environment

**Prerequisites:** Docker Desktop (Compose v2), Node 20+, Python 3.12+

```bash
git clone https://github.com/GauthamPrabhuM/systemdesigncode
cd systemdesigncode
cp .env.example .env

# Build language sandbox images (one-time, ~3 min)
docker build -t sdc-runtime-python:3.12 -f services/executor/runtimes/python.Dockerfile .
docker build -t sdc-runtime-node:20     -f services/executor/runtimes/node.Dockerfile   .
# ... repeat for java, go, cpp if needed

docker compose up
```

Web → http://localhost:3000 · API + Swagger → http://localhost:8000/docs

---

## Before opening a PR

1. **Backend**: `cd services/api && ruff check . && pytest`
2. **Frontend**: `cd apps/web && npm run typecheck && npm run lint`
3. **End-to-end smoke test**: run `docker compose up`, open `/problems/parking-lot`, hit Run, verify tests stream in
4. Keep PRs focused — one thing per PR makes review fast

---

## Commit style

```
feat: add rate-limiter problem
fix: executor memory leak on timeout
docs: clarify gVisor setup on Linux
```

Conventional commits (`feat`, `fix`, `docs`, `chore`, `refactor`) — no strict enforcer, just be descriptive.

---

## Code review SLA

PRs are reviewed within **3–5 days**. If your PR sits longer, ping in the issue thread.

---

## Questions?

Open a [GitHub Discussion](https://github.com/GauthamPrabhuM/systemdesigncode/discussions) — not an issue — for questions, ideas, and "would this PR be welcome?" checks before you invest time.
