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

# Doc surfaces that describe the dataset in prose (as opposed to the
# machine-checked README/snapshot above). A stale "N nodes and M edges"
# claim has crept into these before (see DECISIONS.md, .agents/AGENTS.md,
# docs/scoring-history.md history) so they get the same drift guard. A
# doc may keep an old count as a historical decision record as long as it
# also carries an explicit "now <node_count> nodes / <edge_count> edges"
# correction naming the current counts.
DOC_SURFACES = {
    "DECISIONS.md": ROOT / "DECISIONS.md",
    ".agents/AGENTS.md": ROOT / ".agents" / "AGENTS.md",
    "docs/scoring-history.md": ROOT / "docs" / "scoring-history.md",
}

# Matches "<N> nodes ... <M> edges" mentioned close together (same clause
# or sentence), which is the shape every historical drift incident has
# taken. Numbers that appear far apart, or "nodes"/"edges" mentioned
# without a paired count nearby (e.g. scoring-history.md's node-only
# discussion of `nodes_history.csv` coverage), are left alone.
NODE_EDGE_PAIR_RE = re.compile(r"(\d+)\s+nodes\b.{0,80}?(\d+)\s+edges\b", re.IGNORECASE | re.DOTALL)


def csv_row_count(path: Path) -> int:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return sum(1 for _ in csv.DictReader(handle))


def doc_drift_findings(label: str, path: Path, node_count: int, edge_count: int) -> list[str]:
    text = path.read_text(encoding="utf-8")
    corrective = re.search(
        rf"now\s+{node_count}\s+nodes\s*/\s*{edge_count}\s+edges",
        text,
        flags=re.IGNORECASE,
    )

    problems: list[str] = []
    for match in NODE_EDGE_PAIR_RE.finditer(text):
        found = (int(match.group(1)), int(match.group(2)))
        if found == (node_count, edge_count):
            continue
        if corrective:
            continue
        problems.append(
            f"{label} mentions {found[0]} nodes / {found[1]} edges "
            f"(actual: {node_count} nodes / {edge_count} edges) with no "
            f"'now {node_count} nodes / {edge_count} edges' correction nearby"
        )
    return problems


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

    for label, path in DOC_SURFACES.items():
        findings.extend(
            doc_drift_findings(label, path, counts["node_count"], counts["edge_count"])
        )

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
