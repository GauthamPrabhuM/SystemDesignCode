"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-28
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")

    # ---- users ----
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", postgresql.CITEXT, nullable=False, unique=True),
        sa.Column("username", sa.String(40), nullable=False, unique=True),
        sa.Column("display_name", sa.String(80)),
        sa.Column("avatar_url", sa.String(500)),
        sa.Column("password_hash", sa.String(255)),
        sa.Column("role", sa.String(20), nullable=False, server_default="user"),
        sa.Column("plan", sa.String(20), nullable=False, server_default="free"),
        sa.Column("email_verified", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "oauth_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("provider_id", sa.String(200), nullable=False),
        sa.Column("access_token", sa.String(2000)),
        sa.Column("refresh_token", sa.String(2000)),
        sa.UniqueConstraint("provider", "provider_id"),
    )

    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("refresh_token_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("user_agent", sa.String(500)),
        sa.Column("ip", postgresql.INET),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index("ix_sessions_expires_at", "sessions", ["expires_at"])

    # ---- problems ----
    op.create_table(
        "problems",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("slug", sa.String(120), nullable=False, unique=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("difficulty", sa.String(20), nullable=False),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("statement_md", sa.Text, nullable=False),
        sa.Column("constraints", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("time_limit_minutes", sa.Integer, nullable=False, server_default="90"),
        sa.Column("is_premium", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("is_published", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("rubric", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_problems_category_difficulty",
        "problems", ["category", "difficulty"],
        postgresql_where=sa.text("is_published"),
    )

    op.create_table(
        "problem_tags",
        sa.Column("problem_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("problems.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag", sa.String(80), primary_key=True),
    )
    op.create_index("ix_problem_tags_tag", "problem_tags", ["tag"])

    op.create_table(
        "problem_companies",
        sa.Column("problem_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("problems.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("company", sa.String(80), primary_key=True),
    )
    op.create_index("ix_problem_companies_company", "problem_companies", ["company"])

    op.create_table(
        "starter_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False),
        sa.Column("language", sa.String(20), nullable=False),
        sa.Column("files", postgresql.JSONB, nullable=False),
        sa.Column("entrypoint", sa.String(200), nullable=False),
        sa.UniqueConstraint("problem_id", "language"),
    )

    op.create_table(
        "test_cases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("weight", sa.Integer, nullable=False, server_default="1"),
        sa.Column("input", postgresql.JSONB, nullable=False),
        sa.Column("expected", postgresql.JSONB, nullable=False),
        sa.Column("timeout_ms", sa.Integer, nullable=False, server_default="5000"),
    )
    op.create_index("ix_test_cases_problem_kind", "test_cases", ["problem_id", "kind"])

    # ---- submissions ----
    op.create_table(
        "submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("problems.id", ondelete="CASCADE"), nullable=False),
        sa.Column("language", sa.String(20), nullable=False),
        sa.Column("files", postgresql.JSONB, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("score", sa.Numeric(5, 2)),
        sa.Column("passed_tests", sa.Integer),
        sa.Column("total_tests", sa.Integer),
        sa.Column("runtime_ms", sa.Integer),
        sa.Column("memory_kb", sa.Integer),
        sa.Column("error", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_submissions_user_created", "submissions", ["user_id", sa.text("created_at DESC")])
    op.create_index("ix_submissions_problem_status", "submissions", ["problem_id", "status"])

    op.create_table(
        "test_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("submission_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("test_case_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("test_cases.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("runtime_ms", sa.Integer),
        sa.Column("stdout", sa.Text),
        sa.Column("stderr", sa.Text),
        sa.Column("diff", sa.Text),
    )
    op.create_index("ix_test_results_submission", "test_results", ["submission_id"])

    op.create_table(
        "drafts",
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("problems.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("language", sa.String(20), primary_key=True),
        sa.Column("files", postgresql.JSONB, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ---- ai_reviews ----
    op.create_table(
        "ai_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("submission_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("model", sa.String(80), nullable=False),
        sa.Column("overall_score", sa.Numeric(5, 2)),
        sa.Column("dimensions", postgresql.JSONB, nullable=False),
        sa.Column("comments", postgresql.JSONB, nullable=False),
        sa.Column("summary_md", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ---- contests ----
    op.create_table(
        "contests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("slug", sa.String(120), nullable=False, unique=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description_md", sa.Text),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("visibility", sa.String(20), nullable=False, server_default="public"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
    )
    op.create_index("ix_contests_starts_at", "contests", ["starts_at"])

    op.create_table(
        "contest_problems",
        sa.Column("contest_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("contests.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("problems.id"), primary_key=True),
        sa.Column("position", sa.Integer, nullable=False),
    )

    op.create_table(
        "contest_participants",
        sa.Column("contest_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("contests.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("score", sa.Numeric(8, 2), server_default="0"),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
    )

    # ---- interviews ----
    op.create_table(
        "interviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("room_code", sa.String(20), nullable=False, unique=True),
        sa.Column("host_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id")),
        sa.Column("scheduled_at", sa.DateTime(timezone=True)),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("recording_url", sa.String(500)),
        sa.Column("notes_md", sa.Text),
    )
    op.create_index("ix_interviews_host", "interviews", ["host_id"])
    op.create_index("ix_interviews_candidate", "interviews", ["candidate_id"])

    # ---- discussions ----
    op.create_table(
        "discussions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("discussions.id")),
        sa.Column("title", sa.String(200)),
        sa.Column("body_md", sa.Text, nullable=False),
        sa.Column("upvotes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_discussions_problem_created", "discussions", ["problem_id", sa.text("created_at DESC")])

    # ---- audit ----
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger, sa.Identity(always=False), primary_key=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("target_type", sa.String(40)),
        sa.Column("target_id", postgresql.UUID(as_uuid=True)),
        sa.Column("metadata", postgresql.JSONB),
        sa.Column("ip", postgresql.INET),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_audit_actor_created", "audit_log", ["actor_id", sa.text("created_at DESC")])


def downgrade() -> None:
    for tbl in [
        "audit_log", "discussions", "interviews", "contest_participants", "contest_problems",
        "contests", "ai_reviews", "drafts", "test_results", "submissions", "test_cases",
        "starter_templates", "problem_companies", "problem_tags", "problems",
        "sessions", "oauth_accounts", "users",
    ]:
        op.drop_table(tbl)
