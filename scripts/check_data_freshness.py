"""Assert the chip-map CSV data is fresher than the 180-day threshold.

The cron workflow .github/workflows/stale-data.yml opens a GitHub
issue when the threshold trips. This script is the in-CI variant:
it inspects `git log -1 --format=%ct` on `src/data/nodes.csv` and
`src/data/edges.csv` and exits 1 if either commit timestamp is
older than the threshold.

The threshold value matches DEC-MAP-005 (180 days). Override via the
CHIP_SUPPLY_MAP_FRESHNESS_DAYS env var if a future spec relaxes or
tightens the rule.

Exit codes: 0 OK or no commit history found, 1 at least one CSV
older than the threshold.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATHS = (
    "src/data/nodes.csv",
    "src/data/edges.csv",
    "src/data/nodes_history.csv",
    "src/data/financial_sensitivity.csv",
)
DEFAULT_THRESHOLD_DAYS = 180
SECONDS_PER_DAY = 86400


def last_commit_timestamp(rel_path: str) -> int | None:
    """Return the Unix timestamp of the last commit touching rel_path."""
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%ct", "--", rel_path],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        print(
            "check_data_freshness: git not on PATH; skipping freshness check",
            file=sys.stderr,
        )
        return None
    if result.returncode != 0:
        print(
            f"check_data_freshness: git log failed for {rel_path} "
            f"(exit {result.returncode}); skipping",
            file=sys.stderr,
        )
        return None
    out = result.stdout.strip()
    if not out:
        return None
    try:
        return int(out.splitlines()[0])
    except ValueError:
        return None


def main() -> int:
    threshold_days = int(
        os.environ.get("CHIP_SUPPLY_MAP_FRESHNESS_DAYS", DEFAULT_THRESHOLD_DAYS)
    )
    threshold_seconds = threshold_days * SECONDS_PER_DAY
    now = int(time.time())

    findings: list[str] = []
    checked = 0
    for rel in PATHS:
        full = ROOT / rel
        if not full.is_file():
            print(f"check_data_freshness: {rel} not found; skipping", file=sys.stderr)
            continue
        ts = last_commit_timestamp(rel)
        if ts is None:
            continue
        checked += 1
        age_days = (now - ts) // SECONDS_PER_DAY
        if (now - ts) > threshold_seconds:
            findings.append(
                f"{rel}: last commit {age_days}d ago (threshold {threshold_days}d)"
            )
        else:
            print(
                f"check_data_freshness: {rel} OK ({age_days}d / {threshold_days}d)"
            )

    if findings:
        print("check_data_freshness: stale data detected", file=sys.stderr)
        for finding in findings:
            print(f"  - {finding}", file=sys.stderr)
        return 1

    print(f"check_data_freshness OK ({checked} file(s) checked)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
