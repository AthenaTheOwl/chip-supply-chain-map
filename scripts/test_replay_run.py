"""Integration tests for ``replay_run.py``.

Built on stdlib ``unittest`` so the test module lands without
adding any dependency. Each test prepares an isolated temp tree
that mirrors the real ``ops/`` layout (run-records, event-ledger,
exports, replay-records) and drives the replay flow against it.

Coverage:

1. Positive: a clean Run record + ledger + matching input fingerprints
   + matching output hash yields ``replay_equivalent: true`` and exit 0.
2. HEAD mismatch: the recorded sandbox SHA differs from the
   working-tree HEAD; replay exits 1 with the canonical checkout
   message.
3. Missing Run record: replay exits 1 with a clear "not found"
   message.
4. Synthetic divergence: an input file is mutated after the Run was
   recorded; replay detects the
   ``tool_schemas_snapshot_hash`` mismatch and returns
   ``replay_equivalent: false`` without invoking the export.

The export sub-process is stubbed in the positive case so the
tests do not depend on ``node`` being installed on the test
machine.
"""

from __future__ import annotations

import importlib.util
import io
import json
import shutil
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any
from unittest import mock

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent

# Load the replay module by path so the test does not depend on
# scripts/ being on sys.path. Mirrors test_validate_run_evidence.py.
_SPEC = importlib.util.spec_from_file_location(
    "replay_run", HERE / "replay_run.py"
)
assert _SPEC is not None and _SPEC.loader is not None
RR = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(RR)


# Test inputs are tiny but byte-identical across all positive cases.
# The actual content is irrelevant for the hash-comparison logic; what
# matters is that the canonicalization mirrors the TS emitter.
_TEST_INPUTS = {
    "src/data/nodes.csv": "id,name\nn1,Alpha\n",
    "src/data/edges.csv": "source,target\nn1,n1\n",
    "src/data/sources.md": "- **s1** - Test https://example.com/test\n",
    "src/data/financial_sensitivity.csv": (
        "company,ticker,node_id,scenario_id,metric_name,metric_value,"
        "period,source_id,sensitivity_band,note\n"
    ),
}


def _expected_tool_schemas_hash() -> str:
    inputs = [{"path": p, "content": c} for p, c in _TEST_INPUTS.items()]
    return RR._sha256_text(RR._canonicalize_inputs(inputs))


def _expected_prompt_hash() -> str:
    return RR._sha256_text(
        RR._canonicalize_heuristic_config(RR.HEURISTIC_CONFIG)
    )


def _good_run_record(run_id: str, sandbox_sha: str) -> dict[str, Any]:
    return {
        "agent_id": "chip-supply-chain-map-export",
        "finished_at": "2026-05-28T12:00:00Z",
        "gate_results_summary": {
            "all_passed": True,
            "gates_failed": [],
            "gates_passed": ["input_validation", "packet_shape"],
        },
        "id": run_id,
        "inputs": [
            {"kind": "dataset", "ref": "src/data/nodes.csv"},
            {"kind": "dataset", "ref": "src/data/edges.csv"},
            {"kind": "dataset", "ref": "src/data/sources.md"},
            {"kind": "dataset", "ref": "src/data/financial_sensitivity.csv"},
        ],
        "outputs": [
            {
                "artifact_id": f"watchlist-packet@{run_id}",
                "type": "watchlist_risk_packet",
            }
        ],
        "prompt_snapshot_hash": _expected_prompt_hash(),
        "runtime": "chip-supply-chain-map-export",
        "sandbox_image_ref": f"/tmp/test-workspace@{sandbox_sha}",
        "spec_id": "specs/0002-earnings-sensitivity-overlay/",
        "started_at": "2026-05-28T12:00:00Z",
        "status": "done",
        "tool_schemas_snapshot_hash": _expected_tool_schemas_hash(),
        "workspace_id": "/tmp/test-workspace",
    }


def _good_ledger_line(run_id: str) -> str:
    event = {
        "actor": {"id": "chip-supply-chain-map-export", "kind": "system"},
        "created_at": "2026-05-28T12:00:00Z",
        "event_id": "11111111-1111-4111-8111-111111111111",
        "payload": {
            "pipeline": "watchlist_export",
            "prompt_snapshot_hash": _expected_prompt_hash(),
            "tool_schemas_snapshot_hash": _expected_tool_schemas_hash(),
        },
        "run_id": run_id,
        "spec_id": "specs/0002-earnings-sensitivity-overlay/",
        "type": "pipeline.start",
    }
    return json.dumps(event, sort_keys=True) + "\n"


class ReplayTests(unittest.TestCase):
    """Drive ``replay_run.replay`` over crafted temp directories."""

    def setUp(self) -> None:
        self._tmp = TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)

        # Build the ops/ layout mirroring the real repo.
        (self.root / "ops" / "run-records").mkdir(parents=True)
        (self.root / "ops" / "event-ledger").mkdir(parents=True)
        (self.root / "ops" / "exports").mkdir(parents=True)
        (self.root / "ops" / "replay-records").mkdir(parents=True)
        for rel, content in _TEST_INPUTS.items():
            path = self.root / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")

        # Stub committed packet with a deterministic byte string. The
        # positive case has the export sub-process write the same
        # bytes to the temp output; replay then asserts equality.
        self.committed_packet_text = '{"version":1,"watchlist":[]}\n'
        self.committed_packet_path = (
            self.root / "ops" / "exports" / "chip-watchlist-risk-packet.json"
        )
        self.committed_packet_path.write_text(
            self.committed_packet_text, encoding="utf-8"
        )

        self.run_id = "run-test00000001"
        self.sandbox_sha = "deadbeef" * 5  # 40-char fake SHA

    # ----------------------------------------------------------------- helpers

    def write_run(self, run: dict[str, Any]) -> None:
        path = self.root / "ops" / "run-records" / f"{run['id']}.json"
        path.write_text(json.dumps(run, sort_keys=True, indent=2), encoding="utf-8")

    def write_ledger(self, run_id: str, line: str) -> None:
        path = self.root / "ops" / "event-ledger" / f"{run_id}.jsonl"
        path.write_text(line, encoding="utf-8")

    def run_replay(
        self, head_sha: str, run_export_side_effect: Any = None
    ) -> tuple[int, str, str]:
        """Invoke ``RR.replay`` with head + export stubbed.

        ``head_sha`` is what ``_git_head_sha`` returns. The export stub
        writes ``committed_packet_text`` to its target path by default
        so the positive-path hash compare passes.
        """

        def default_export(repo_root: Path, output_path: Path) -> tuple[int, str, str]:
            output_path.write_text(
                self.committed_packet_text, encoding="utf-8"
            )
            return 0, "stubbed export OK\n", ""

        export_stub = run_export_side_effect or default_export

        stdout, stderr = io.StringIO(), io.StringIO()
        with redirect_stdout(stdout), redirect_stderr(stderr):
            with mock.patch.object(RR, "_git_head_sha", return_value=head_sha):
                with mock.patch.object(RR, "run_export", side_effect=export_stub):
                    try:
                        code = RR.replay(self.run_id, self.root)
                    except SystemExit as exc:
                        code = int(exc.code) if exc.code is not None else 0
        return code, stdout.getvalue(), stderr.getvalue()

    # ----------------------------------------------------------------- positive

    def test_positive_replay_equivalent_true(self) -> None:
        self.write_run(_good_run_record(self.run_id, self.sandbox_sha))
        self.write_ledger(self.run_id, _good_ledger_line(self.run_id))
        code, out, err = self.run_replay(head_sha=self.sandbox_sha)
        self.assertEqual(
            code, 0,
            msg=f"expected exit 0; stdout={out!r} stderr={err!r}",
        )
        self.assertIn("replay OK", out)
        self.assertIn("replay_equivalent=True", out)
        # The replay record file should exist.
        records_dir = self.root / "ops" / "replay-records" / self.run_id
        self.assertTrue(records_dir.is_dir())
        records = list(records_dir.glob("*.json"))
        self.assertEqual(len(records), 1, msg=f"expected 1 record, got {records}")
        body = json.loads(records[0].read_text(encoding="utf-8"))
        self.assertTrue(body["replay_equivalent"])
        self.assertEqual(body["replay_method"], "deterministic")
        self.assertEqual(body["verdict"], "byte_equal")
        # And the per-replay ledger entry exists.
        ledgers = list(
            (self.root / "ops" / "event-ledger").glob(f"replay-{self.run_id}-*.jsonl")
        )
        self.assertEqual(len(ledgers), 1)
        event = json.loads(ledgers[0].read_text(encoding="utf-8").splitlines()[0])
        self.assertEqual(event["type"], "run.evidence.replayed")
        self.assertTrue(event["payload"]["replay_equivalent"])

    # ----------------------------------------------------------------- HEAD mismatch

    def test_head_mismatch_exits_one(self) -> None:
        self.write_run(_good_run_record(self.run_id, self.sandbox_sha))
        self.write_ledger(self.run_id, _good_ledger_line(self.run_id))
        wrong_head = "cafebabe" * 5
        code, _out, err = self.run_replay(head_sha=wrong_head)
        self.assertEqual(code, 1)
        self.assertIn(f"requires checkout of {self.sandbox_sha}", err)
        self.assertIn(f"current HEAD is {wrong_head}", err)
        self.assertIn(f"git checkout {self.sandbox_sha}", err)
        # No replay record should be written on HEAD mismatch.
        self.assertFalse(
            (self.root / "ops" / "replay-records" / self.run_id).exists()
        )

    # ----------------------------------------------------------------- missing record

    def test_missing_run_record_exits_one(self) -> None:
        # Do not write the run record. Ledger does not matter here
        # because the run-record load fails first.
        stdout, stderr = io.StringIO(), io.StringIO()
        message = ""
        with redirect_stdout(stdout), redirect_stderr(stderr):
            with mock.patch.object(RR, "_git_head_sha", return_value=self.sandbox_sha):
                try:
                    RR.replay(self.run_id, self.root)
                    raise AssertionError("replay did not raise on missing record")
                except SystemExit as exc:
                    # SystemExit with a string message: the interpreter
                    # treats it as exit 1 with the message on stderr.
                    code = exc.code
                    if isinstance(code, int):
                        pass  # falls through to assertion below
                    else:
                        message = str(code)
                        code = 1
        self.assertEqual(code, 1)
        combined = stdout.getvalue() + stderr.getvalue() + message
        self.assertIn("Run record not found", combined)

    # ----------------------------------------------------------------- input drift

    def test_input_mutation_detected(self) -> None:
        self.write_run(_good_run_record(self.run_id, self.sandbox_sha))
        self.write_ledger(self.run_id, _good_ledger_line(self.run_id))
        # Mutate one input file to a different content; tool_schemas_hash
        # must drift.
        (self.root / "src" / "data" / "nodes.csv").write_text(
            "id,name\nn1,Beta\n", encoding="utf-8"
        )

        # We do not need to stub run_export because verify_inputs
        # short-circuits on mismatch. We still stub it defensively to
        # catch any regression that lets execution reach the export.
        def fail_if_called(*_args: Any, **_kwargs: Any) -> tuple[int, str, str]:
            raise AssertionError(
                "run_export must not be called when inputs have drifted"
            )

        code, _out, err = self.run_replay(
            head_sha=self.sandbox_sha,
            run_export_side_effect=fail_if_called,
        )
        self.assertEqual(code, 1)
        self.assertIn("tool_schemas_snapshot_hash mismatch", err)
        records_dir = self.root / "ops" / "replay-records" / self.run_id
        records = list(records_dir.glob("*.json"))
        self.assertEqual(len(records), 1)
        body = json.loads(records[0].read_text(encoding="utf-8"))
        self.assertFalse(body["replay_equivalent"])
        self.assertEqual(body["verdict"], "input_hash_mismatch")
        # The per-replay ledger should also carry replay_equivalent=false.
        ledgers = list(
            (self.root / "ops" / "event-ledger").glob(f"replay-{self.run_id}-*.jsonl")
        )
        self.assertEqual(len(ledgers), 1)
        event = json.loads(ledgers[0].read_text(encoding="utf-8").splitlines()[0])
        self.assertFalse(event["payload"]["replay_equivalent"])


class ReplayUriTests(unittest.TestCase):
    """Round-6 / DEC-CDCP-014 + DEC-FIN-006: replay accepts repo:// URIs.

    The replay command must extract the recorded SHA from both the
    legacy ``<abs-path>@<sha>`` form and the new
    ``repo://chip-supply-chain-map@<sha>/`` URI form. The PENDING
    placeholder must short-circuit with a clear "run the finalizer"
    message.
    """

    def test_parse_sandbox_sha_uri_form(self) -> None:
        sha = "a" * 40
        uri = f"repo://chip-supply-chain-map@{sha}/"
        self.assertEqual(RR._parse_sandbox_sha(uri), sha)

    def test_parse_sandbox_sha_uri_with_trailing_path(self) -> None:
        # The grammar allows a non-empty path after the trailing /.
        # The parser must still extract the SHA only.
        sha = "b" * 40
        uri = f"repo://chip-supply-chain-map@{sha}/some/leftover/path"
        self.assertEqual(RR._parse_sandbox_sha(uri), sha)

    def test_parse_sandbox_sha_legacy_form(self) -> None:
        legacy = "/tmp/test-workspace@cafebabe"
        self.assertEqual(RR._parse_sandbox_sha(legacy), "cafebabe")

    def test_parse_sandbox_sha_pending(self) -> None:
        uri = "repo://chip-supply-chain-map@PENDING/"
        self.assertEqual(RR._parse_sandbox_sha(uri), "PENDING")

    def test_resolve_uri_repo(self) -> None:
        sha = "c" * 40
        uri = f"repo://chip-supply-chain-map@{sha}/src/data/foo.csv"
        self.assertEqual(
            RR.resolve_uri(uri, portfolio_root=Path("/tmp/p")),
            Path("/tmp/p/chip-supply-chain-map/src/data/foo.csv"),
        )

    def test_resolve_uri_artifact(self) -> None:
        self.assertIsNone(
            RR.resolve_uri("artifact://chip-supply-chain-map/some-id")
        )

    def test_resolve_uri_legacy(self) -> None:
        self.assertEqual(
            RR.resolve_uri("src/data/foo.csv"),
            Path("src/data/foo.csv"),
        )


if __name__ == "__main__":
    unittest.main()
