#!/usr/bin/env python3
"""
Data migrations for local Postgres (Supabase).

Setup (once): cd tools/data-migrations && uv sync

Run via: pnpm data:migrate  (uv; flags like pnpm data:migrate --list)
"""

from __future__ import annotations

import argparse
import importlib.util
import os
import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent
MIGRATIONS_DIR = ROOT / "migrations"
ADVISORY_LOCK_ID = 874_221_903

DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54332/postgres"

ENSURE_TABLE_SQL = """
create table if not exists public.data_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);
"""


def database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)


def discover_migration_files() -> list[Path]:
    files = sorted(MIGRATIONS_DIR.glob("*.py"))
    return [p for p in files if not p.name.startswith("_")]


def load_migration_module(path: Path):
    spec = importlib.util.spec_from_file_location(f"data_migration_{path.stem}", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load migration module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not hasattr(module, "DESCRIPTION") or not hasattr(module, "run"):
        raise RuntimeError(f"Migration {path.name} must define DESCRIPTION and run(cursor)")
    return module


def fetch_applied(conn: psycopg.Connection) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            "select id from public.data_migrations order by id",
        )
        return {row[0] for row in cur.fetchall()}


def list_migrations(conn: psycopg.Connection) -> int:
    applied = fetch_applied(conn)
    pending = [p for p in discover_migration_files() if p.stem not in applied]
    print("Applied:")
    if not applied:
        print("  (none)")
    else:
        for migration_id in sorted(applied):
            print(f"  {migration_id}")
    print("Pending:")
    if not pending:
        print("  (none)")
    else:
        for path in pending:
            mod = load_migration_module(path)
            print(f"  {path.stem}: {mod.DESCRIPTION}")
    return 0


def run_migrations(dry_run: bool) -> int:
    files = discover_migration_files()
    if not files:
        print("No data migrations found.")
        return 0

    with psycopg.connect(database_url()) as conn:
        conn.execute(ENSURE_TABLE_SQL)
        conn.commit()

        with conn.transaction():
            conn.execute("select pg_advisory_lock(%s)", (ADVISORY_LOCK_ID,))

        try:
            applied = fetch_applied(conn)
            pending = [p for p in files if p.stem not in applied]

            if not pending:
                print("No pending data migrations.")
                return 0

            for path in pending:
                migration_id = path.stem
                module = load_migration_module(path)
                print(f"Running {migration_id}: {module.DESCRIPTION}")

                try:
                    with conn.transaction():
                        with conn.cursor() as cur:
                            module.run(cur)
                            if dry_run:
                                raise DryRunRollback()
                            cur.execute(
                                "insert into public.data_migrations (id) values (%s)",
                                (migration_id,),
                            )
                except DryRunRollback:
                    print(f"  dry-run: rolled back {migration_id}")
                    continue
                except Exception as exc:
                    print(f"  failed {migration_id}: {exc}", file=sys.stderr)
                    return 1

                if not dry_run:
                    print(f"  applied {migration_id}")

            if dry_run:
                print("Dry run complete (no changes committed).")
            else:
                print("Data migrations complete.")
            return 0
        finally:
            with conn.cursor() as cur:
                cur.execute("select pg_advisory_unlock(%s)", (ADVISORY_LOCK_ID,))


class DryRunRollback(Exception):
    pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Python data migrations")
    parser.add_argument("--list", action="store_true", help="List applied and pending")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run pending migrations but roll back each one",
    )
    args = parser.parse_args()

    try:
        if args.list:
            with psycopg.connect(database_url()) as conn:
                conn.execute(ENSURE_TABLE_SQL)
                conn.commit()
                return list_migrations(conn)
        return run_migrations(dry_run=args.dry_run)
    except psycopg.Error as exc:
        print(f"Database error: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
