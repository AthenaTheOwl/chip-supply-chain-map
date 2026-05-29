---
id: DEC-FIN-008-chip-map-dedicated-determinism-fixture
amends: DEC-FIN-007-chip-supply-chain-map-ci-enforces-run-evidence-chain
spec: specs/0002-earnings-sensitivity-overlay/
requirement: R-FIN-025
date: 2026-05-29
status: approved
reversible: true
decision: |
  chip-supply-chain-map adds a dedicated multi-rerun determinism
  fixture for the watchlist-export replay command plus an explicit
  CI job that runs it as a contract gate. The fixture lives at
  `scripts/test_replay_determinism.py` (Python unittest, matching
  the existing test framework). The CI job lives at
  `.github/workflows/run-evidence-gates.yml` as a separate
  `replay-determinism` job stanza modeled on
  procurement-negotiation-lab's `replay-determinism` job.

  The fixture:

  - Reads `ops/run-records/run-6a665b303138.json`, extracts the
    sandbox SHA from `sandbox_image_ref` (parses the `repo://` URI
    grammar from DEC-FIN-006), saves the finalized Run record from
    main HEAD, checks out the recorded sandbox SHA, restores the
    saved record over the working tree at that SHA, runs
    `python scripts/replay_run.py --run-id run-6a665b303138` RERUNS
    times (default 3 via env), reads each fresh replay record
    under `ops/replay-records/run-6a665b303138/<replay-event-id>.json`,
    and asserts every replay carries `verdict == "byte_equal"` AND
    every `replayed_packet_hash` matches the recorded
    `committed_packet_hash` AND the canonical tuple
    `(replayed_packet_hash, recomputed_prompt_snapshot_hash,
    recomputed_tool_schemas_snapshot_hash)` hashes to the same
    SHA-256 across every rerun.
  - Canonicalizes per rerun by JSON-encoding the tuple with
    `sort_keys=True` and `separators=(",", ":")` and SHA-256 hashing
    the byte string.
  - On hash divergence, writes a failure bundle at
    `artifacts/failbundles/determinism_failure.json` plus
    `trace_0.json` and `trace_1.json` for the first two diverging
    canonical traces, then fails the test with the bundle path.
  - Restores the original HEAD in teardown and deletes any replay
    records and ledger files the fixture created so the working
    tree returns to its starting state.

  This DEC also fixes a latent per-second timestamp collision in
  `scripts/replay_run.py`'s `emit_replay_event`. The earlier
  filename shape `replay-<run-id>-<safe-ts>.jsonl` carried only
  second resolution; two replays inside the same wall-clock second
  collided on the ledger filename. The new shape
  `replay-<run-id>-<safe-ts>-<replay-event-id>.jsonl` suffixes the
  per-replay UUID so rapid back-to-back replays land on distinct
  files. The replay-record path
  `ops/replay-records/<run-id>/<replay-event-id>.json` already
  carried the UUID and did not collide.

  The `replay-determinism` CI job runs on `ubuntu-latest` with
  Python 3.11, checks out chip-supply-chain-map with
  `fetch-depth: 0` so the sandbox SHA is reachable, installs
  `node@20` for the export sub-process the fixture shells out to,
  installs the gate-script dependencies, runs `npm ci` for the
  Node modules, and runs the fixture via
  `python -m unittest scripts.test_replay_determinism` with
  `RERUNS=3`. No `continue-on-error: true` and no
  `if: ${{ failure() }}` escape hatch sits on the job. A failure
  bundle upload step runs on failure to capture
  `artifacts/failbundles/` for review.
alternatives:
  - label: extend `scripts/test_replay_run.py` with a multi-rerun case
    rejected_because: |
      `test_replay_run.py` is the producer-side integration test
      that covers the four single-replay contract branches
      (positive, HEAD mismatch, missing record, input drift) plus
      the URI parser branches. Folding a multi-rerun determinism
      case into that file blurs the contract boundary: the
      integration test stubs `_git_head_sha` and `run_export` to
      drive isolated temp directories, while the determinism
      fixture must shell out to the real `replay_run.py` against
      real `ops/` paths after a real `git checkout`. Keeping the
      two test files separate makes the contract boundary legible
      from the test set alone.
  - label: skip the timestamp-collision fix and rely on event UUIDs
    rejected_because: |
      The replay-record path already carries the UUID and does not
      collide, but the per-replay ledger path
      `ops/event-ledger/replay-<run-id>-<safe-ts>.jsonl` carried
      only second resolution. Under the 3-rerun determinism
      fixture each replay completes in well under a second, so
      two ledger files would map onto the same path and the
      second write would silently overwrite the first. Suffixing
      the UUID is the smallest fix that preserves the
      `replay-<run-id>-*.jsonl` glob the existing test_replay_run
      cases already match.
  - label: fold replay-determinism into the existing packet-and-replay job
    rejected_because: |
      The existing `packet-and-replay` job in
      `run-evidence-gates.yml` checks out chip-supply-chain-map
      plus the sibling trace-to-eval-harness repo so it can run
      packet-generation, packet-validation, and replay-smoke
      end-to-end. The determinism fixture does not need the
      sibling repo and does need a 3-rerun budget plus a failure
      bundle upload on failure. Keeping the determinism gate in a
      separate job matches procurement-negotiation-lab's pattern
      and makes the contract gate independently retryable.
rationale: |
  This DEC amends DEC-FIN-007. Round 7 Phase 2 wired the
  DEC-CDCP-015 CI contract into chip-supply-chain-map: schema
  cache freshness, voice lint, BOM, spec check, decisions, typed
  event payload validation with Run/Event cross-checks, the
  Python and TypeScript test runners, packet generation, packet
  validation, and replay-smoke. The replay-smoke gate proves the
  recorded sandbox SHA still produces the run it claims to, but
  it runs the replay once. The DEC-CDCP-015 contract framing in
  procurement-negotiation-lab (DEC-FACTORY-010 in that repo) calls
  out the multi-rerun determinism case as a separate contract:
  a one-shot replay does not catch drift across two nominally
  identical replay invocations.

  Workflow B's audit caught chip-supply-chain-map missing the
  dedicated fixture: `scripts/test_replay_run.py` is the
  producer-side integration test (eleven cases covering HEAD
  mismatch, input drift, URI parsing) but no test exercises the
  three-rerun canonical-hash agreement contract. This DEC closes
  that gap.

  The fixture mirrors procurement-negotiation-lab's
  `tests/factory/test_replay_determinism.py` pattern adapted to
  chip-supply-chain-map's framing:

  - chip-map records the three replay-equivalence hashes under
    `comparison.replayed_packet_hash`,
    `comparison.recomputed_prompt_snapshot_hash`, and
    `comparison.recomputed_tool_schemas_snapshot_hash` on each
    replay report. procurement-lab uses a different schema
    (`field_comparison.<field>.fresh`) because its replay
    framing is equivalence-based, not byte-equal. The fixture
    extracts the chip-map shape directly.
  - chip-map's tests live under `scripts/` (matching
    `scripts/test_replay_run.py`,
    `scripts/test_validate_run_evidence.py`,
    `scripts/test_finalize_sandbox_ref.py`) so the new fixture
    lands at `scripts/test_replay_determinism.py` to match the
    convention. procurement-lab's lives under `tests/factory/`.
  - chip-map's replay is byte-equal (the watchlist-export
    pipeline is a pure function of four input files plus the
    heuristic config) so the canonical-hash agreement check
    layers on top of a per-rerun `verdict == "byte_equal"` plus
    `replayed_packet_hash == committed_packet_hash` check. A
    rerun that flipped to `byte_diff` would fail before the
    canonical-hash check fires.

  The timestamp-collision fix is included in this DEC because
  the fixture is what exposes the bug: a one-shot replay (the
  CI replay-smoke gate, the existing `test_replay_run` cases)
  never triggers it; the 3-rerun fixture does. The fix is a
  one-line filename change that preserves the existing
  `replay-<run-id>-*.jsonl` glob the eleven existing test cases
  match against.

  Keeping the change reversible per the standard DEC contract:
  the new test file is additive, the CI job is a new stanza in
  an existing workflow file, the timestamp-collision fix is a
  one-line filename change in `emit_replay_event`. No
  TypeScript source code changed.
evidence:
  - kind: decision
    ref: decisions/DEC-FIN-007-chip-supply-chain-map-ci-enforces-run-evidence-chain.md
  - kind: doc
    ref: scripts/test_replay_determinism.py
  - kind: doc
    ref: scripts/replay_run.py
  - kind: doc
    ref: .github/workflows/run-evidence-gates.yml
  - kind: doc
    ref: ops/run-records/run-6a665b303138.json
  - kind: doc
    ref: ops/event-ledger/run-6a665b303138.jsonl
  - kind: spec
    ref: specs/0002-earnings-sensitivity-overlay/requirements.md
rollback: |
  Delete `scripts/test_replay_determinism.py`, revert the
  one-line filename change in `emit_replay_event` inside
  `scripts/replay_run.py`, and delete the `replay-determinism`
  job stanza from `.github/workflows/run-evidence-gates.yml`.
  `R-FIN-025` through `R-FIN-027` come out of `requirements.md`
  and `traceability.md` in the same revert. The universal gates
  in `gates.yml` and the existing `packet-and-replay` job in
  `run-evidence-gates.yml` keep running. No TypeScript source
  code changed.
owner: control.coordinator
systems_map: |
  Multi-rerun determinism proof for a replay pipeline. The system under
  test is the byte-equivalence guarantee of replay_run.py across
  repeated invocations at the same sandbox SHA; the fixture canonicalizes
  the three replay-equivalence hashes per rerun and asserts SHA-256
  agreement across the set.
transferable_principle: |
  Any deterministic pipeline that ships a single-shot integration test
  is one rerun-loop away from a determinism fixture; the producer-side
  contract test (single replay) and the determinism fixture (N replays)
  cover different invariants and belong as sibling test files.
falsification_test: |
  If three reruns of the canonical sample at the recorded sandbox SHA
  ever produce a tuple-hash divergence, the determinism claim is
  falsified; the fixture writes a failbundle naming the first two
  diverging traces so the diff is the empirical evidence.
adoption_ladder:
  minimum_viable: |
    A single fixture file running RERUNS=2 against the canonical
    sample, asserting tuple-hash equality.
  mid_adoption: |
    RERUNS=3 default, failbundle generation on divergence, dedicated CI
    job stanza separate from the smoke-test job.
  full_adoption: |
    Every shipped Run record has a determinism job covering it;
    failbundles auto-upload to artifacts on failure; the CI job time
    budget pins the upper-bound RERUNS that fits.
  monitoring_signals:
    - replay-determinism CI job pass/fail
    - failbundle uploads per week
    - per-rerun wall-clock time trend (cost of the contract)
---

## decision

chip-supply-chain-map adds a dedicated multi-rerun determinism
fixture for the watchlist-export replay command at
`scripts/test_replay_determinism.py` plus an explicit
`replay-determinism` CI job in
`.github/workflows/run-evidence-gates.yml`. The DEC also fixes a
per-second timestamp collision in
`scripts/replay_run.py`'s `emit_replay_event` by suffixing the
per-replay UUID onto the ledger filename.

The fixture replays the canonical sample `run-6a665b303138`
RERUNS times (default 3) at the recorded sandbox SHA and asserts
every replay carries `verdict == "byte_equal"`, every
`replayed_packet_hash` matches the committed packet hash, and the
canonical tuple
`(replayed_packet_hash, recomputed_prompt_snapshot_hash,
recomputed_tool_schemas_snapshot_hash)` hashes to the same SHA-256
across every rerun. On divergence the fixture writes a failure
bundle to `artifacts/failbundles/`.

The CI job runs on `ubuntu-latest` with Python 3.11 and Node 20,
checks out chip-supply-chain-map with `fetch-depth: 0`, installs
the gate-script dependencies plus the Node modules, runs the
fixture via `python -m unittest scripts.test_replay_determinism`
with `RERUNS=3`, and uploads
`artifacts/failbundles/` on failure. No escape hatch sits on the
job.

## alternatives

- Extend `scripts/test_replay_run.py` with a multi-rerun case:
  rejected because `test_replay_run.py` is the producer-side
  integration test that drives crafted temp directories with
  stubbed `git` and `node`; the determinism fixture must shell out
  to the real `replay_run.py` against real `ops/` paths after a
  real `git checkout`. Separate files keep the contract boundary
  legible.
- Skip the timestamp-collision fix and rely on the event UUID on
  the replay-record path: rejected because the per-replay ledger
  path carried only second resolution and would silently overwrite
  itself under the 3-rerun fixture.
- Fold replay-determinism into the existing `packet-and-replay`
  job: rejected because the determinism fixture does not need the
  sibling trace-to-eval-harness checkout and the determinism gate
  reads cleaner as an independently retryable job.

## rationale

Round 7 Phase 2 wired the DEC-CDCP-015 CI contract into
chip-supply-chain-map. The replay-smoke gate proves the recorded
sandbox SHA still produces the run it claims to, but it runs the
replay once. A one-shot replay does not catch drift across two
nominally identical replay invocations; that case wants a
dedicated multi-rerun fixture with canonical-hash agreement.

Workflow B's audit caught chip-supply-chain-map missing the
fixture. `scripts/test_replay_run.py` is the producer-side
integration test (eleven cases covering HEAD mismatch, input
drift, URI parsing) but no test exercises the three-rerun
canonical-hash agreement contract. This DEC closes that gap by
adding `scripts/test_replay_determinism.py` as a dedicated
unittest module plus a `replay-determinism` CI job that runs it
as a contract gate.

The fixture mirrors procurement-negotiation-lab's pattern adapted
to chip-supply-chain-map's framing: chip-map records the three
replay-equivalence hashes under `comparison.*` on the replay
report (byte-equal framing); procurement-lab uses
`field_comparison.<field>.fresh` (equivalence framing). The
fixture extracts the chip-map shape directly. chip-map's tests
live under `scripts/` so the new fixture lands at
`scripts/test_replay_determinism.py` to match the convention.

The timestamp-collision fix is included here because the fixture
is what exposes the bug: a one-shot replay (the CI replay-smoke
gate, the existing `test_replay_run` cases) never triggers it;
the 3-rerun fixture does. The fix suffixes the per-replay UUID on
the ledger filename so two replays inside the same wall-clock
second land on distinct files. The existing
`replay-<run-id>-*.jsonl` glob the eleven existing test cases
match against still matches.

## evidence

- `scripts/test_replay_determinism.py` is the new fixture
  (Python unittest, matching the existing test framework).
- `scripts/replay_run.py` carries the one-line filename change
  inside `emit_replay_event`.
- `.github/workflows/run-evidence-gates.yml` carries the new
  `replay-determinism` job stanza with `fetch-depth: 0`, Python
  3.11, Node 20, `RERUNS=3`, and a failure-bundle upload step.
- `ops/run-records/run-6a665b303138.json` is the canonical sample
  the fixture targets; its `sandbox_image_ref` carries the
  resolved SHA `86d22482fb8a7425b3edfad99020f83deefec734`.

## rollback

Delete `scripts/test_replay_determinism.py`, revert the one-line
filename change in `emit_replay_event` inside
`scripts/replay_run.py`, and delete the `replay-determinism` job
stanza from `.github/workflows/run-evidence-gates.yml`.
`R-FIN-025` through `R-FIN-027` come out of `requirements.md` and
`traceability.md` in the same revert. The universal gates and the
existing `packet-and-replay` job keep running. No TypeScript
source code changed.

## coverage

This DEC resolves the following requirements added to spec 0002:

- `R-FIN-025` chip-supply-chain-map ships a dedicated multi-rerun
  determinism fixture at `scripts/test_replay_determinism.py`
  that replays the canonical sample RERUNS times (default 3 via
  env) and asserts canonical-hash agreement across every rerun.
- `R-FIN-026` the per-replay ledger filename in
  `emit_replay_event` carries the per-replay UUID so rapid
  back-to-back replays inside the same wall-clock second do not
  collide on the second-resolution timestamp.
- `R-FIN-027` `.github/workflows/run-evidence-gates.yml` carries
  a `replay-determinism` job as a contract gate with no
  `continue-on-error: true` and no `if: ${{ failure() }}` escape
  hatch, running on `ubuntu-latest` with Python 3.11 and Node 20
  via `python -m unittest scripts.test_replay_determinism` with
  `RERUNS=3`.
