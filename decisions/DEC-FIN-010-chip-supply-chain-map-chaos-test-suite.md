---
id: DEC-FIN-010-chip-supply-chain-map-chaos-test-suite
amends: DEC-FIN-009-additional-scenarios
spec: specs/0002-earnings-sensitivity-overlay/
requirement: R-FIN-031
date: 2026-05-29
status: approved
reversible: true
decision: |
  chip-supply-chain-map installs a chaos test suite at
  `scripts/test_chaos_run_evidence.py` that loads the canonical
  sample pair (`ops/run-records/run-6a665b303138.json` plus
  `ops/event-ledger/run-6a665b303138.jsonl`), applies one mutation
  per Round-2 / Round-3 invariant to a copy in a temp tree, runs
  `scripts/validate_run_evidence.py` against the mutated copy, and
  asserts the validator EXITS NON-ZERO with a stderr line that
  names the right check. The suite covers seven mutation classes:

  - M1 flips `Run.prompt_snapshot_hash` to a different valid-shape
    sha256-hex; Round-3 cross-check #3 (hash agreement vs
    `pipeline.start`) must fire.
  - M2 flips `Run.tool_schemas_snapshot_hash` to a different
    valid-shape sha256-hex; the same hash-agreement check must fire
    on the second field.
  - M3 appends a phantom gate name to
    `Run.gate_results_summary.gates_passed`; Round-3 cross-check #5
    (gate-results agreement vs scan of `gate.check.*` events) must
    fire.
  - M4 strips the terminal `gate.run.evidence_recorded` event from
    the ledger; Round-3 cross-check #2 (required terminal event)
    must fire.
  - M5 removes `prompt_snapshot_hash` from the `pipeline.start`
    event's payload; Round-2 typed-payload validation (the
    `pipeline.start` branch of the event-schema `oneOf`
    discriminator) must fire.
  - M6 adds `determinism` to
    `gate.run.evidence_recorded.payload.fields_populated` while
    the Run record does not populate that field; Round-3
    cross-check #4 (fields_populated agreement) must fire.
  - M7 removes `sandbox_image_ref` from the Run record while
    `Run.status` stays `"done"`; Round-3 cross-check #1
    (required-for-done field) must fire.

  The suite also carries a sanity test that asserts the unmutated
  canonical pair validates clean inside the harness (so a chaos
  failure means a real mutation gap, not harness state leak) plus
  a manifest assertion that pins the class count at seven so a
  future drop is caught at test time.

  The canonical sample on disk is never modified; each test reads
  the canonical files once, applies the mutation in memory, writes
  the mutated copy to a `TemporaryDirectory`, monkey-patches the
  validator module's `ROOT` / `EVENT_LEDGER_DIR` / `RUN_RECORDS_DIR`
  to point at the temp tree, and runs `main`. The harness pattern
  mirrors the per-class temp-tree harness in
  `scripts/test_validate_run_evidence.py`.

  CI wiring: the chaos suite runs in two places. (a) The existing
  `Gates` job in `.github/workflows/gates.yml` runs
  `python -m unittest scripts.test_chaos_run_evidence` as a
  validator unit-test step alongside the existing
  `validate_run_evidence_tests` step. (b) A dedicated
  `chaos-validation` job in
  `.github/workflows/run-evidence-gates.yml` runs the suite on
  `ubuntu-latest` with Python 3.11. Both are contract gates with
  no `continue-on-error: true` and no failure-masking conditionals.
alternatives:
  - label: stop at `test_validate_run_evidence.py`'s synthetic fixtures
    rejected_because: |
      The existing test module builds synthetic Run + ledger
      fixtures from scratch and asserts the cross-checks fire on
      hand-rolled mutations. That coverage proves the cross-check
      code paths exist, but it does not prove the validator catches
      mutations against the SHIPPED canonical sample. A mutation
      against the synthetic fixture is one degree removed from the
      artifact a reviewer reads. The chaos suite closes the loop:
      it mutates the same JSON bytes that the replay-smoke and
      packet-generation gates consume, so a regression in the
      validator's behavior against the real sample shape gets
      caught immediately.
  - label: write the chaos suite as a shell script that diffs
      validator output across mutations
    rejected_because: |
      A shell script would have to parse stderr by string match,
      duplicate the harness's temp-tree monkey-patch logic in
      bash, and re-implement the JSON mutation step in `jq`. The
      Python unittest form re-uses the existing
      `test_validate_run_evidence.py` harness pattern verbatim,
      keeps the assertions next to the mutation that produced
      them, and stays runnable under `python -m unittest` like
      every other test in this repo. The shell variant would also
      lose the manifest assertion that pins the class count.
  - label: fold the chaos suite into
      `scripts/test_validate_run_evidence.py`
    rejected_because: |
      That file's existing test classes assert on synthetic
      fixtures and document the per-cross-check failure shape from
      first principles. The chaos suite asserts on mutations
      against the canonical sample and documents the
      mutation-class coverage manifest. The two suites have
      different reading audiences and different invariants;
      keeping them as sibling files makes each one easier to
      review independently and lets the CI step list name the
      chaos coverage explicitly.
  - label: add the chaos step only to `run-evidence-gates.yml`
    rejected_because: |
      The other validator unit tests already run inside
      `gates.yml` next to `validate_run_evidence_tests`. Splitting
      the chaos step into a separate workflow would mean a
      `gates.yml` green build does not prove the
      validator catches mutations, which is the worst case for a
      reviewer scanning the gate list. Running the chaos suite in
      BOTH workflows costs one extra Python install per CI run
      and makes the coverage visible on every PR.
rationale: |
  Round 4 (workflow F) is the closing pass of the engineering-grade
  rollout. Round 2 added typed payload schemas via the `oneOf`
  discriminator on the eight canonical event types. Round 3 added
  the five cross-checks in `validate_run_evidence.py` plus the
  required-for-done field check. Each round shipped tests that
  exercise the validator code paths on synthetic fixtures. None of
  those tests prove the validator catches mutations against the
  SHIPPED canonical sample, which is the artifact every other
  gate (replay-smoke, packet-generation, packet-validation,
  replay-determinism) reads.

  Without the chaos suite, the validator could regress silently:
  a refactor could drop a cross-check, a schema cache refresh could
  loosen the `oneOf` discriminator, or a `_is_populated` rewrite
  could let an empty list count as populated. Each of those
  regressions would let a mutated artifact pass validation, and
  every downstream gate that trusts the validator's pass output
  would inherit the gap.

  The chaos suite is the inverse-coverage test: for each Round-2 /
  Round-3 invariant, it constructs the simplest possible mutation
  that should trip the check, runs the validator, and asserts
  exit code 1 plus a stderr line that names the check. If a
  mutation slips through, the test fails loudly with a message
  that points at the missing check. The suite is cheap to run (one
  Python process per test, 9 tests, sub-second wall time) and is
  cheap to extend (one new class per new invariant), so the cost
  of keeping it green stays proportional to the cost of adding
  invariants.

  Reversible per the standard DEC contract: the chaos suite is a
  single new test file plus two CI step additions. Reverting is a
  delete of the file plus the step removals. R-FIN-031..033 come
  out of `requirements.md` and `traceability.md` in the same
  revert.
evidence:
  - kind: decision
    ref: decisions/DEC-FIN-003-watchlist-export-emits-conformant-run-evidence.md
  - kind: decision
    ref: decisions/DEC-FIN-004-watchlist-export-run-evidence-cross-checks.md
  - kind: decision
    ref: decisions/DEC-FIN-007-chip-supply-chain-map-ci-enforces-run-evidence-chain.md
  - kind: decision
    ref: decisions/DEC-FIN-009-additional-scenarios.md
  - kind: doc
    ref: scripts/test_chaos_run_evidence.py
  - kind: doc
    ref: scripts/validate_run_evidence.py
  - kind: doc
    ref: scripts/test_validate_run_evidence.py
  - kind: doc
    ref: .github/workflows/gates.yml
  - kind: doc
    ref: .github/workflows/run-evidence-gates.yml
  - kind: doc
    ref: ops/run-records/run-6a665b303138.json
  - kind: doc
    ref: ops/event-ledger/run-6a665b303138.jsonl
  - kind: spec
    ref: specs/0002-earnings-sensitivity-overlay/requirements.md
rollback: |
  Delete `scripts/test_chaos_run_evidence.py`. Remove the
  `chaos_run_evidence_tests` step from
  `.github/workflows/gates.yml`. Remove the `chaos-validation`
  job from `.github/workflows/run-evidence-gates.yml`. Remove
  `R-FIN-031`, `R-FIN-032`, and `R-FIN-033` from
  `specs/0002-earnings-sensitivity-overlay/requirements.md` and
  the matching rows from
  `specs/0002-earnings-sensitivity-overlay/traceability.md`. The
  canonical sample on disk needs no edits because the chaos
  suite never modified it.
owner: control.coordinator
systems_map: |
  Inverse-coverage chaos testing of a validator against its shipped
  canonical sample. The system under test is the chain of trust between
  the run-evidence producer (export CLI) and every downstream consumer
  (replay, packet generation, packet validation); each mutation class
  models a silent regression mode in that chain.
transferable_principle: |
  Any validator that gates a downstream artifact graph should ship an
  inverse-coverage chaos suite — one mutation per invariant against the
  canonical sample — so a regression in the validator is caught at test
  time, not by a quietly accepted bad artifact downstream.
falsification_test: |
  If the seven mutation classes pass against a validator build that
  later admits a hand-crafted real-world mutation (a different mutation
  class found in the wild), the seven-class manifest is incomplete and
  the suite needs an M8 extension; the test count is the falsification
  surface.
adoption_ladder:
  minimum_viable: |
    Seven mutation classes M1..M7 plus the unmutated sanity check, run
    via python -m unittest in the Gates job.
  mid_adoption: |
    A dedicated chaos-validation CI job in run-evidence-gates.yml plus a
    manifest assertion pinning the class count at seven.
  full_adoption: |
    Every new validator cross-check ships with a paired chaos mutation
    class in the same PR; the manifest count moves with the cross-check
    count and CI fails on drift.
  monitoring_signals:
    - chaos suite green or red per CI run
    - mutation-class count vs validator cross-check count (manifest test)
    - any new field added to the canonical sample without a paired
      mutation class
---

## decision

chip-supply-chain-map installs a chaos test suite at
`scripts/test_chaos_run_evidence.py` covering seven mutation
classes that verify `scripts/validate_run_evidence.py` catches
each mutation against the shipped canonical sample
(`run-6a665b303138`). The seven classes map one-to-one onto the
Round-2 typed-payload validation rule plus the five Round-3
cross-checks plus the required-for-done field rule:

- M1 / M2 trip the hash-agreement cross-check on the two snapshot
  hashes carried by the Run record.
- M3 trips the gate-results-summary agreement cross-check.
- M4 trips the required-terminal-event cross-check.
- M5 trips the `pipeline.start` typed-payload branch of the
  event-schema `oneOf` discriminator.
- M6 trips the fields_populated agreement cross-check.
- M7 trips the required-for-done field check on
  `sandbox_image_ref`.

CI runs the suite in two places: the `Gates` job in
`.github/workflows/gates.yml` (next to the existing
`validate_run_evidence_tests` step) and a dedicated
`chaos-validation` job in
`.github/workflows/run-evidence-gates.yml`. Both are contract
gates with no `continue-on-error` and no failure-masking
conditionals.

## alternatives

- Stop at the synthetic-fixture tests in
  `test_validate_run_evidence.py`: rejected because those tests
  prove the cross-check code paths exist but do not prove the
  validator catches mutations against the shipped canonical
  sample, which is the artifact downstream gates consume.
- Write the chaos suite as a shell script: rejected because shell
  would re-implement the harness logic in bash and lose the
  manifest assertion.
- Fold the chaos suite into `test_validate_run_evidence.py`:
  rejected because the two suites have different invariants and
  audiences; keeping them as sibling files makes each one easier
  to review.
- Add the chaos step only to `run-evidence-gates.yml`: rejected
  because a green `gates.yml` build should not pass without
  proving the validator catches mutations.

## rationale

Round 4 is the closing pass of the engineering-grade rollout.
Without the chaos suite, the validator could regress silently:
a refactor could drop a cross-check, a schema refresh could
loosen the `oneOf` discriminator, or a `_is_populated` rewrite
could let an empty list count as populated. The chaos suite is
the inverse-coverage test: for each invariant, it builds the
simplest mutation that should trip the check, runs the
validator, and asserts exit code 1 plus a stderr line that names
the check. If a mutation slips through, the test fails loudly.

The suite is cheap to run (9 tests, sub-second wall time) and
cheap to extend (one new class per new invariant), so the cost
of keeping it green stays proportional to the cost of adding
invariants.

The change is reversible: a single new test file plus two CI
step additions. Reverting is a delete of the file plus the step
removals.

## evidence

- `scripts/test_chaos_run_evidence.py` carries the seven
  mutation-class test classes plus the unmutated-canonical
  sanity check plus the manifest assertion.
- `scripts/validate_run_evidence.py` is the system under test.
- `.github/workflows/gates.yml` carries the
  `chaos_run_evidence_tests` step.
- `.github/workflows/run-evidence-gates.yml` carries the
  `chaos-validation` job.
- `ops/run-records/run-6a665b303138.json` and
  `ops/event-ledger/run-6a665b303138.jsonl` are the canonical
  sample the suite mutates.

## rollback

Delete `scripts/test_chaos_run_evidence.py`. Remove the
`chaos_run_evidence_tests` step from `.github/workflows/gates.yml`.
Remove the `chaos-validation` job from
`.github/workflows/run-evidence-gates.yml`. Remove `R-FIN-031`,
`R-FIN-032`, and `R-FIN-033` from
`specs/0002-earnings-sensitivity-overlay/requirements.md` and the
matching rows from
`specs/0002-earnings-sensitivity-overlay/traceability.md`. The
canonical sample on disk needs no edits.

## coverage

This DEC resolves the following requirements added to spec 0002:

- `R-FIN-031` chip-supply-chain-map ships
  `scripts/test_chaos_run_evidence.py` with seven mutation-class
  test classes (M1 through M7) that load the canonical sample
  pair, apply one mutation per Round-2 / Round-3 invariant, run
  `scripts/validate_run_evidence.py` against the mutated copy,
  and assert exit code 1 plus a stderr line that names the right
  check.
- `R-FIN-032` the chaos suite carries a sanity test that asserts
  the unmutated canonical pair validates clean inside the harness
  plus a manifest assertion that pins the class count at seven
  so a future drop fails at test time.
- `R-FIN-033` the chaos suite runs in CI as a contract gate in
  both `.github/workflows/gates.yml` (as
  `chaos_run_evidence_tests`) and
  `.github/workflows/run-evidence-gates.yml` (as a dedicated
  `chaos-validation` job on `ubuntu-latest` with Python 3.11)
  with no `continue-on-error: true` and no failure-masking
  conditionals.
