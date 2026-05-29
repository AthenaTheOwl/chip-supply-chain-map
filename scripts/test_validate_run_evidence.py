"""Integration tests for ``validate_run_evidence.py`` cross-checks.

Built on stdlib ``unittest`` so no extra dependency lands. Each test
prepares a temporary directory layout matching the real
``ops/event-ledger`` + ``ops/run-records`` shape, monkey-patches the
validator module to point at it, and asserts the right exit code and
violation messages.

The negative cases cover the six Round-3 cross-check failure modes:

1. done Run missing a required field (``sandbox_image_ref``).
2. done Run missing the terminal ``gate.run.evidence_recorded`` event.
3. ``pipeline.start.prompt_snapshot_hash`` disagrees with the Run record.
4. ``pipeline.start.tool_schemas_snapshot_hash`` disagrees with the
   Run record.
5. ``gate.run.evidence_recorded.fields_populated`` disagrees with the
   actual populated set on the Run record.
6. ``Run.gate_results_summary`` disagrees with the scan of
   ``gate.check.*`` events.

Plus one positive case where a clean Run record + ledger pair passes.
"""

from __future__ import annotations

import copy
import importlib.util
import io
import json
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent

# Load the validator module by path so the tests do not depend on the
# scripts/ directory being on sys.path.
_SPEC = importlib.util.spec_from_file_location(
    "validate_run_evidence", HERE / "validate_run_evidence.py"
)
assert _SPEC is not None and _SPEC.loader is not None
VRE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(VRE)


HASH_A = "a" * 64
HASH_B = "b" * 64
HASH_C = "c" * 64
HASH_D = "d" * 64


def _evt(
    event_id: str,
    event_type: str,
    payload: dict[str, Any],
    run_id: str = "run-test00000001",
) -> dict[str, Any]:
    return {
        "event_id": event_id,
        "type": event_type,
        "created_at": "2026-05-28T03:00:00Z",
        "actor": {"kind": "system", "id": "test"},
        "payload": payload,
        "run_id": run_id,
        "spec_id": "specs/0002-earnings-sensitivity-overlay/",
    }


def _good_events(run_id: str = "run-test00000001") -> list[dict[str, Any]]:
    return [
        _evt(
            "11111111-1111-4111-8111-111111111111",
            "pipeline.start",
            {
                "prompt_snapshot_hash": HASH_A,
                "tool_schemas_snapshot_hash": HASH_B,
            },
            run_id,
        ),
        _evt(
            "22222222-2222-4222-8222-222222222222",
            "gate.check.passed",
            {"gate_name": "input_validation"},
            run_id,
        ),
        _evt(
            "33333333-3333-4333-8333-333333333333",
            "tool.call.completed",
            {"tool_name": "computeChokepointScores"},
            run_id,
        ),
        _evt(
            "44444444-4444-4444-8444-444444444444",
            "gate.check.passed",
            {"gate_name": "packet_shape"},
            run_id,
        ),
        _evt(
            "55555555-5555-4555-8555-555555555555",
            "gate.run.evidence_recorded",
            {
                "run_id": run_id,
                "fields_populated": [
                    "prompt_snapshot_hash",
                    "tool_schemas_snapshot_hash",
                    "sandbox_image_ref",
                    "gate_results_summary",
                ],
            },
            run_id,
        ),
        _evt(
            "66666666-6666-4666-8666-666666666666",
            "pipeline.done",
            {
                "status": "done",
                "gate_results_summary": {
                    "gates_passed": ["input_validation", "packet_shape"],
                    "gates_failed": [],
                    "all_passed": True,
                },
            },
            run_id,
        ),
    ]


def _good_run(run_id: str = "run-test00000001") -> dict[str, Any]:
    return {
        "id": run_id,
        "spec_id": "specs/0002-earnings-sensitivity-overlay/",
        "agent_id": "chip-supply-chain-map-export",
        "runtime": "chip-supply-chain-map-export",
        "workspace_id": "/tmp/test-workspace",
        "started_at": "2026-05-28T03:00:00Z",
        "finished_at": "2026-05-28T03:00:01Z",
        "status": "done",
        "inputs": [{"kind": "dataset", "ref": "src/data/nodes.csv"}],
        "outputs": [
            {
                "artifact_id": f"watchlist-packet@{run_id}",
                "type": "watchlist_risk_packet",
            }
        ],
        "prompt_snapshot_hash": HASH_A,
        "tool_schemas_snapshot_hash": HASH_B,
        "sandbox_image_ref": "/tmp/test-workspace@deadbeef",
        "gate_results_summary": {
            "gates_passed": ["input_validation", "packet_shape"],
            "gates_failed": [],
            "all_passed": True,
        },
    }


class CrossCheckTests(unittest.TestCase):
    """Drive ``validate_run_evidence.main`` over crafted directory layouts."""

    def setUp(self) -> None:
        self._tmp = TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.ledger_dir = self.root / "ops" / "event-ledger"
        self.records_dir = self.root / "ops" / "run-records"
        self.ledger_dir.mkdir(parents=True)
        self.records_dir.mkdir(parents=True)

        # Point the validator's module-level globals at the temp tree.
        # The schema cache stays at the real repo path; only the data
        # directories move.
        self._orig_root = VRE.ROOT
        self._orig_ledger = VRE.EVENT_LEDGER_DIR
        self._orig_records = VRE.RUN_RECORDS_DIR
        VRE.ROOT = self.root
        VRE.EVENT_LEDGER_DIR = self.ledger_dir
        VRE.RUN_RECORDS_DIR = self.records_dir

    def tearDown(self) -> None:
        VRE.ROOT = self._orig_root
        VRE.EVENT_LEDGER_DIR = self._orig_ledger
        VRE.RUN_RECORDS_DIR = self._orig_records

    # ----------------------------------------------------------------- helpers

    def write_pair(
        self,
        events: list[dict[str, Any]],
        run: dict[str, Any],
        run_id: str = "run-test00000001",
    ) -> None:
        ledger_path = self.ledger_dir / f"{run_id}.jsonl"
        ledger_path.write_text(
            "\n".join(json.dumps(event, sort_keys=True) for event in events) + "\n",
            encoding="utf-8",
        )
        record_path = self.records_dir / f"{run_id}.json"
        record_path.write_text(json.dumps(run, sort_keys=True, indent=2), encoding="utf-8")

    def run_validator(self) -> tuple[int, str, str]:
        stdout, stderr = io.StringIO(), io.StringIO()
        with redirect_stdout(stdout), redirect_stderr(stderr):
            code = VRE.main()
        return code, stdout.getvalue(), stderr.getvalue()

    # ----------------------------------------------------------------- positive

    def test_clean_pair_passes(self) -> None:
        self.write_pair(_good_events(), _good_run())
        code, out, err = self.run_validator()
        self.assertEqual(code, 0, msg=f"expected pass, got {code}; stderr={err}")
        self.assertIn("validate_run_evidence OK", out)

    # ----------------------------------------------------------------- negative

    def test_missing_required_field_sandbox_image_ref(self) -> None:
        run = _good_run()
        del run["sandbox_image_ref"]
        self.write_pair(_good_events(), run)
        code, _out, err = self.run_validator()
        self.assertEqual(code, 1)
        self.assertIn("missing required field 'sandbox_image_ref'", err)

    def test_missing_terminal_evidence_recorded_event(self) -> None:
        events = [
            event for event in _good_events()
            if event["type"] != "gate.run.evidence_recorded"
        ]
        self.write_pair(events, _good_run())
        code, _out, err = self.run_validator()
        self.assertEqual(code, 1)
        self.assertIn("no gate.run.evidence_recorded event", err)

    def test_prompt_hash_disagreement(self) -> None:
        events = _good_events()
        # Mutate pipeline.start's prompt_snapshot_hash.
        for event in events:
            if event["type"] == "pipeline.start":
                event["payload"]["prompt_snapshot_hash"] = HASH_C
        self.write_pair(events, _good_run())
        code, _out, err = self.run_validator()
        self.assertEqual(code, 1)
        self.assertIn("pipeline.start.prompt_snapshot_hash", err)
        self.assertIn("does not match Run.prompt_snapshot_hash", err)

    def test_tool_schemas_hash_disagreement(self) -> None:
        events = _good_events()
        for event in events:
            if event["type"] == "pipeline.start":
                event["payload"]["tool_schemas_snapshot_hash"] = HASH_D
        self.write_pair(events, _good_run())
        code, _out, err = self.run_validator()
        self.assertEqual(code, 1)
        self.assertIn("pipeline.start.tool_schemas_snapshot_hash", err)

    def test_fields_populated_disagreement(self) -> None:
        events = _good_events()
        for event in events:
            if event["type"] == "gate.run.evidence_recorded":
                # Drop sandbox_image_ref from the declared list while
                # the Run record still carries the field.
                event["payload"]["fields_populated"] = [
                    "prompt_snapshot_hash",
                    "tool_schemas_snapshot_hash",
                    "gate_results_summary",
                ]
        self.write_pair(events, _good_run())
        code, _out, err = self.run_validator()
        self.assertEqual(code, 1)
        self.assertIn("fields_populated", err)
        self.assertIn("does not match", err)

    def test_gate_results_summary_disagreement(self) -> None:
        run = _good_run()
        # Swap a gate name so the Run.summary disagrees with the
        # ledger scan.
        run["gate_results_summary"] = {
            "gates_passed": ["input_validation", "schema_shape"],
            "gates_failed": [],
            "all_passed": True,
        }
        self.write_pair(_good_events(), run)
        code, _out, err = self.run_validator()
        self.assertEqual(code, 1)
        self.assertIn("gate_results_summary.gates_passed", err)

    def test_all_passed_disagreement(self) -> None:
        """Extra coverage: ``all_passed`` flag must agree with the
        scan-derived value. Not one of the six core negatives but cheap
        to add and the failure shape is distinct."""
        events = copy.deepcopy(_good_events())
        # Add a failed gate event without updating the Run summary.
        events.insert(
            -1,
            _evt(
                "77777777-7777-4777-8777-777777777777",
                "gate.check.failed",
                {"gate_name": "extra_gate", "reason": "synthetic failure"},
            ),
        )
        self.write_pair(events, _good_run())
        code, _out, err = self.run_validator()
        self.assertEqual(code, 1)
        # Either the gates_failed list disagrees (it does) or all_passed
        # disagrees. Both are acceptable evidence of the cross-check
        # firing.
        self.assertTrue(
            "gates_failed" in err or "all_passed" in err,
            msg=f"expected gates_failed or all_passed in stderr, got: {err}",
        )


class ResolveUriTests(unittest.TestCase):
    """Round-6 / DEC-CDCP-014 + DEC-FIN-006: resolve_uri helper.

    The validator must accept BOTH the new repo:// URI form and
    legacy local paths during the migration window. These tests
    pin the four-case truth table from DEC-CDCP-014.
    """

    def test_repo_uri_resolves_under_portfolio_root(self) -> None:
        sha = "a" * 40
        uri = f"repo://chip-supply-chain-map@{sha}/src/data/nodes.csv"
        resolved = VRE.resolve_uri(uri, portfolio_root=Path("/tmp/portfolio"))
        self.assertEqual(
            resolved,
            Path("/tmp/portfolio/chip-supply-chain-map/src/data/nodes.csv"),
        )

    def test_repo_uri_with_pending_sha_resolves(self) -> None:
        # The PENDING placeholder must round-trip through resolve_uri
        # so the validator does not reject placeholder records before
        # finalize_sandbox_ref.py runs.
        uri = "repo://chip-supply-chain-map@PENDING/src/data/edges.csv"
        resolved = VRE.resolve_uri(uri, portfolio_root=Path("/tmp/portfolio"))
        self.assertEqual(
            resolved,
            Path("/tmp/portfolio/chip-supply-chain-map/src/data/edges.csv"),
        )

    def test_artifact_uri_returns_none(self) -> None:
        uri = "artifact://chip-supply-chain-map/watchlist-packet@run-abc"
        self.assertIsNone(VRE.resolve_uri(uri))

    def test_legacy_local_path_returns_path_as_is(self) -> None:
        legacy = "src/data/nodes.csv"
        self.assertEqual(VRE.resolve_uri(legacy), Path(legacy))

    def test_malformed_uri_treated_as_legacy_path(self) -> None:
        # A string starting with `repo://` but not matching the
        # grammar (e.g. uppercase repo name) must fall through to the
        # legacy branch, not raise. The validator never rejects a
        # path-shaped string outright; the schema rejects unrelated
        # malformed values upstream.
        malformed = "repo://Chip-Supply@deadbeef/foo"
        self.assertEqual(VRE.resolve_uri(malformed), Path(malformed))

    def test_uri_record_passes_validation(self) -> None:
        """A done Run record carrying repo:// URIs validates clean."""
        sha = "f" * 40
        sandbox_uri = f"repo://chip-supply-chain-map@{sha}/"
        input_uri = f"repo://chip-supply-chain-map@{sha}/src/data/nodes.csv"
        artifact_uri = "artifact://chip-supply-chain-map/watchlist-packet@run-uritest0001"

        run_id = "run-uritest0001"
        run = _good_run(run_id)
        run["sandbox_image_ref"] = sandbox_uri
        run["workspace_id"] = "chip-supply-chain-map"
        run["inputs"] = [{"kind": "dataset", "ref": input_uri}]
        run["outputs"] = [
            {"artifact_id": artifact_uri, "type": "watchlist_risk_packet"}
        ]

        # Drive the same temp-tree validator harness CrossCheckTests
        # uses, scoped to one method.
        tmp = TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        ledger_dir = root / "ops" / "event-ledger"
        records_dir = root / "ops" / "run-records"
        ledger_dir.mkdir(parents=True)
        records_dir.mkdir(parents=True)
        orig_root, orig_l, orig_r = VRE.ROOT, VRE.EVENT_LEDGER_DIR, VRE.RUN_RECORDS_DIR
        VRE.ROOT = root
        VRE.EVENT_LEDGER_DIR = ledger_dir
        VRE.RUN_RECORDS_DIR = records_dir
        try:
            (ledger_dir / f"{run_id}.jsonl").write_text(
                "\n".join(
                    json.dumps(e, sort_keys=True) for e in _good_events(run_id)
                ) + "\n",
                encoding="utf-8",
            )
            (records_dir / f"{run_id}.json").write_text(
                json.dumps(run, sort_keys=True, indent=2), encoding="utf-8"
            )
            stdout, stderr = io.StringIO(), io.StringIO()
            with redirect_stdout(stdout), redirect_stderr(stderr):
                code = VRE.main()
            self.assertEqual(
                code, 0,
                msg=f"URI record should validate; stderr={stderr.getvalue()}",
            )
        finally:
            VRE.ROOT = orig_root
            VRE.EVENT_LEDGER_DIR = orig_l
            VRE.RUN_RECORDS_DIR = orig_r


if __name__ == "__main__":
    unittest.main()
