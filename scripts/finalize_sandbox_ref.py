"""Rewrite a Run record's ``sandbox_image_ref`` from PENDING to the current HEAD SHA.

DEC-FIN-006 + DEC-CDCP-014 background:

The watchlist export emitter records ``sandbox_image_ref`` at first
emit using the placeholder URI ``repo://chip-supply-chain-map@PENDING/``.
The placeholder lives in the Run record on disk until the data
commit that contains the sample lands. This script reads that
post-commit SHA via ``git rev-parse HEAD`` and rewrites every
``PENDING`` token across the Run record's ``sandbox_image_ref`` and
``inputs[].ref`` URIs to the resolved 40-char SHA.

Without this two-pass shape the emitter would record a SHA one
commit BEHIND the sample-containing commit (the systemic off-by-one
that all four Round-5 agents independently caught and patched at
the sample level). The placeholder + finalizer pattern fixes the
root cause: the producer records intent; the finalizer records
truth once truth exists.

CLI:

    python scripts/finalize_sandbox_ref.py --run-id run-<id>

Behavior:

1. Load ``ops/run-records/<run-id>.json``. Fail clearly if missing.
2. Read ``git rev-parse HEAD`` from the repo root.
3. Replace every literal ``@PENDING/`` substring inside the Run
   record's string-valued fields (``sandbox_image_ref`` and every
   ``inputs[].ref``) with ``@<head-sha>/``. The replacement is
   surgical (no regex pass over the whole JSON body) so unrelated
   ``PENDING`` text in payloads or notes is never touched.
4. Re-write the Run record JSON in place with the same sort-keys +
   2-space indent shape as the emitter so the diff is one line per
   touched field.
5. Print a summary line listing the touched fields.

Exit codes: ``0`` rewrite happened or the record already carries a
non-PENDING SHA (idempotent); ``1`` if the Run record file is
missing or ``git rev-parse HEAD`` fails.

The script is intentionally offline-first; it never talks to a
remote and never edits any file outside ``ops/run-records/``.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
RUN_RECORDS_DIR = ROOT / "ops" / "run-records"

PENDING_TOKEN = "@PENDING/"


def _git_head_sha(repo_root: Path) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo_root), "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(
            f"finalize_sandbox_ref: git rev-parse HEAD failed: "
            f"{result.stderr.strip()}"
        )
    sha = result.stdout.strip()
    if not sha:
        raise SystemExit("finalize_sandbox_ref: git rev-parse HEAD returned empty")
    return sha


def _replace_pending(value: Any, head_sha: str) -> tuple[Any, bool]:
    """Return ``(replaced_value, did_change)`` for one field value.

    Only operates on string values; everything else passes through.
    The substitution is the literal substring ``@PENDING/`` to
    ``@<head-sha>/`` so a string like ``repo://chip-supply-chain-map@PENDING/foo.csv``
    becomes ``repo://chip-supply-chain-map@<sha>/foo.csv`` without
    touching surrounding bytes.
    """
    if not isinstance(value, str):
        return value, False
    if PENDING_TOKEN not in value:
        return value, False
    return value.replace(PENDING_TOKEN, f"@{head_sha}/"), True


def finalize(
    run_id: str, repo_root: Path, *, head_sha_override: str | None = None
) -> tuple[int, list[str]]:
    """Rewrite PENDING tokens in the Run record. Returns (rc, touched_fields)."""
    record_path = repo_root / "ops" / "run-records" / f"{run_id}.json"
    if not record_path.is_file():
        print(
            f"finalize_sandbox_ref: Run record not found at "
            f"{record_path.relative_to(repo_root).as_posix()}",
            file=sys.stderr,
        )
        return 1, []

    run: dict[str, Any] = json.loads(record_path.read_text(encoding="utf-8"))
    head_sha = head_sha_override or _git_head_sha(repo_root)

    touched: list[str] = []

    if "sandbox_image_ref" in run:
        new_value, changed = _replace_pending(run["sandbox_image_ref"], head_sha)
        if changed:
            run["sandbox_image_ref"] = new_value
            touched.append("sandbox_image_ref")

    inputs = run.get("inputs")
    if isinstance(inputs, list):
        for idx, entry in enumerate(inputs):
            if not isinstance(entry, dict):
                continue
            ref = entry.get("ref")
            new_value, changed = _replace_pending(ref, head_sha)
            if changed:
                entry["ref"] = new_value
                touched.append(f"inputs[{idx}].ref")

    if not touched:
        print(
            f"finalize_sandbox_ref: no PENDING tokens in {run_id!r}; "
            f"record already carries a resolved SHA (idempotent)."
        )
        return 0, []

    record_path.write_text(
        json.dumps(run, sort_keys=True, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(
        f"finalize_sandbox_ref OK: run={run_id} head={head_sha} "
        f"touched={len(touched)} field(s): {', '.join(touched)}"
    )
    return 0, touched


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="finalize_sandbox_ref.py",
        description=(
            "Rewrite Run.sandbox_image_ref and Run.inputs[].ref PENDING "
            "tokens to the current git HEAD SHA (DEC-FIN-006)."
        ),
    )
    parser.add_argument(
        "--run-id",
        required=True,
        help="Run identifier (e.g. run-6a665b303138).",
    )
    parser.add_argument(
        "--head-sha",
        default=None,
        help=(
            "Override the HEAD SHA the finalizer writes (default: "
            "git rev-parse HEAD against the repo root). Intended for "
            "tests."
        ),
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    rc, _ = finalize(args.run_id, ROOT, head_sha_override=args.head_sha)
    return rc


if __name__ == "__main__":
    sys.exit(main())
