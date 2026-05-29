"""Integration tests for ``finalize_sandbox_ref.py`` (DEC-FIN-006).

Each test prepares a temp Run record carrying the PENDING placeholder
and drives ``finalize.finalize`` against it. The finalizer rewrites
the placeholder SHA in ``sandbox_image_ref`` and every
``inputs[].ref`` to the supplied head SHA. The rewrite is idempotent:
a second invocation against an already-resolved record touches
nothing.

Coverage:

1. Positive: a Run record with PENDING sandbox + inputs gets every
   placeholder swapped for the supplied head SHA; the file ends with
   sort-keys + 2-space indent + trailing newline (matches the
   emitter's shape).
2. Idempotent: a Run record with a resolved SHA is unchanged on a
   second run; exit 0 with the "already carries a resolved SHA"
   message.
3. Missing record: exit 1 with a clear "not found" message.
4. Partial: only ``sandbox_image_ref`` carries PENDING (inputs
   already resolved); only that one field is rewritten.
"""

from __future__ import annotations

import importlib.util
import io
import json
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

HERE = Path(__file__).resolve().parent

_SPEC = importlib.util.spec_from_file_location(
    "finalize_sandbox_ref", HERE / "finalize_sandbox_ref.py"
)
assert _SPEC is not None and _SPEC.loader is not None
FIN = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(FIN)


def _pending_run(run_id: str) -> dict[str, Any]:
    return {
        "agent_id": "chip-supply-chain-map-export",
        "id": run_id,
        "inputs": [
            {
                "kind": "dataset",
                "ref": "repo://chip-supply-chain-map@PENDING/src/data/nodes.csv",
            },
            {
                "kind": "dataset",
                "ref": "repo://chip-supply-chain-map@PENDING/src/data/edges.csv",
            },
        ],
        "outputs": [
            {
                "artifact_id": f"artifact://chip-supply-chain-map/watchlist-packet@{run_id}",
                "type": "watchlist_risk_packet",
            }
        ],
        "prompt_snapshot_hash": "a" * 64,
        "runtime": "chip-supply-chain-map-export",
        "sandbox_image_ref": "repo://chip-supply-chain-map@PENDING/",
        "spec_id": "specs/0002-earnings-sensitivity-overlay/",
        "started_at": "2026-05-29T12:00:00Z",
        "finished_at": "2026-05-29T12:00:01Z",
        "status": "done",
        "tool_schemas_snapshot_hash": "b" * 64,
        "workspace_id": "chip-supply-chain-map",
    }


class FinalizeTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        (self.root / "ops" / "run-records").mkdir(parents=True)
        self.run_id = "run-finalize0001"
        self.head_sha = "deadbeef" * 5  # 40 hex chars

    def _write(self, run: dict[str, Any]) -> Path:
        path = self.root / "ops" / "run-records" / f"{run['id']}.json"
        path.write_text(
            json.dumps(run, sort_keys=True, indent=2) + "\n", encoding="utf-8"
        )
        return path

    def _run_finalize(self, head_sha: str | None = None) -> tuple[int, list[str], str, str]:
        stdout, stderr = io.StringIO(), io.StringIO()
        with redirect_stdout(stdout), redirect_stderr(stderr):
            rc, touched = FIN.finalize(
                self.run_id, self.root, head_sha_override=head_sha or self.head_sha
            )
        return rc, touched, stdout.getvalue(), stderr.getvalue()

    def test_positive_rewrites_all_pending_tokens(self) -> None:
        path = self._write(_pending_run(self.run_id))
        rc, touched, out, _err = self._run_finalize()
        self.assertEqual(rc, 0)
        self.assertEqual(
            sorted(touched),
            ["inputs[0].ref", "inputs[1].ref", "sandbox_image_ref"],
        )
        body = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(
            body["sandbox_image_ref"],
            f"repo://chip-supply-chain-map@{self.head_sha}/",
        )
        self.assertEqual(
            body["inputs"][0]["ref"],
            f"repo://chip-supply-chain-map@{self.head_sha}/src/data/nodes.csv",
        )
        self.assertEqual(
            body["inputs"][1]["ref"],
            f"repo://chip-supply-chain-map@{self.head_sha}/src/data/edges.csv",
        )
        self.assertIn("finalize_sandbox_ref OK", out)
        # File must end with one trailing newline.
        raw = path.read_text(encoding="utf-8")
        self.assertTrue(raw.endswith("\n"))

    def test_idempotent_on_already_resolved_record(self) -> None:
        run = _pending_run(self.run_id)
        # Pre-resolve.
        run["sandbox_image_ref"] = f"repo://chip-supply-chain-map@{self.head_sha}/"
        for entry in run["inputs"]:
            entry["ref"] = entry["ref"].replace("PENDING", self.head_sha)
        self._write(run)
        rc, touched, out, _err = self._run_finalize()
        self.assertEqual(rc, 0)
        self.assertEqual(touched, [])
        self.assertIn("no PENDING tokens", out)

    def test_missing_record_exits_one(self) -> None:
        # Do not write the record.
        rc, touched, _out, err = self._run_finalize()
        self.assertEqual(rc, 1)
        self.assertEqual(touched, [])
        self.assertIn("Run record not found", err)

    def test_partial_rewrite_only_sandbox_ref(self) -> None:
        run = _pending_run(self.run_id)
        # Inputs already resolved; only sandbox_image_ref carries PENDING.
        for entry in run["inputs"]:
            entry["ref"] = entry["ref"].replace("PENDING", self.head_sha)
        path = self._write(run)
        rc, touched, _out, _err = self._run_finalize()
        self.assertEqual(rc, 0)
        self.assertEqual(touched, ["sandbox_image_ref"])
        body = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(
            body["sandbox_image_ref"],
            f"repo://chip-supply-chain-map@{self.head_sha}/",
        )
        # Inputs untouched.
        for entry in body["inputs"]:
            self.assertIn(self.head_sha, entry["ref"])


if __name__ == "__main__":
    unittest.main()
