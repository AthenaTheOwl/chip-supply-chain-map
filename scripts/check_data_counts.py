#!/usr/bin/env python3
"""Validate chip-map data counts across CSVs, snapshot, and README."""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
README = ROOT / "README.md"
SNAPSHOT = DATA / "snapshot.json"


def csv_row_count(path: Path) -> int:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return sum(1 for _ in csv.DictReader(handle))


def source_count(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    return len(re.findall(r"^- \*\*s\d+\*\* - ", text, flags=re.MULTILINE))


def main() -> int:
    counts = {
        "node_count": csv_row_count(DATA / "nodes.csv"),
        "edge_count": csv_row_count(DATA / "edges.csv"),
        "source_count": source_count(DATA / "sources.md"),
    }
    snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    readme = README.read_text(encoding="utf-8")

    findings: list[str] = []
    for key, actual in counts.items():
        recorded = snapshot.get(key)
        if recorded != actual:
            findings.append(f"snapshot {key}={recorded!r}; actual={actual}")

    readme_expectations = {
        "node_count": rf"{counts['node_count']} nodes",
        "edge_count": rf"{counts['edge_count']} edges",
        "source_count": rf"{counts['source_count']} source",
    }
    for key, pattern in readme_expectations.items():
        if not re.search(pattern, readme, flags=re.IGNORECASE):
            findings.append(f"README does not mention derived {key}: {pattern}")

    if findings:
        print("check_data_counts: drift detected", file=sys.stderr)
        for finding in findings:
            print(f"  - {finding}", file=sys.stderr)
        return 1

    print(
        "check_data_counts OK "
        f"({counts['node_count']} nodes, {counts['edge_count']} edges, "
        f"{counts['source_count']} sources)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
