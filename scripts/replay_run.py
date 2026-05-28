"""Deterministically replay a watchlist-export Run record.

The watchlist-export pipeline in chip-supply-chain-map is a pure
function of four input files (``nodes.csv``, ``edges.csv``,
``sources.md``, ``financial_sensitivity.csv``) plus the scoring
heuristic config: same inputs plus same code equals byte-identical
output. Run records emitted by ``scripts/export_watchlist/main.ts``
fingerprint the inputs (``tool_schemas_snapshot_hash``), the
heuristic (``prompt_snapshot_hash``), and the producing commit
(``sandbox_image_ref``). This script makes the "third party can
verify" claim executable: it loads a recorded Run record, re-runs
the pipeline against the current working tree, and asserts the
fresh output matches the committed packet byte-for-byte.

CLI:

    python scripts/replay_run.py --run-id run-<id>

Behavior, in order:

1. Load ``ops/run-records/<run-id>.json``. Fail clearly if missing.
2. Load ``ops/event-ledger/<run-id>.jsonl`` to confirm the run is in
   the ledger and to anchor the replay event's lineage.
3. Parse the trailing ``@<sha>`` SHA from
   ``Run.sandbox_image_ref``.
4. Run ``git rev-parse HEAD`` in the repo. HEAD-strict: if HEAD SHA
   does not equal the recorded SHA, exit 1 with a message naming
   the SHA the reviewer needs to check out. The script never auto-
   checks-out for the reviewer.
5. Recompute the input fingerprints
   (``prompt_snapshot_hash`` + ``tool_schemas_snapshot_hash``) by
   hashing the current input files with the same canonicalization
   the TypeScript emitter uses. Both hashes MUST equal the values
   recorded on the Run record; mismatch means the working-tree
   inputs drifted since the run.
6. Shell out to ``node scripts/export_watchlist.mjs`` with
   ``--no-emit-evidence`` and ``--output=<tmp>`` so the replay
   produces the packet without touching ``ops/`` or the committed
   packet.
7. Hash the produced packet (SHA-256 of its bytes) and compare to
   the SHA-256 of the committed packet at
   ``ops/exports/chip-watchlist-risk-packet.json`` (the known-good
   output saved at the time of the recorded run). Equal hashes
   mean replay_equivalent is true.
8. Emit a ``run.evidence.replayed`` event to a fresh per-replay
   ledger at
   ``ops/event-ledger/replay-<run-id>-<ISO-timestamp>.jsonl``.
9. Write a replay report at
   ``ops/replay-records/<run-id>/<replay-event-id>.json``.
10. Print a summary line; exit 0 iff replay_equivalent.

The script is offline-first: no network, no external binaries
beyond ``git`` and ``node`` which the export already requires.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
RUN_RECORDS_DIR = ROOT / "ops" / "run-records"
EVENT_LEDGER_DIR = ROOT / "ops" / "event-ledger"
REPLAY_RECORDS_DIR = ROOT / "ops" / "replay-records"
COMMITTED_PACKET = ROOT / "ops" / "exports" / "chip-watchlist-risk-packet.json"

# Canonical input files for the watchlist export. Mirrors the
# ``canonicalInputs`` array in scripts/export_watchlist/main.ts.
CANONICAL_INPUTS = (
    "src/data/edges.csv",
    "src/data/financial_sensitivity.csv",
    "src/data/nodes.csv",
    "src/data/sources.md",
)

# Heuristic-config fingerprint. Mirrors the ``heuristicConfig()``
# function in ``scripts/export_watchlist/main.ts``: ``score_basis``,
# ``strength_weight`` (from ``src/lib/scoring.ts``), ``packet_version``,
# and ``runtime``. Keys are sorted at every nesting level because
# ``canonicalizeHeuristicConfig`` sorts them; the JSON form must match
# Node's ``JSON.stringify`` of the sorted object byte-for-byte.
HEURISTIC_CONFIG = {
    "packet_version": 1,
    "runtime": "chip-supply-chain-map-export",
    "score_basis": "chokepoint-score-v1",
    "strength_weight": {"critical": 4, "high": 3, "low": 1, "medium": 2},
}


# ----------------------------------------------------------------- helpers


def _safe_rel(path: Path) -> str:
    """Return ``path`` relative to ROOT when possible, else absolute."""
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def _now_iso() -> str:
    """RFC 3339 timestamp in UTC with second precision."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _new_event_id() -> str:
    return str(uuid.uuid4())


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _canonicalize_inputs(inputs: list[dict[str, str]]) -> str:
    """Mirror canonicalizeInputs() from src/lib/runEvidence.ts.

    Each entry serializes as ``{"path", "content"}``; the array is
    sorted by ``path`` so the canonical form is insensitive to
    declaration order.
    """
    # Node's JSON.stringify with no indent and no key sort still
    # preserves key insertion order on objects. We construct the
    # objects with path first then content to match the TS emitter.
    parts: list[str] = []
    for entry in sorted(inputs, key=lambda e: e["path"]):
        # Match JSON.stringify output exactly: keys in insertion order
        # (path, content), default separators (no spaces), unicode
        # escaping only for control chars.
        parts.append(json.dumps(
            {"path": entry["path"], "content": entry["content"]},
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=False,
        ))
    return "[" + ",".join(parts) + "]"


def _canonicalize_heuristic_config(config: dict[str, Any]) -> str:
    """Mirror canonicalizeHeuristicConfig() from src/lib/runEvidence.ts.

    Keys sorted at every nesting level.
    """
    return json.dumps(config, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _parse_sandbox_sha(sandbox_image_ref: str) -> str:
    """Return the SHA after ``@`` in ``<repo-path>@<sha>``."""
    idx = sandbox_image_ref.rfind("@")
    if idx < 0:
        raise SystemExit(
            f"replay_run: sandbox_image_ref {sandbox_image_ref!r} has no @<sha> suffix"
        )
    sha = sandbox_image_ref[idx + 1 :]
    if not sha:
        raise SystemExit(
            f"replay_run: sandbox_image_ref {sandbox_image_ref!r} has empty SHA"
        )
    return sha


def _git_head_sha(repo_root: Path) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo_root), "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(
            f"replay_run: git rev-parse HEAD failed: {result.stderr.strip()}"
        )
    return result.stdout.strip()


# ----------------------------------------------------------------- core


def load_run_record(run_id: str, repo_root: Path) -> dict[str, Any]:
    record_path = repo_root / "ops" / "run-records" / f"{run_id}.json"
    if not record_path.is_file():
        raise SystemExit(
            f"replay_run: Run record not found at {_safe_rel(record_path)}"
        )
    return json.loads(record_path.read_text(encoding="utf-8"))


def load_event_ledger(run_id: str, repo_root: Path) -> list[dict[str, Any]]:
    ledger_path = repo_root / "ops" / "event-ledger" / f"{run_id}.jsonl"
    if not ledger_path.is_file():
        raise SystemExit(
            f"replay_run: event ledger not found at {_safe_rel(ledger_path)}"
        )
    events: list[dict[str, Any]] = []
    for line in ledger_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        events.append(json.loads(line))
    return events


def verify_head(run: dict[str, Any], repo_root: Path) -> str:
    """HEAD-strict check. Returns the recorded SHA on success.

    Exits 1 with the canonical checkout message on mismatch.
    """
    sandbox_image_ref = run.get("sandbox_image_ref")
    if not isinstance(sandbox_image_ref, str) or not sandbox_image_ref:
        raise SystemExit(
            f"replay_run: Run record {run.get('id')!r} has no sandbox_image_ref; "
            f"cannot verify HEAD"
        )
    recorded_sha = _parse_sandbox_sha(sandbox_image_ref)
    current_sha = _git_head_sha(repo_root)
    if current_sha != recorded_sha:
        print(
            f"replay requires checkout of {recorded_sha}; "
            f"current HEAD is {current_sha}. "
            f"Run: git checkout {recorded_sha}",
            file=sys.stderr,
        )
        sys.exit(1)
    return recorded_sha


def verify_inputs(run: dict[str, Any], repo_root: Path) -> tuple[str, str]:
    """Re-hash the current input files and compare to the Run record.

    Returns ``(prompt_hash, tool_schemas_hash)`` on success. Raises
    SystemExit on mismatch.
    """
    inputs: list[dict[str, str]] = []
    for rel in CANONICAL_INPUTS:
        path = repo_root / rel
        if not path.is_file():
            raise SystemExit(f"replay_run: input file missing: {rel}")
        # Mirror Node's readFileSync(path, "utf8"): no BOM strip, native
        # line endings preserved as-is. The repo enforces LF on these
        # files via .gitattributes so the canonical form is stable.
        inputs.append({"path": rel, "content": path.read_text(encoding="utf-8")})

    tool_schemas_hash = _sha256_text(_canonicalize_inputs(inputs))
    prompt_hash = _sha256_text(_canonicalize_heuristic_config(HEURISTIC_CONFIG))

    recorded_prompt = run.get("prompt_snapshot_hash")
    recorded_tools = run.get("tool_schemas_snapshot_hash")

    mismatches: list[str] = []
    if prompt_hash != recorded_prompt:
        mismatches.append(
            f"prompt_snapshot_hash mismatch: recomputed={prompt_hash!r} "
            f"recorded={recorded_prompt!r}"
        )
    if tool_schemas_hash != recorded_tools:
        mismatches.append(
            f"tool_schemas_snapshot_hash mismatch: recomputed={tool_schemas_hash!r} "
            f"recorded={recorded_tools!r}"
        )
    if mismatches:
        for line in mismatches:
            print(f"replay_run: {line}", file=sys.stderr)
        # Returning the mismatch shape is handled by the caller, which
        # writes the replay record with replay_equivalent=false.
        raise InputHashMismatch(mismatches, prompt_hash, tool_schemas_hash)

    return prompt_hash, tool_schemas_hash


class InputHashMismatch(Exception):
    """Raised when re-hashed inputs do not match the Run record."""

    def __init__(
        self, mismatches: list[str], prompt_hash: str, tool_schemas_hash: str
    ) -> None:
        super().__init__("; ".join(mismatches))
        self.mismatches = mismatches
        self.recomputed_prompt_hash = prompt_hash
        self.recomputed_tool_schemas_hash = tool_schemas_hash


def run_export(repo_root: Path, output_path: Path) -> tuple[int, str, str]:
    """Shell out to ``node scripts/export_watchlist.mjs``.

    Uses ``--no-emit-evidence`` and a temp ``--output`` so the replay
    does not touch ``ops/`` or the committed packet. Returns
    ``(return_code, stdout, stderr)``.
    """
    node = shutil.which("node")
    if node is None:
        raise SystemExit(
            "replay_run: node executable not found on PATH; cannot replay"
        )
    cmd = [
        node,
        str(repo_root / "scripts" / "export_watchlist.mjs"),
        "--no-emit-evidence",
        f"--output={output_path}",
    ]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=str(repo_root),
        check=False,
    )
    return result.returncode, result.stdout, result.stderr


def compare_outputs(
    replayed_path: Path, committed_path: Path
) -> tuple[bool, str, str]:
    """Hash both files and return ``(equal, replayed_hash, committed_hash)``."""
    if not replayed_path.is_file():
        raise SystemExit(
            f"replay_run: replayed packet missing at {replayed_path}"
        )
    if not committed_path.is_file():
        raise SystemExit(
            f"replay_run: committed packet missing at {_safe_rel(committed_path)}"
        )
    replayed_bytes = replayed_path.read_bytes()
    committed_bytes = committed_path.read_bytes()
    replayed_hash = _sha256_bytes(replayed_bytes)
    committed_hash = _sha256_bytes(committed_bytes)
    return replayed_hash == committed_hash, replayed_hash, committed_hash


def emit_replay_event(
    run_id: str,
    replay_event_id: str,
    replay_equivalent: bool,
    replay_method: str,
    packet_ref: str,
    timestamp: str,
    ledger_dir: Path,
) -> Path:
    """Write a single ``run.evidence.replayed`` event to a fresh ledger.

    The per-replay ledger is named
    ``replay-<run-id>-<ISO-timestamp>.jsonl`` so multiple replays do
    not collide. The source ledger is never touched.
    """
    ledger_dir.mkdir(parents=True, exist_ok=True)
    safe_ts = timestamp.replace(":", "").replace("-", "")
    ledger_path = ledger_dir / f"replay-{run_id}-{safe_ts}.jsonl"
    event = {
        "actor": {"id": "chip-supply-chain-map-replay", "kind": "system"},
        "created_at": timestamp,
        "event_id": replay_event_id,
        "payload": {
            "packet_ref": packet_ref,
            "replay_equivalent": replay_equivalent,
            "replay_method": replay_method,
            "run_id": run_id,
        },
        "run_id": run_id,
        "spec_id": "specs/0002-earnings-sensitivity-overlay/",
        "type": "run.evidence.replayed",
    }
    line = json.dumps(event, sort_keys=True, ensure_ascii=False) + "\n"
    ledger_path.write_text(line, encoding="utf-8")
    return ledger_path


def write_replay_record(
    run_id: str,
    replay_event_id: str,
    report: dict[str, Any],
    records_dir: Path,
) -> Path:
    """Write the replay report JSON next to the ledger entry."""
    out_dir = records_dir / run_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{replay_event_id}.json"
    out_path.write_text(
        json.dumps(report, sort_keys=True, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return out_path


# ----------------------------------------------------------------- main


def replay(
    run_id: str,
    repo_root: Path,
    *,
    ledger_dir: Path | None = None,
    records_dir: Path | None = None,
    committed_packet: Path | None = None,
) -> int:
    """Run the full replay flow. Returns the process exit code."""
    ledger_dir = ledger_dir or (repo_root / "ops" / "event-ledger")
    records_dir = records_dir or (repo_root / "ops" / "replay-records")
    committed_packet = committed_packet or (
        repo_root / "ops" / "exports" / "chip-watchlist-risk-packet.json"
    )

    run = load_run_record(run_id, repo_root)
    events = load_event_ledger(run_id, repo_root)
    recorded_sha = verify_head(run, repo_root)

    timestamp = _now_iso()
    replay_event_id = _new_event_id()

    # Step 5: verify inputs match. On mismatch we still emit a
    # replay record so the audit trail captures the divergence.
    input_mismatches: list[str] = []
    recomputed_prompt = None
    recomputed_tools = None
    try:
        recomputed_prompt, recomputed_tools = verify_inputs(run, repo_root)
    except InputHashMismatch as exc:
        input_mismatches = exc.mismatches
        recomputed_prompt = exc.recomputed_prompt_hash
        recomputed_tools = exc.recomputed_tool_schemas_hash

    if input_mismatches:
        # Skip the actual re-export; the inputs already diverged, so
        # any output hash comparison is downstream noise. The replay
        # event still carries ``packet_ref`` pointing at the committed
        # packet so the schema-required field stays populated.
        mismatch_packet_ref = _safe_rel(committed_packet)
        report = {
            "comparison": {
                "input_mismatches": input_mismatches,
                "recomputed_prompt_snapshot_hash": recomputed_prompt,
                "recomputed_tool_schemas_snapshot_hash": recomputed_tools,
                "recorded_prompt_snapshot_hash": run.get("prompt_snapshot_hash"),
                "recorded_tool_schemas_snapshot_hash": run.get(
                    "tool_schemas_snapshot_hash"
                ),
            },
            "packet_ref": mismatch_packet_ref,
            "recorded_sandbox_sha": recorded_sha,
            "replay_equivalent": False,
            "replay_event_id": replay_event_id,
            "replay_method": "deterministic",
            "run_id": run_id,
            "timestamp": timestamp,
            "verdict": "input_hash_mismatch",
        }
        ledger_path = emit_replay_event(
            run_id,
            replay_event_id,
            False,
            "deterministic",
            mismatch_packet_ref,
            timestamp,
            ledger_dir,
        )
        report["replay_ledger_ref"] = _safe_rel(ledger_path)
        record_path = write_replay_record(
            run_id, replay_event_id, report, records_dir
        )
        print(
            f"replay FAILED (input_hash_mismatch): run={run_id} "
            f"record={_safe_rel(record_path)} ledger={_safe_rel(ledger_path)}",
            file=sys.stderr,
        )
        return 1

    # Step 6: run export to a temp file.
    with tempfile.TemporaryDirectory(prefix="replay_") as tmpdir:
        replayed_path = Path(tmpdir) / "replayed-watchlist-packet.json"
        rc, stdout, stderr = run_export(repo_root, replayed_path)
        if rc != 0:
            print(
                f"replay_run: export sub-process failed (rc={rc})\n"
                f"stdout:\n{stdout}\nstderr:\n{stderr}",
                file=sys.stderr,
            )
            fallback_packet_ref = _safe_rel(committed_packet)
            report = {
                "comparison": {"export_stderr": stderr, "export_stdout": stdout},
                "packet_ref": fallback_packet_ref,
                "recorded_sandbox_sha": recorded_sha,
                "replay_equivalent": False,
                "replay_event_id": replay_event_id,
                "replay_method": "deterministic",
                "run_id": run_id,
                "timestamp": timestamp,
                "verdict": "export_failed",
            }
            ledger_path = emit_replay_event(
                run_id,
                replay_event_id,
                False,
                "deterministic",
                fallback_packet_ref,
                timestamp,
                ledger_dir,
            )
            report["replay_ledger_ref"] = _safe_rel(ledger_path)
            write_replay_record(run_id, replay_event_id, report, records_dir)
            return 1

        equal, replayed_hash, committed_hash = compare_outputs(
            replayed_path, committed_packet
        )

    # Step 8: determine verdict.
    replay_equivalent = bool(equal)
    verdict = "byte_equal" if equal else "byte_diff"

    # Locate the packet ref this replay is verifying against. Prefer
    # the sibling trace-to-eval packet if it exists (so the event
    # points at the consumer-side artifact that mirrors this run);
    # otherwise fall back to the committed producer-side packet so
    # ``packet_ref`` is always populated. The event schema requires a
    # non-empty string here.
    sibling_packet = (
        repo_root.parent
        / "trace-to-eval-harness"
        / "examples"
        / "run_evidence"
        / f"{run_id}.packet.json"
    )
    if sibling_packet.is_file():
        packet_ref = (
            "../trace-to-eval-harness/examples/run_evidence/"
            f"{run_id}.packet.json"
        )
    else:
        packet_ref = _safe_rel(committed_packet)

    # Step 9: emit replay event + report.
    ledger_path = emit_replay_event(
        run_id,
        replay_event_id,
        replay_equivalent,
        "deterministic",
        packet_ref,
        timestamp,
        ledger_dir,
    )
    report = {
        "comparison": {
            "committed_packet_hash": committed_hash,
            "committed_packet_ref": _safe_rel(committed_packet),
            "recomputed_prompt_snapshot_hash": recomputed_prompt,
            "recomputed_tool_schemas_snapshot_hash": recomputed_tools,
            "recorded_prompt_snapshot_hash": run.get("prompt_snapshot_hash"),
            "recorded_tool_schemas_snapshot_hash": run.get(
                "tool_schemas_snapshot_hash"
            ),
            "replayed_packet_hash": replayed_hash,
        },
        "event_ledger_event_count": len(events),
        "packet_ref": packet_ref,
        "recorded_sandbox_sha": recorded_sha,
        "replay_equivalent": replay_equivalent,
        "replay_event_id": replay_event_id,
        "replay_ledger_ref": _safe_rel(ledger_path),
        "replay_method": "deterministic",
        "run_id": run_id,
        "timestamp": timestamp,
        "verdict": verdict,
    }
    record_path = write_replay_record(
        run_id, replay_event_id, report, records_dir
    )

    # Step 10: summary.
    status = "OK" if replay_equivalent else "FAILED"
    print(
        f"replay {status}: run={run_id} "
        f"replay_equivalent={replay_equivalent} "
        f"replay_method=deterministic "
        f"record={_safe_rel(record_path)} "
        f"ledger={_safe_rel(ledger_path)}"
    )
    return 0 if replay_equivalent else 1


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="replay_run.py",
        description=(
            "Deterministically replay a watchlist-export Run record and "
            "verify byte-equivalence against the committed packet."
        ),
    )
    parser.add_argument(
        "--run-id",
        required=True,
        help="Run identifier (e.g. run-6a665b303138).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    return replay(args.run_id, ROOT)


if __name__ == "__main__":
    sys.exit(main())
