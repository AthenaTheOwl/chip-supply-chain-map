"""Chaos test suite for ``validate_run_evidence.py``.

Round-4 closing pass under DEC-FIN-010. The earlier
``test_validate_run_evidence.py`` builds synthetic Run + ledger
fixtures from scratch and asserts the cross-checks fire on hand-rolled
mutations. This suite is the inverse: it loads the canonical sample
pair (``ops/run-records/run-6a665b303138.json`` +
``ops/event-ledger/run-6a665b303138.jsonl``), applies one mutation per
class to a copy in a temp tree, runs ``validate_run_evidence.main``
against the mutated copy, and asserts the validator EXITS NON-ZERO
with a stderr line that names the right check.

The point of the chaos suite is to catch silent regressions in the
validator itself. If a mutation slips through (exit 0), the test
fails loudly so a reviewer notices the validator gap before the
bad artifact ships.

Seven mutation classes, one per Round-2 / Round-3 invariant:

- M1: Run.prompt_snapshot_hash flipped to a different valid-shape
  hash. Round-3 cross-check #3 (hash agreement vs pipeline.start)
  must fire.
- M2: Run.tool_schemas_snapshot_hash flipped likewise. Same
  cross-check (hash agreement) must fire.
- M3: phantom gate name appended to Run.gate_results_summary
  .gates_passed. Round-3 cross-check #5 (gate-results agreement vs
  scan of gate.check.* events) must fire.
- M4: terminal gate.run.evidence_recorded event removed from the
  ledger. Round-3 cross-check #2 (required terminal event) must
  fire.
- M5: prompt_snapshot_hash removed from pipeline.start's payload.
  Round-2 typed-payload validation (oneOf discriminator on
  pipeline.start) must fire.
- M6: fields_populated on the evidence_recorded event mutated to
  claim a field NOT populated on the Run record. Round-3
  cross-check #4 (fields_populated agreement) must fire.
- M7: sandbox_image_ref removed from the Run record while
  Run.status stays "done". Round-3 cross-check #1
  (required-for-done field) must fire.

The canonical sample on disk is never modified; each test reads it
once, applies its mutation in memory, writes the mutated copy to a
TemporaryDirectory, monkey-patches the validator module's
``ROOT`` / ``EVENT_LEDGER_DIR`` / ``RUN_RECORDS_DIR`` to point at the
temp tree, and runs ``main``.

Covers: R-FIN-031, R-FIN-032, R-FIN-033.
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
REPO_ROOT = HERE.parent

CANONICAL_RUN_ID = "run-6a665b303138"
CANONICAL_RECORD = REPO_ROOT / "ops" / "run-records" / f"{CANONICAL_RUN_ID}.json"
CANONICAL_LEDGER = REPO_ROOT / "ops" / "event-ledger" / f"{CANONICAL_RUN_ID}.jsonl"

# Load the validator module by path so the chaos suite does not
# depend on scripts/ being on sys.path.
_SPEC = importlib.util.spec_from_file_location(
    "validate_run_evidence", HERE / "validate_run_evidence.py"
)
assert _SPEC is not None and _SPEC.loader is not None
VRE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(VRE)


# A different valid-shape sha256-hex used by M1 / M2 to demonstrate
# that the hash AGREEMENT check is what fires, not the schema
# pattern check.
ALT_HASH_A = "0" * 64
ALT_HASH_B = "1" * 64


def _load_canonical_record() -> dict[str, Any]:
    return json.loads(CANONICAL_RECORD.read_text(encoding="utf-8"))


def _load_canonical_events() -> list[dict[str, Any]]:
    text = CANONICAL_LEDGER.read_text(encoding="utf-8")
    events: list[dict[str, Any]] = []
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped:
            continue
        events.append(json.loads(stripped))
    return events


class _ChaosHarness(unittest.TestCase):
    """Common harness: copy the canonical pair to a temp tree per test.

    Subclasses (or test methods) call ``mutate_and_run`` with a
    callable that mutates the loaded record + events in-place; the
    harness writes the mutated copy, redirects the validator's
    module-level path constants at the temp tree, runs ``main``, and
    returns (exit_code, stdout, stderr).
    """

    # Each test creates its own temp dir to keep mutations isolated.
    def setUp(self) -> None:
        self._tmp = TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.ledger_dir = self.root / "ops" / "event-ledger"
        self.records_dir = self.root / "ops" / "run-records"
        self.ledger_dir.mkdir(parents=True)
        self.records_dir.mkdir(parents=True)

        # Stash the validator's module-level globals so tearDown can
        # restore them. The schema cache stays at the real repo path;
        # only the data directories move.
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

    def _write_pair(
        self, record: dict[str, Any], events: list[dict[str, Any]]
    ) -> None:
        record_path = self.records_dir / f"{CANONICAL_RUN_ID}.json"
        record_path.write_text(
            json.dumps(record, sort_keys=True, indent=2), encoding="utf-8"
        )
        ledger_path = self.ledger_dir / f"{CANONICAL_RUN_ID}.jsonl"
        ledger_path.write_text(
            "\n".join(json.dumps(event, sort_keys=True) for event in events)
            + "\n",
            encoding="utf-8",
        )

    def _run_validator(self) -> tuple[int, str, str]:
        stdout, stderr = io.StringIO(), io.StringIO()
        with redirect_stdout(stdout), redirect_stderr(stderr):
            code = VRE.main()
        return code, stdout.getvalue(), stderr.getvalue()

    def assert_canonical_pair_passes_unmutated(self) -> None:
        """Sanity check: the unmutated copy validates clean.

        Run this once at the top of the suite so a failure means
        "the canonical sample broke" (clear), not "the chaos
        harness leaked state" (confusing).
        """
        record = _load_canonical_record()
        events = _load_canonical_events()
        self._write_pair(record, events)
        code, out, err = self._run_validator()
        self.assertEqual(
            code,
            0,
            msg=(
                f"canonical sample failed validation unmutated; "
                f"chaos harness cannot run. stderr={err}"
            ),
        )
        self.assertIn("validate_run_evidence OK", out)


class ChaosSanityCheck(_ChaosHarness):
    """The unmutated canonical pair must validate clean inside the harness."""

    def test_unmutated_canonical_pair_passes(self) -> None:
        self.assert_canonical_pair_passes_unmutated()


class M1MutatePromptSnapshotHash(_ChaosHarness):
    """M1: Run.prompt_snapshot_hash flipped to a different valid hash."""

    def test_validator_catches_m1(self) -> None:
        record = _load_canonical_record()
        events = _load_canonical_events()

        original = record["prompt_snapshot_hash"]
        record["prompt_snapshot_hash"] = ALT_HASH_A
        self.assertNotEqual(
            record["prompt_snapshot_hash"],
            original,
            msg="M1 setup failed: hash was not flipped",
        )

        self._write_pair(record, events)
        code, _out, err = self._run_validator()
        self.assertEqual(
            code, 1,
            msg=(
                f"M1: validator missed prompt_snapshot_hash flip "
                f"(stderr={err})"
            ),
        )
        # Round-3 cross-check 3: hash agreement vs pipeline.start.
        self.assertIn("pipeline.start.prompt_snapshot_hash", err)
        self.assertIn("does not match Run.prompt_snapshot_hash", err)


class M2MutateToolSchemasSnapshotHash(_ChaosHarness):
    """M2: Run.tool_schemas_snapshot_hash flipped to a different valid hash."""

    def test_validator_catches_m2(self) -> None:
        record = _load_canonical_record()
        events = _load_canonical_events()

        original = record["tool_schemas_snapshot_hash"]
        record["tool_schemas_snapshot_hash"] = ALT_HASH_B
        self.assertNotEqual(
            record["tool_schemas_snapshot_hash"],
            original,
            msg="M2 setup failed: hash was not flipped",
        )

        self._write_pair(record, events)
        code, _out, err = self._run_validator()
        self.assertEqual(
            code, 1,
            msg=(
                f"M2: validator missed tool_schemas_snapshot_hash flip "
                f"(stderr={err})"
            ),
        )
        # Round-3 cross-check 3: hash agreement vs pipeline.start.
        self.assertIn("pipeline.start.tool_schemas_snapshot_hash", err)
        self.assertIn("does not match Run.tool_schemas_snapshot_hash", err)


class M3PhantomGateInSummary(_ChaosHarness):
    """M3: a phantom gate name appears in Run.gate_results_summary.gates_passed."""

    def test_validator_catches_m3(self) -> None:
        record = _load_canonical_record()
        events = _load_canonical_events()

        summary = record["gate_results_summary"]
        summary["gates_passed"] = list(summary["gates_passed"]) + [
            "phantom_gate_never_fired"
        ]
        # Keep all_passed consistent with the event scan so the
        # all_passed delta does not steal the message; we want the
        # gates_passed mismatch to be the headline.

        self._write_pair(record, events)
        code, _out, err = self._run_validator()
        self.assertEqual(
            code, 1,
            msg=(
                f"M3: validator missed phantom gate in summary "
                f"(stderr={err})"
            ),
        )
        # Round-3 cross-check 5: gate-results agreement.
        self.assertIn("gate_results_summary.gates_passed", err)
        self.assertIn("phantom_gate_never_fired", err)


class M4RemoveTerminalEvidenceEvent(_ChaosHarness):
    """M4: gate.run.evidence_recorded event stripped from the ledger."""

    def test_validator_catches_m4(self) -> None:
        record = _load_canonical_record()
        events = _load_canonical_events()

        before = len(events)
        events = [
            evt for evt in events
            if evt.get("type") != "gate.run.evidence_recorded"
        ]
        self.assertLess(
            len(events), before,
            msg="M4 setup failed: no gate.run.evidence_recorded event found",
        )

        self._write_pair(record, events)
        code, _out, err = self._run_validator()
        self.assertEqual(
            code, 1,
            msg=(
                f"M4: validator missed removed terminal event "
                f"(stderr={err})"
            ),
        )
        # Round-3 cross-check 2: terminal event presence.
        self.assertIn("no gate.run.evidence_recorded event", err)


class M5DropPromptHashFromPipelineStartPayload(_ChaosHarness):
    """M5: prompt_snapshot_hash removed from pipeline.start's payload.

    The oneOf discriminator on pipeline.start declares the hash a
    required payload field; dropping it must trip Round-2's typed
    event payload validation (schema-level), separate from the
    cross-check that compares the values.
    """

    def test_validator_catches_m5(self) -> None:
        record = _load_canonical_record()
        events = _load_canonical_events()

        mutated = False
        for evt in events:
            if evt.get("type") == "pipeline.start":
                payload = evt.get("payload") or {}
                if "prompt_snapshot_hash" in payload:
                    del payload["prompt_snapshot_hash"]
                    mutated = True
        self.assertTrue(
            mutated,
            msg="M5 setup failed: no pipeline.start with prompt_snapshot_hash",
        )

        self._write_pair(record, events)
        code, _out, err = self._run_validator()
        self.assertEqual(
            code, 1,
            msg=(
                f"M5: validator missed dropped prompt_snapshot_hash on "
                f"pipeline.start payload (stderr={err})"
            ),
        )
        # The oneOf discriminator on pipeline.start declares the hash
        # required in payload. jsonschema's oneOf rejection collapses
        # the per-branch failures into a single
        # "is not valid under any of the given schemas" message that
        # cites the offending event line; the ledger line that fails
        # is the one we mutated.
        self.assertIn(
            "ops/event-ledger/run-6a665b303138.jsonl", err,
            msg=(
                "M5: expected stderr to cite the mutated ledger file, "
                f"got: {err}"
            ),
        )
        self.assertTrue(
            (
                "is not valid under any of the given schemas" in err
                or "prompt_snapshot_hash" in err
            ),
            msg=(
                "M5: expected typed-payload schema rejection (oneOf) or "
                "explicit prompt_snapshot_hash mention in stderr, "
                f"got: {err}"
            ),
        )


class M6MutateFieldsPopulatedToFalsehood(_ChaosHarness):
    """M6: fields_populated claims a field NOT populated on the Run record.

    Pick ``determinism`` because the Run record intentionally does
    not populate it (this repo runs a pure data pipeline; the
    DONE_REQUIRED_FIELDS set documents the omission). Adding it to
    the declared fields_populated must trip the agreement check.
    """

    def test_validator_catches_m6(self) -> None:
        record = _load_canonical_record()
        events = _load_canonical_events()

        # Sanity: the Run record must NOT carry the field we are
        # about to falsely declare; otherwise the mutation is a
        # no-op against the cross-check.
        self.assertNotIn(
            "determinism", record,
            msg="M6 setup invariant: canonical Run must not carry 'determinism'",
        )

        mutated = False
        for evt in events:
            if evt.get("type") == "gate.run.evidence_recorded":
                payload = evt.get("payload") or {}
                declared = list(payload.get("fields_populated", []))
                if "determinism" not in declared:
                    declared.append("determinism")
                    payload["fields_populated"] = sorted(declared)
                    mutated = True
        self.assertTrue(
            mutated,
            msg="M6 setup failed: no gate.run.evidence_recorded event",
        )

        self._write_pair(record, events)
        code, _out, err = self._run_validator()
        self.assertEqual(
            code, 1,
            msg=(
                f"M6: validator missed falsely-declared fields_populated "
                f"(stderr={err})"
            ),
        )
        # Round-3 cross-check 4: fields_populated agreement.
        self.assertIn("fields_populated", err)
        self.assertIn("does not match", err)


class M7RemoveSandboxImageRef(_ChaosHarness):
    """M7: sandbox_image_ref removed while Run.status stays "done"."""

    def test_validator_catches_m7(self) -> None:
        record = _load_canonical_record()
        events = _load_canonical_events()

        self.assertEqual(
            record.get("status"), "done",
            msg="M7 setup invariant: canonical Run must be in 'done' state",
        )
        self.assertIn(
            "sandbox_image_ref", record,
            msg="M7 setup invariant: canonical Run must carry sandbox_image_ref",
        )
        del record["sandbox_image_ref"]

        self._write_pair(record, events)
        code, _out, err = self._run_validator()
        self.assertEqual(
            code, 1,
            msg=(
                f"M7: validator missed removed sandbox_image_ref on "
                f"done Run (stderr={err})"
            ),
        )
        # Round-3 cross-check 1: required-for-done field check.
        self.assertIn("sandbox_image_ref", err)
        # Either the schema-level "required" message or the
        # cross-check's "missing required field" wording is
        # acceptable; both phrasings count as a caught mutation.
        self.assertTrue(
            (
                "missing required field 'sandbox_image_ref'" in err
                or "'sandbox_image_ref' is a required property" in err
            ),
            msg=(
                "M7: expected sandbox_image_ref required-field error, "
                f"got: {err}"
            ),
        )


class MutationCoverageManifest(unittest.TestCase):
    """Document the mutation-class coverage as a test so the count
    cannot drift silently. If a future change adds or removes a
    mutation, this assertion forces the manifest to update too.
    """

    EXPECTED_MUTATION_CLASSES = (
        "M1MutatePromptSnapshotHash",
        "M2MutateToolSchemasSnapshotHash",
        "M3PhantomGateInSummary",
        "M4RemoveTerminalEvidenceEvent",
        "M5DropPromptHashFromPipelineStartPayload",
        "M6MutateFieldsPopulatedToFalsehood",
        "M7RemoveSandboxImageRef",
    )

    def test_seven_mutation_classes_present(self) -> None:
        # Walk the current module's globals for TestCase subclasses
        # whose name starts with "M" + digit; assert the set matches.
        import sys

        module = sys.modules[__name__]
        found = sorted(
            name for name in dir(module)
            if name.startswith("M")
            and len(name) >= 2
            and name[1].isdigit()
            and isinstance(getattr(module, name), type)
            and issubclass(getattr(module, name), _ChaosHarness)
        )
        self.assertEqual(
            found,
            sorted(self.EXPECTED_MUTATION_CLASSES),
            msg=(
                "Mutation-class manifest drift: update "
                "EXPECTED_MUTATION_CLASSES when adding or removing a class"
            ),
        )
        self.assertEqual(
            len(self.EXPECTED_MUTATION_CLASSES), 7,
            msg="DEC-FIN-010 pins the chaos suite at seven mutation classes",
        )


if __name__ == "__main__":
    unittest.main()
