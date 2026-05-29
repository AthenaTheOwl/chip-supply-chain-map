"""Multi-rerun determinism fixture for the watchlist-export replay.

Distinct from ``scripts/test_replay_run.py`` (the producer-side
integration test): this fixture replays the canonical sample
``run-6a665b303138`` RERUNS times (default 3) at the recorded sandbox
SHA and asserts every replay produces an identical canonicalized hash
over the three replay-equivalence fields:

  - ``replayed_packet_hash``
  - ``recomputed_prompt_snapshot_hash``
  - ``recomputed_tool_schemas_snapshot_hash``

Each replay report under
``ops/replay-records/run-6a665b303138/<replay-event-id>.json`` records
those three keys under ``comparison.*``. The fixture extracts them,
JSON-encodes the tuple with ``sort_keys=True`` and
``separators=(",", ":")``, and SHA-256 hashes the byte string. All
RERUNS hashes must match AND every replay must carry
``verdict == "byte_equal"`` AND every ``replayed_packet_hash`` must
equal the recorded ``committed_packet_hash``.

When the canonicalized hashes diverge, the fixture writes a failure
bundle to ``artifacts/failbundles/`` containing the unique hashes, the
first two diverging canonical traces, and the canonical sample id,
then fails the test with the bundle path in the assertion message.

Environment notes:

- The recorded sandbox SHA must be reachable in the local git history.
  CI sets ``fetch-depth: 0`` on the initial checkout for that reason.
- The fixture saves the finalized Run record from main HEAD, checks
  out the recorded sandbox SHA, restores the saved record over the
  working tree at that SHA (the Run record bytes at the sandbox SHA
  carry the PENDING placeholder from Round 6's two-pass emitter), runs
  the replay, then restores the original HEAD in teardown.
- Each replay writes a fresh
  ``ops/replay-records/<run-id>/<replay-event-id>.json`` plus a
  per-replay ledger at
  ``ops/event-ledger/replay-<run-id>-<safe-ts>-<replay-event-id>.jsonl``.
  Teardown removes the files this fixture created so the working tree
  stays clean.

Override the replay count with the ``RERUNS`` env var (default 3).

Run locally with::

    python -m unittest scripts.test_replay_determinism

Covers: R-FIN-025, R-FIN-026, R-FIN-027.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import unittest
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent
CANONICAL_RUN_ID = "run-6a665b303138"
RUN_RECORD_PATH = REPO_ROOT / "ops" / "run-records" / f"{CANONICAL_RUN_ID}.json"
REPLAY_RECORDS_DIR = REPO_ROOT / "ops" / "replay-records" / CANONICAL_RUN_ID
EVENT_LEDGER_DIR = REPO_ROOT / "ops" / "event-ledger"
FAILBUNDLE_DIR = REPO_ROOT / "artifacts" / "failbundles"
DEFAULT_RERUNS = 3

# Three replay-equivalence hashes the replay report records under
# ``comparison.*`` in chip-supply-chain-map's framing.
CANONICAL_FIELDS = (
    "replayed_packet_hash",
    "recomputed_prompt_snapshot_hash",
    "recomputed_tool_schemas_snapshot_hash",
)


# --------------------------------------------------------------------- helpers


def _git(*args: str) -> str:
    """Run a git command rooted at the repo and return stdout."""
    result = subprocess.run(  # noqa: S603 - git on PATH
        ["git", "-C", str(REPO_ROOT), *args],
        capture_output=True,
        text=True,
        check=False,
        timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"git {' '.join(args)} failed ({result.returncode}): "
            f"{result.stderr.strip() or result.stdout.strip()}"
        )
    return result.stdout.strip()


def _extract_sandbox_sha(run_record: dict[str, Any]) -> str:
    """Pull the 40-char hex SHA off ``sandbox_image_ref``.

    Accepts the DEC-FIN-006 portable URI form
    (``repo://chip-supply-chain-map@<sha>/``) and the legacy
    ``<abs-path>@<sha>`` form. Raises ``ValueError`` on a missing or
    PENDING placeholder.
    """
    sandbox = run_record.get("sandbox_image_ref")
    if not isinstance(sandbox, str) or not sandbox:
        raise ValueError("Run record has no sandbox_image_ref")
    if "@PENDING" in sandbox:
        raise ValueError(
            "sandbox_image_ref is PENDING; finalize before running "
            "the determinism fixture"
        )
    uri_match = re.match(
        r"^repo://[a-z][a-z0-9-]*@(?P<sha>[a-f0-9]{40})/", sandbox
    )
    if uri_match:
        return uri_match.group("sha")
    # Legacy form: ``<worktree>@<sha>``.
    if "@" not in sandbox:
        raise ValueError(
            "sandbox_image_ref has no @<sha> suffix; cannot extract SHA"
        )
    sha = sandbox.rsplit("@", 1)[-1].strip().rstrip("/")
    if len(sha) != 40 or not all(c in "0123456789abcdef" for c in sha):
        raise ValueError(
            f"sandbox_image_ref suffix is not a 40-char hex SHA: {sha!r}"
        )
    return sha


def _canonicalize_replay_record(report: dict[str, Any]) -> dict[str, Any]:
    """Extract the three replay-equivalence hashes from a replay report.

    The replay report at
    ``ops/replay-records/<run-id>/<replay-event-id>.json`` carries the
    three hashes under ``comparison.*``. Returns a dict keyed by the
    same field names so the canonical JSON encoding is stable.
    """
    comparison = report.get("comparison") or {}
    return {
        "replayed_packet_hash": comparison.get("replayed_packet_hash"),
        "recomputed_prompt_snapshot_hash": comparison.get(
            "recomputed_prompt_snapshot_hash"
        ),
        "recomputed_tool_schemas_snapshot_hash": comparison.get(
            "recomputed_tool_schemas_snapshot_hash"
        ),
    }


def _hash_canonical(canonical: dict[str, Any]) -> str:
    """SHA-256 over the canonical JSON encoding of the hash tuple."""
    encoded = json.dumps(
        canonical, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _snapshot_existing(dir_path: Path, pattern: str) -> set[Path]:
    if not dir_path.is_dir():
        return set()
    return set(dir_path.glob(pattern))


# ----------------------------------------------------------------- test case


class ReplayDeterminismTests(unittest.TestCase):
    """Replay the canonical sample RERUNS times; assert hash agreement."""

    def setUp(self) -> None:
        if not RUN_RECORD_PATH.is_file():
            self.skipTest(f"canonical Run record missing: {RUN_RECORD_PATH}")

        # Save the original HEAD so teardown can restore it. Prefer the
        # branch name over the SHA when HEAD points at one so the
        # restore lands the worktree back on the same branch instead of
        # a detached HEAD on the same SHA.
        self._original_sha = _git("rev-parse", "HEAD")
        try:
            self._original_ref = _git("symbolic-ref", "--short", "HEAD")
        except RuntimeError:
            self._original_ref = self._original_sha

        # Track replay artifacts the fixture creates so teardown can
        # delete them and leave the working tree clean.
        self._before_reports = _snapshot_existing(REPLAY_RECORDS_DIR, "*.json")
        self._before_ledgers = _snapshot_existing(
            EVENT_LEDGER_DIR, f"replay-{CANONICAL_RUN_ID}-*.jsonl"
        )

        # Track whether we performed a checkout so teardown only
        # restores HEAD when the test actually moved it.
        self._checked_out_sandbox = False

    def tearDown(self) -> None:
        # Restore the finalized Run record over the working tree first;
        # the test overwrites it after the sandbox-SHA checkout, leaving
        # a modification that would block a plain ``git checkout``.
        if self._checked_out_sandbox:
            try:
                _git(
                    "checkout",
                    "--",
                    RUN_RECORD_PATH.relative_to(REPO_ROOT).as_posix(),
                )
            except RuntimeError:
                pass
            try:
                _git("checkout", self._original_ref)
            except RuntimeError:
                # Fall back to the SHA form if the symbolic ref name
                # is no longer valid (e.g. branch deleted mid-test).
                _git("checkout", self._original_sha)

        # Remove fresh replay artifacts the fixture created so the
        # working tree returns to its starting state.
        after_reports = _snapshot_existing(REPLAY_RECORDS_DIR, "*.json")
        after_ledgers = _snapshot_existing(
            EVENT_LEDGER_DIR, f"replay-{CANONICAL_RUN_ID}-*.jsonl"
        )
        for path in after_reports - self._before_reports:
            try:
                path.unlink()
            except OSError:
                pass
        for path in after_ledgers - self._before_ledgers:
            try:
                path.unlink()
            except OSError:
                pass

    def test_canonical_sample_replay_is_deterministic(self) -> None:
        """The canonical sample replays to the same canonical hash on every rerun.

        Catches drift in input fingerprints, heuristic config, or the
        produced packet between two nominally-identical replay
        invocations. Failure writes a bundle to
        ``artifacts/failbundles/`` with the diverging traces and unique
        hashes.
        """
        rerun_count = int(os.environ.get("RERUNS", str(DEFAULT_RERUNS)))
        self.assertGreaterEqual(
            rerun_count,
            2,
            msg="RERUNS must be at least 2 to compare hashes",
        )

        run_record = json.loads(RUN_RECORD_PATH.read_text(encoding="utf-8"))
        sandbox_sha = _extract_sandbox_sha(run_record)

        # ``git checkout`` refuses when tracked files differ between
        # HEAD and the target ref. CI hits a clean tree from
        # ``actions/checkout`` so this path is silent there. Local dev
        # with in-flight edits trips the check; skip cleanly so the
        # fixture does not falsely report non-determinism on a dirty
        # tree.
        dirty = _git("status", "--porcelain")
        if dirty:
            tracked_changes = [
                line for line in dirty.splitlines() if not line.startswith("??")
            ]
            if tracked_changes:
                self.skipTest(
                    "working tree has tracked modifications that would "
                    "block `git checkout <sandbox-sha>`; clean the tree "
                    "or stash changes before running the determinism "
                    f"fixture. Modified entries: {tracked_changes}"
                )

        # Save the finalized Run record so the post-checkout worktree
        # (which carries the PENDING placeholder per the DEC-FIN-006
        # two-pass flow) replays against the finalized SHA. The CI
        # workflow does the same dance via ``cp`` after the
        # ``git checkout``.
        finalized_record_bytes = RUN_RECORD_PATH.read_bytes()
        _git("checkout", sandbox_sha)
        self._checked_out_sandbox = True
        RUN_RECORD_PATH.write_bytes(finalized_record_bytes)

        canonical_traces: list[dict[str, Any]] = []
        canonical_hashes: list[str] = []
        verdicts: list[str] = []
        replayed_hashes: list[str] = []
        committed_hashes: list[str] = []

        for _ in range(rerun_count):
            before = _snapshot_existing(REPLAY_RECORDS_DIR, "*.json")
            proc = subprocess.run(  # noqa: S603 - args validated
                [
                    sys.executable,
                    "scripts/replay_run.py",
                    "--run-id",
                    CANONICAL_RUN_ID,
                ],
                cwd=str(REPO_ROOT),
                capture_output=True,
                text=True,
                check=False,
                timeout=300,
            )
            if proc.returncode != 0:
                self.fail(
                    "replay_run.py exited "
                    f"{proc.returncode} during determinism replay:\n"
                    f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
                )
            after = _snapshot_existing(REPLAY_RECORDS_DIR, "*.json")
            new_reports = sorted(after - before)
            self.assertEqual(
                len(new_reports),
                1,
                msg=(
                    f"expected exactly one fresh replay report, got "
                    f"{[p.name for p in new_reports]}"
                ),
            )
            report = json.loads(new_reports[0].read_text(encoding="utf-8"))
            canonical = _canonicalize_replay_record(report)
            canonical_traces.append(canonical)
            canonical_hashes.append(_hash_canonical(canonical))
            verdicts.append(str(report.get("verdict")))
            comparison = report.get("comparison") or {}
            replayed_hashes.append(str(comparison.get("replayed_packet_hash")))
            committed_hashes.append(str(comparison.get("committed_packet_hash")))

        # Every replay must carry the byte-equal verdict; otherwise the
        # canonical-hash check is downstream noise.
        for idx, verdict in enumerate(verdicts):
            self.assertEqual(
                verdict,
                "byte_equal",
                msg=(
                    f"rerun {idx} verdict was {verdict!r}, expected "
                    f"'byte_equal'; canonical hashes={canonical_hashes}"
                ),
            )

        # Every replayed packet must match the committed packet hash.
        for idx, (replayed, committed) in enumerate(
            zip(replayed_hashes, committed_hashes)
        ):
            self.assertEqual(
                replayed,
                committed,
                msg=(
                    f"rerun {idx} replayed_packet_hash {replayed!r} did "
                    f"not match committed_packet_hash {committed!r}"
                ),
            )

        unique_hashes = sorted(set(canonical_hashes))
        if len(unique_hashes) == 1:
            return  # deterministic; test passes.

        # Divergence. Write the failure bundle with the first two
        # diverging canonical traces, the unique hash set, and the
        # canonical sample id.
        first_idx = 0
        second_idx = next(
            i
            for i in range(1, len(canonical_hashes))
            if canonical_hashes[i] != canonical_hashes[0]
        )
        FAILBUNDLE_DIR.mkdir(parents=True, exist_ok=True)
        trace_0_path = FAILBUNDLE_DIR / "trace_0.json"
        trace_1_path = FAILBUNDLE_DIR / "trace_1.json"
        trace_0_path.write_text(
            json.dumps(canonical_traces[first_idx], indent=2, sort_keys=True)
            + "\n",
            encoding="utf-8",
        )
        trace_1_path.write_text(
            json.dumps(canonical_traces[second_idx], indent=2, sort_keys=True)
            + "\n",
            encoding="utf-8",
        )
        bundle_path = FAILBUNDLE_DIR / "determinism_failure.json"
        bundle = {
            "canonical_sample_id": CANONICAL_RUN_ID,
            "sandbox_sha": sandbox_sha,
            "rerun_count": rerun_count,
            "unique_hashes": unique_hashes,
            "first_mismatch_indices": [first_idx, second_idx],
            "trace_paths": [
                trace_0_path.relative_to(REPO_ROOT).as_posix(),
                trace_1_path.relative_to(REPO_ROOT).as_posix(),
            ],
            "hashes_per_rerun": canonical_hashes,
        }
        bundle_path.write_text(
            json.dumps(bundle, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        self.fail(
            f"replay determinism check failed: {len(unique_hashes)} "
            f"unique hashes across {rerun_count} reruns of "
            f"{CANONICAL_RUN_ID}. Failure bundle at "
            f"{bundle_path.relative_to(REPO_ROOT).as_posix()}; "
            f"diverging traces at {trace_0_path.name} and "
            f"{trace_1_path.name}."
        )


if __name__ == "__main__":
    unittest.main()
