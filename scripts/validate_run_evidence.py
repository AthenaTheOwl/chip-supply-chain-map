"""Validate run-evidence artifacts emitted by the watchlist export pipeline.

Walks two directories and validates each record against the cross-repo
schemas mirrored in ``ops/schemas-cache/``:

- ``ops/event-ledger/<run-id>.jsonl`` - append-only event ledger files;
  each line must be a JSON object conforming to ``event.schema.json``.
- ``ops/run-records/<run-id>.json`` - final Run records; each file
  must conform to the amended ``run.schema.json`` carrying the six
  replay-equivalence fields.

A Run in this repo is one execution of the deterministic watchlist
export pipeline (no LLM in the loop). The Run record makes the
"same inputs plus same code equals same output" claim auditable: a
reviewer reads ``prompt_snapshot_hash`` (the scoring heuristic
fingerprint), ``tool_schemas_snapshot_hash`` (the input-data
fingerprint), and ``sandbox_image_ref`` (the producing commit), and
can re-run the pipeline to verify byte equality.

Cross-checks enforced when ``Run.status == "done"``:

1. Run-level required fields: ``prompt_snapshot_hash``,
   ``tool_schemas_snapshot_hash``, ``sandbox_image_ref``, and
   ``gate_results_summary`` must all be populated.
2. Terminal event presence: at least one ledger event must have
   ``type == "gate.run.evidence_recorded"``.
3. Hash agreement: ``Run.prompt_snapshot_hash`` and
   ``Run.tool_schemas_snapshot_hash`` match the values on the
   ``pipeline.start`` event for the same run_id.
4. Field-population agreement:
   ``<gate.run.evidence_recorded>.payload.fields_populated`` (sorted)
   equals the sorted set of replay-equivalence fields actually
   populated on the Run record.
5. Gate-results agreement: ``Run.gate_results_summary`` matches the
   scan of ``gate.check.passed`` / ``gate.check.failed`` events:
   ``gates_passed`` and ``gates_failed`` are sorted lists of
   ``payload.gate_name`` from passed/failed events; ``all_passed``
   is true iff ``gates_failed`` is empty.

A separate (already shipped) cross-check enforces that every
``run_id`` referenced by a terminal event has a matching Run record
file.

Exit codes: ``0`` OK, ``1`` violations found. Violation detail is
written to stderr in the same shape as ``scripts/validate_decisions.py``.

This validator follows the offline-first pattern used by the other
``validate_*.py`` scripts: it loads the cached schema, never talks to
the network, and treats a missing schema cache file as a hard error.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / "ops" / "schemas-cache"
EVENT_LEDGER_DIR = ROOT / "ops" / "event-ledger"
RUN_RECORDS_DIR = ROOT / "ops" / "run-records"

# Portable repo:// / artifact:// URI grammar lands in DEC-CDCP-014
# (athena-site). Round 6 migrates emitters in the portfolio onto this
# scheme. The resolver here accepts both URI forms AND legacy local
# paths during the migration window (interop clause from DEC-CDCP-014).
#
#   repo://<repo-name>@<sha>/<rel-path>
#   artifact://<repo-name>/<artifact-id>
#
# <sha> for an emitted (finalized) URI is 40 lowercase-hex. The
# PENDING placeholder shape recorded at first emit (before the
# regenerate commit lands) is permitted too; the
# finalize_sandbox_ref.py helper rewrites PENDING to the resolved SHA.
_REPO_URI_RE = re.compile(
    r"^repo://(?P<repo>[a-z][a-z0-9-]*)@(?P<sha>[a-f0-9]{40}|PENDING)/(?P<path>.*)$"
)
_ARTIFACT_URI_RE = re.compile(
    r"^artifact://(?P<repo>[a-z][a-z0-9-]*)/(?P<id>.+)$"
)

PORTFOLIO_ROOT_DEFAULT = Path("e:/claude_code/random-apps")


def resolve_uri(uri: str, portfolio_root: Path | None = None) -> Path | None:
    """Resolve a repo:// URI to a local path inside the portfolio.

    Behavior:

    - ``repo://<repo>@<sha>/<rel-path>`` returns
      ``<portfolio_root>/<repo>/<rel-path>``. The ``<sha>`` segment
      is advisory metadata; HEAD-strict verification is the replay
      command's job, not the validator's.
    - ``artifact://<repo>/<id>`` returns ``None`` because logical
      artifact ids are not file paths. The caller decides whether
      this is a violation or expected.
    - Anything else (legacy local path) returns ``Path(uri)`` so the
      validator continues to accept pre-migration records during the
      Round-6 cutover window. DEC-CDCP-014's interop clause.

    The default ``portfolio_root`` matches the workflow's
    ``e:/claude_code/random-apps`` layout. Tests pass a temp tree.
    """
    root = portfolio_root if portfolio_root is not None else PORTFOLIO_ROOT_DEFAULT
    repo_match = _REPO_URI_RE.match(uri)
    if repo_match:
        return root / repo_match["repo"] / repo_match["path"]
    artifact_match = _ARTIFACT_URI_RE.match(uri)
    if artifact_match:
        return None
    return Path(uri)

EVENT_SCHEMA_PATH = CACHE_DIR / "event.schema.json"
RUN_SCHEMA_PATH = CACHE_DIR / "run.schema.json"

# Terminal event types: presence in a ledger means the run is no
# longer in-progress. A missing Run record alongside any of these
# types is a violation.
TERMINAL_EVENT_TYPES = frozenset(
    {"gate.run.evidence_recorded", "pipeline.done"}
)

# The six replay-equivalence fields tracked on a Run record. Listed
# in the same order as the event-schema enum so a fields_populated
# diff reads in the same order across emitter and validator.
REPLAY_EQUIVALENCE_FIELDS = (
    "prompt_snapshot_hash",
    "tool_schemas_snapshot_hash",
    "determinism",
    "checkpoint_ref",
    "sandbox_image_ref",
    "gate_results_summary",
)

# Fields a done Run record MUST populate. ``determinism`` and
# ``checkpoint_ref`` are intentionally omitted: this repo runs a pure
# data pipeline with no sampler and no resumable checkpoint store.
# Field-population rules live in src/lib/runEvidence.ts.
DONE_REQUIRED_FIELDS = (
    "prompt_snapshot_hash",
    "tool_schemas_snapshot_hash",
    "sandbox_image_ref",
    "gate_results_summary",
)


def _load_schema(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise SystemExit(
            f"validate_run_evidence: cached schema missing at "
            f"{path.relative_to(ROOT).as_posix()}. Re-cache from athena-site."
        )
    return json.loads(path.read_text(encoding="utf-8"))


def _validator_for(schema: dict[str, Any]) -> Any:
    try:
        import jsonschema  # type: ignore[import-untyped]
    except ImportError as exc:
        raise SystemExit(
            "validate_run_evidence: jsonschema is required. "
            "Install with `pip install jsonschema>=4.21`."
        ) from exc
    validator_cls = jsonschema.validators.validator_for(schema)
    validator_cls.check_schema(schema)
    return validator_cls(schema)


def _format_errors(prefix: str, errors: list[Any]) -> list[str]:
    formatted: list[str] = []
    for err in errors:
        location = "/".join(str(part) for part in err.path) or "<root>"
        formatted.append(f"{prefix}: {location}: {err.message}")
    return formatted


def _safe_rel(path: Path) -> str:
    """Return ``path`` relative to ROOT when possible, else the absolute form."""
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def _is_populated(value: Any) -> bool:
    """Return True when ``value`` counts as populated for required-field checks.

    None counts as missing. Empty strings, empty dicts, and empty lists
    count as missing. Numbers (including 0) and booleans count as
    populated.
    """
    if value is None:
        return False
    if isinstance(value, (str, list, dict)) and len(value) == 0:
        return False
    return True


def validate_event_ledger(
    validator: Any,
) -> tuple[list[str], dict[str, list[dict[str, Any]]], set[str]]:
    """Walk every JSONL ledger file and validate every line.

    Returns ``(violations, run_to_events, run_ids_seen)``:
    ``run_to_events`` maps each referenced run_id to the list of
    parsed event objects (preserving order); ``run_ids_seen`` is the
    union of all run_ids found in any event record.
    """
    violations: list[str] = []
    run_to_events: dict[str, list[dict[str, Any]]] = {}
    run_ids: set[str] = set()
    if not EVENT_LEDGER_DIR.is_dir():
        return violations, run_to_events, run_ids
    for ledger in sorted(EVENT_LEDGER_DIR.glob("*.jsonl")):
        rel = _safe_rel(ledger)
        text = ledger.read_text(encoding="utf-8")
        for line_no, raw in enumerate(text.splitlines(), start=1):
            stripped = raw.strip()
            if not stripped:
                continue
            try:
                event = json.loads(stripped)
            except json.JSONDecodeError as exc:
                violations.append(f"{rel}:{line_no}: invalid JSON: {exc}")
                continue
            if not isinstance(event, dict):
                violations.append(
                    f"{rel}:{line_no}: top-level value must be a JSON object"
                )
                continue
            errs = sorted(
                validator.iter_errors(event), key=lambda e: e.path
            )
            violations.extend(_format_errors(f"{rel}:{line_no}", errs))
            run_id = event.get("run_id")
            if isinstance(run_id, str) and run_id:
                run_ids.add(run_id)
                run_to_events.setdefault(run_id, []).append(event)
    return violations, run_to_events, run_ids


def validate_run_records(
    validator: Any,
) -> tuple[list[str], set[str], dict[str, dict[str, Any]]]:
    """Walk every Run record file and validate the JSON body.

    Returns ``(violations, run_ids_recorded, runs_by_id)``.
    """
    violations: list[str] = []
    recorded: set[str] = set()
    runs_by_id: dict[str, dict[str, Any]] = {}
    if not RUN_RECORDS_DIR.is_dir():
        return violations, recorded, runs_by_id
    for record in sorted(RUN_RECORDS_DIR.glob("*.json")):
        rel = _safe_rel(record)
        try:
            run = json.loads(record.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            violations.append(f"{rel}: invalid JSON: {exc}")
            continue
        if not isinstance(run, dict):
            violations.append(f"{rel}: top-level value must be a JSON object")
            continue
        errs = sorted(validator.iter_errors(run), key=lambda e: e.path)
        violations.extend(_format_errors(rel, errs))
        run_id = run.get("id")
        if isinstance(run_id, str) and run_id:
            recorded.add(run_id)
            runs_by_id[run_id] = run
    return violations, recorded, runs_by_id


def _populated_fields_on_run(run: dict[str, Any]) -> list[str]:
    """Return the subset of REPLAY_EQUIVALENCE_FIELDS populated on ``run``."""
    return [field for field in REPLAY_EQUIVALENCE_FIELDS if _is_populated(run.get(field))]


def cross_check(
    run_to_events: dict[str, list[dict[str, Any]]],
    run_ids_in_events: set[str],
    run_ids_recorded: set[str],
    runs_by_id: dict[str, dict[str, Any]],
) -> list[str]:
    """Cross-check terminal events against Run records and enforce
    Round-3 done-Run invariants (required fields + hash agreement +
    fields_populated agreement + gate_results_summary agreement).
    """
    violations: list[str] = []

    # Cross-check 0 (pre-existing): any terminal-event ledger needs a
    # matching Run record.
    for run_id in sorted(run_ids_in_events):
        events = run_to_events.get(run_id, [])
        types = {str(event.get("type", "")) for event in events}
        has_terminal = bool(types & TERMINAL_EVENT_TYPES)
        if has_terminal and run_id not in run_ids_recorded:
            violations.append(
                f"run_id {run_id!r}: ledger carries terminal event "
                f"({sorted(types & TERMINAL_EVENT_TYPES)}) but no matching "
                f"ops/run-records/{run_id}.json"
            )

    # Round-3 done-Run cross-checks.
    for run_id in sorted(run_ids_recorded):
        run = runs_by_id[run_id]
        if run.get("status") != "done":
            continue
        events = run_to_events.get(run_id, [])

        # Cross-check 1: required-for-done fields populated.
        for field in DONE_REQUIRED_FIELDS:
            if not _is_populated(run.get(field)):
                violations.append(
                    f"run_id {run_id!r}: done Run record missing required field "
                    f"{field!r}"
                )

        # Cross-check 2: at least one gate.run.evidence_recorded event.
        evidence_events = [
            event for event in events
            if event.get("type") == "gate.run.evidence_recorded"
        ]
        if not evidence_events:
            violations.append(
                f"run_id {run_id!r}: done Run record has no "
                f"gate.run.evidence_recorded event in the ledger"
            )

        # Cross-check 3: pipeline.start hashes match the Run record.
        start_events = [
            event for event in events
            if event.get("type") == "pipeline.start"
        ]
        if start_events:
            # Take the first pipeline.start; ledgers should carry exactly
            # one but we accept duplicates and only check the first.
            start_payload = start_events[0].get("payload") or {}
            for field in ("prompt_snapshot_hash", "tool_schemas_snapshot_hash"):
                start_value = start_payload.get(field)
                run_value = run.get(field)
                if start_value is not None and run_value is not None:
                    if start_value != run_value:
                        violations.append(
                            f"run_id {run_id!r}: pipeline.start.{field} "
                            f"({start_value!r}) does not match "
                            f"Run.{field} ({run_value!r})"
                        )
        else:
            violations.append(
                f"run_id {run_id!r}: done Run record has no "
                f"pipeline.start event in the ledger"
            )

        # Cross-check 4: fields_populated on the evidence_recorded event
        # matches the actual populated set on the Run record.
        if evidence_events:
            payload = evidence_events[-1].get("payload") or {}
            declared = payload.get("fields_populated")
            if isinstance(declared, list):
                declared_sorted = sorted(str(item) for item in declared)
                actual_sorted = sorted(_populated_fields_on_run(run))
                if declared_sorted != actual_sorted:
                    violations.append(
                        f"run_id {run_id!r}: gate.run.evidence_recorded."
                        f"fields_populated ({declared_sorted}) does not match "
                        f"replay-equivalence fields populated on the Run "
                        f"record ({actual_sorted})"
                    )

        # Cross-check 5: gate_results_summary on the Run record matches
        # the scan of gate.check.* events.
        scanned_passed = sorted(
            str((event.get("payload") or {}).get("gate_name", ""))
            for event in events
            if event.get("type") == "gate.check.passed"
        )
        scanned_failed = sorted(
            str((event.get("payload") or {}).get("gate_name", ""))
            for event in events
            if event.get("type") == "gate.check.failed"
        )
        summary = run.get("gate_results_summary")
        if isinstance(summary, dict):
            run_passed = sorted(str(name) for name in summary.get("gates_passed", []))
            run_failed = sorted(str(name) for name in summary.get("gates_failed", []))
            run_all_passed = summary.get("all_passed")
            if run_passed != scanned_passed:
                violations.append(
                    f"run_id {run_id!r}: Run.gate_results_summary.gates_passed "
                    f"({run_passed}) does not match scan of gate.check.passed "
                    f"events ({scanned_passed})"
                )
            if run_failed != scanned_failed:
                violations.append(
                    f"run_id {run_id!r}: Run.gate_results_summary.gates_failed "
                    f"({run_failed}) does not match scan of gate.check.failed "
                    f"events ({scanned_failed})"
                )
            expected_all_passed = len(scanned_failed) == 0
            if run_all_passed is not None and run_all_passed != expected_all_passed:
                violations.append(
                    f"run_id {run_id!r}: Run.gate_results_summary.all_passed "
                    f"({run_all_passed}) does not match the scan-derived value "
                    f"({expected_all_passed}; gates_failed is "
                    f"{'empty' if expected_all_passed else 'non-empty'})"
                )

    return violations


def main() -> int:
    event_schema = _load_schema(EVENT_SCHEMA_PATH)
    run_schema = _load_schema(RUN_SCHEMA_PATH)
    event_validator = _validator_for(event_schema)
    run_validator = _validator_for(run_schema)

    event_violations, run_to_events, run_ids_in_events = validate_event_ledger(
        event_validator
    )
    record_violations, recorded_ids, runs_by_id = validate_run_records(run_validator)
    cross_violations = cross_check(
        run_to_events, run_ids_in_events, recorded_ids, runs_by_id
    )

    all_violations = event_violations + record_violations + cross_violations
    if all_violations:
        for line in all_violations:
            print(line, file=sys.stderr)
        print(
            f"validate_run_evidence: {len(all_violations)} violation(s) found",
            file=sys.stderr,
        )
        return 1

    n_events = sum(len(v) for v in run_to_events.values())
    print(
        f"validate_run_evidence OK ("
        f"{n_events} event(s), "
        f"{len(recorded_ids)} run record(s), "
        f"{len(run_ids_in_events)} run_id(s) referenced)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
