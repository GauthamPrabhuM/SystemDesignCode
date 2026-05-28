"""
Load problems from /problems/*/ into the database.

Idempotent: re-running upserts based on slug. Run at API startup or via:
    python scripts/load_problems.py /problems
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import yaml
from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.session import SessionLocal
from app.modules.problems.models import Problem, StarterTemplate, TestCase, TestResult


async def load_one(session, root: Path) -> None:
    meta_path = root / "problem.yaml"
    if not meta_path.exists():
        return
    meta = yaml.safe_load(meta_path.read_text())
    statement = (root / "statement.md").read_text() if (root / "statement.md").exists() else ""

    # Upsert problem
    result = await session.execute(
        pg_insert(Problem.__table__).values(
            slug=meta["slug"],
            title=meta["title"],
            difficulty=meta.get("difficulty", "medium"),
            category=meta.get("category", "lld"),
            statement_md=statement,
            constraints=meta.get("constraints", {}),
            time_limit_minutes=meta.get("time_limit_minutes", 90),
            is_premium=meta.get("is_premium", False),
            is_published=True,
            rubric=meta.get("rubric"),
        ).on_conflict_do_update(
            index_elements=["slug"],
            set_={
                "title": meta["title"],
                "difficulty": meta.get("difficulty", "medium"),
                "category": meta.get("category", "lld"),
                "statement_md": statement,
                "constraints": meta.get("constraints", {}),
                "time_limit_minutes": meta.get("time_limit_minutes", 90),
                "is_premium": meta.get("is_premium", False),
                "rubric": meta.get("rubric"),
            },
        ).returning(Problem.__table__.c.id)
    )
    problem_id = result.scalar_one()

    # Replace starter templates
    await session.execute(
        delete(StarterTemplate.__table__).where(StarterTemplate.__table__.c.problem_id == problem_id)
    )
    starter_root = root / "starter"
    if starter_root.exists():
        for lang_dir in sorted(starter_root.iterdir()):
            if not lang_dir.is_dir():
                continue
            files = []
            entrypoint = None
            for f in lang_dir.rglob("*"):
                if f.is_file():
                    files.append({"path": f.name, "contents": f.read_text()})
                    if entrypoint is None or f.name.lower().startswith(("main", "solution")):
                        entrypoint = f.name
            if files:
                await session.execute(
                    pg_insert(StarterTemplate.__table__).values(
                        problem_id=problem_id,
                        language=lang_dir.name,
                        files=files,
                        entrypoint=entrypoint or files[0]["path"],
                    ).on_conflict_do_update(
                        index_elements=["problem_id", "language"],
                        set_={"files": files, "entrypoint": entrypoint or files[0]["path"]},
                    )
                )

    # Delete test_results first (FK: test_results.test_case_id → test_cases.id, no CASCADE)
    existing_tc_ids = (await session.execute(
        select(TestCase.id).where(TestCase.problem_id == problem_id)
    )).scalars().all()
    if existing_tc_ids:
        await session.execute(
            delete(TestResult.__table__).where(TestResult.__table__.c.test_case_id.in_(existing_tc_ids))
        )

    # Replace test cases
    await session.execute(
        delete(TestCase.__table__).where(TestCase.__table__.c.problem_id == problem_id)
    )
    cases_path = root / "tests" / "cases.yaml"
    if cases_path.exists():
        for c in (yaml.safe_load(cases_path.read_text()) or []):
            await session.execute(
                pg_insert(TestCase.__table__).values(
                    problem_id=problem_id,
                    name=c["name"],
                    kind=c.get("kind", "public"),
                    weight=c.get("weight", 1),
                    input=c.get("input", {}),
                    expected=c.get("expected", {}),
                    timeout_ms=c.get("timeout_ms", 5000),
                )
            )

    # Commit per-problem so a single failure doesn't cascade
    await session.commit()
    print(f"  loaded: {meta['slug']}")


async def main(root: Path) -> None:
    print(f"loading problems from {root}")
    async with SessionLocal() as session:
        for problem_dir in sorted(root.iterdir()):
            if problem_dir.is_dir():
                try:
                    await load_one(session, problem_dir)
                except Exception as e:
                    await session.rollback()
                    print(f"  ! failed {problem_dir.name}: {e}")
    print("done.")


if __name__ == "__main__":
    asyncio.run(main(Path(sys.argv[1] if len(sys.argv) > 1 else "/problems")))
