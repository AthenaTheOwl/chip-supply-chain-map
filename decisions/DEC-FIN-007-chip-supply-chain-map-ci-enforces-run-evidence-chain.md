---
id: DEC-FIN-007-chip-supply-chain-map-ci-enforces-run-evidence-chain
amends: DEC-FIN-006-watchlist-export-portable-repo-uri-migration
spec: specs/0002-earnings-sensitivity-overlay/
requirement: R-FIN-021
date: 2026-05-29
status: approved
reversible: true
decision: |
  chip-supply-chain-map's CI enforces the run-evidence chain on
  every pull request targeting main and every push to main. The
  workflow set carries the DEC-CDCP-015 (athena-site) contract
  end-to-end with no escape hatches:

  - `.github/workflows/gates.yml` runs the universal Python gates:
    `check_schema_cache_freshness.py`, `voice_lint.py`,
    `check_no_bom.py`, `spec_check.py`, `validate_decisions.py`,
    `validate_roles.py`, `validate_tools.py`,
    `validate_policies.py`, `validate_dreams.py`,
    `validate_run_evidence.py` (typed event payload validation +
    Round 3 Run/Event cross-checks), plus the Python test runner
    (`unittest scripts.test_validate_run_evidence`,
    `scripts.test_replay_run`, `scripts.test_finalize_sandbox_ref`),
    and the data-freshness gate (`check_data_freshness.py`).
  - `.github/workflows/build.yml` runs `npm ci`, `npm test`, and
    `npm run build` to cover the TypeScript-side language test
    runner (`history.test.ts`, `riskPacket.test.ts`,
    `runEvidence.test.ts`).
  - `.github/workflows/run-evidence-gates.yml` adds the three
    product-side contract gates from DEC-CDCP-015 that did not
    exist before: packet-generation-from-canonical-sample (clones
    the trace-to-eval bridge repo as a sibling, `pip install -e`
    it, runs `python -m trace_to_eval evidence from-cdcp-events`
    over the canonical sample ledger with `--portfolio-root`
    pointed at the GitHub workspace), packet-validation (`python
    -m trace_to_eval evidence validate` over the produced packet),
    and replay-smoke (extracts the 40-char sandbox SHA from
    `Run.sandbox_image_ref` via `jq` + `grep -oE`, checks out that
    SHA with `fetch-depth: 0`, restores the finalized Run record
    over the working tree at that SHA so the replay command does
    not refuse a stale PENDING placeholder from before the
    finalizer commit, then runs `python scripts/replay_run.py
    --run-id run-6a665b303138` expecting `replay_equivalent: true`).

  The canonical sample is `run-6a665b303138`. No
  `continue-on-error: true` and no `if: ${{ failure() }}` escape
  hatch sits on any listed contract gate. Hooks are not skipped
  on commit (`--no-verify` is out). The runner is `ubuntu-latest`
  with Python 3.11 and Node 20.
alternatives:
  - label: add the three new gates to the existing `gates.yml`
    rejected_because: |
      `gates.yml` runs only `actions/setup-python@v5` and the
      universal Python validators. Adding the bridge-repo sibling
      checkout, the Node setup for the export sub-process
      replay-smoke shells out to, and the multi-step packet flow
      to that job blurs the contract boundary. Keeping the new
      gates in their own workflow makes the DEC-CDCP-015 contract
      legible from the workflow set alone: one workflow per
      contract layer.
  - label: run packet generation + validation but skip replay-smoke
    rejected_because: |
      Replay-smoke is the gate that catches the case where a
      recorded sandbox SHA stops producing the run it claims to
      (DEC-CDCP-015 names this case). Round 6's PENDING + finalizer
      pattern survives only if a CI gate exercises the resolved
      SHA on every push; dropping replay-smoke would re-open the
      drift window Round 6 closed.
  - label: invoke the trace-to-eval bridge from a vendored copy
    rejected_because: |
      Vendoring couples chip-supply-chain-map's CI to a frozen
      snapshot of the bridge repo; consumer-side schema or CLI
      changes land in the trace-to-eval bridge repo and would
      silently miss this repo. Checking the bridge repo out as a
      sibling on every CI run mirrors the local development layout
      and surfaces drift the first time it lands.
  - label: relax replay-smoke when the recorded Run record carries PENDING at the sandbox SHA
    rejected_because: |
      Replay must succeed against the resolved SHA; the PENDING
      placeholder is a producer-side bookkeeping state, not a
      replay-eligible record. The workflow restores the finalized
      Run record from main HEAD over the working tree at the
      checked-out sandbox SHA so the producer code + inputs at
      that SHA replay against the truth. Refusing to gate on
      PENDING outright would weaken the replay contract; restoring
      the finalized record keeps the contract honest.
rationale: |
  This DEC amends DEC-FIN-006. Round 6 fixed the sandbox-SHA
  off-by-one at the root via the PENDING + finalizer pattern and
  shipped the URI emitter + validator + replay support. Round 7
  Phase 1 (DEC-CDCP-015 in athena-site) defined the CI enforcement
  contract: the v2 producer + consumer chain holds at landing time
  but nothing prevents subsequent drift. Round 7 Phase 2 wires the
  contract into this repo.

  The three new product gates close the loop:

  1. `packet-generation-from-canonical-sample` proves the canonical
     ledger remains readable by the consumer-side bridge repo,
     which was the case Codex's v2 review named explicitly.
  2. `packet-validation` proves the packet schema contract holds at
     the review boundary on every push.
  3. `replay-smoke` proves the recorded sandbox SHA is reachable
     and replay against it remains byte-equal — the case the
     finalizer pattern was built to keep honest.

  The workflow set is conservative: existing `gates.yml` and
  `build.yml` continue running unchanged for the universal gates
  (the only edit to `build.yml` is `npm test` next to `npm run
  build`, since the language test runner contract requires the TS
  tests to gate on every PR). The new contract gates land in a
  separate workflow file so the DEC-CDCP-015 contract reads
  end-to-end without disturbing the existing CI shape.

  No escape hatches: `continue-on-error: true` is forbidden on any
  contract gate by DEC-CDCP-015 (and absent from every job in
  this repo's workflow set); `if: ${{ failure() }}` is not used
  to mark gates as informational; path filters do not hide any
  contract gate.

  The replay-smoke job carries one subtle move worth flagging:
  the Run record bytes at the recorded sandbox SHA carry the
  PENDING placeholder, because Round 6's finalizer commit
  followed the regenerate commit that the sandbox SHA pins. The
  replay command (correctly) refuses PENDING. The workflow saves
  the finalized Run record from main HEAD into the runner temp
  dir, checks out the sandbox SHA, restores the saved record over
  the working tree, and then runs replay. The producer code,
  inputs, and exporter at the sandbox SHA all match production;
  only the bookkeeping pointer is rolled forward to its resolved
  truth. The packet hash check inside replay does the actual
  proof.

  Keeping the change reversible per the standard DEC contract:
  the new workflow file is additive, the `npm test` line is a
  one-line addition to an existing job, and the entire new
  contract layer can be reverted by deleting
  `.github/workflows/run-evidence-gates.yml` and reverting the
  `build.yml` edit. No Python or TypeScript source code changed.
evidence:
  - kind: decision
    ref: decisions/DEC-FIN-006-watchlist-export-portable-repo-uri-migration.md
  - kind: doc
    ref: .github/workflows/run-evidence-gates.yml
  - kind: doc
    ref: .github/workflows/gates.yml
  - kind: doc
    ref: .github/workflows/build.yml
  - kind: doc
    ref: scripts/replay_run.py
  - kind: doc
    ref: scripts/validate_run_evidence.py
  - kind: doc
    ref: ops/run-records/run-6a665b303138.json
  - kind: doc
    ref: ops/event-ledger/run-6a665b303138.jsonl
  - kind: spec
    ref: specs/0002-earnings-sensitivity-overlay/requirements.md
rollback: |
  Delete `.github/workflows/run-evidence-gates.yml` and revert the
  one-line `npm test` addition in `.github/workflows/build.yml`.
  `R-FIN-021` through `R-FIN-024` come out of `requirements.md`
  and `traceability.md` in the same revert. The universal gates in
  `gates.yml` keep running. No Python or TypeScript source code
  changed, so no data migration is needed.
owner: control.coordinator
---

## decision

chip-supply-chain-map's CI enforces the DEC-CDCP-015 run-evidence
chain on every pull request targeting main and every push to main.
The workflow set is three files:

- `.github/workflows/gates.yml` carries the universal Python
  validators plus the Python test runner.
- `.github/workflows/build.yml` carries the TypeScript test runner
  (`npm test`) and the production build (`npm run build`).
- `.github/workflows/run-evidence-gates.yml` carries the three
  product-side contract gates added in this round:
  packet-generation-from-canonical-sample, packet-validation, and
  replay-smoke.

The canonical sample is `run-6a665b303138`. No
`continue-on-error: true` escape hatch sits on any contract gate.
The runner is `ubuntu-latest` with Python 3.11 and Node 20.

## alternatives

- Add the new gates to the existing `gates.yml`: rejected because
  it blurs the contract boundary. The universal Python gates and
  the bridge-repo sibling-checkout flow read cleaner as separate
  workflows.
- Skip replay-smoke: rejected because replay-smoke is the gate
  that catches sandbox-SHA drift, the exact case Round 6's
  finalizer pattern was built to keep honest.
- Vendor the trace-to-eval bridge repo instead of checking it
  out: rejected because vendoring freezes the bridge against
  chip-supply-chain-map's CI and hides consumer-side drift.
- Relax replay-smoke when the Run record at the sandbox SHA
  carries PENDING: rejected because the workflow can restore the
  finalized record over the working tree at the checked-out SHA
  without weakening the replay contract.

## rationale

Round 6 fixed the sandbox-SHA off-by-one via PENDING + finalizer.
Round 7 Phase 1 defined the CI contract in DEC-CDCP-015. This
round wires the contract into chip-supply-chain-map without
disturbing the existing universal-gate workflow. The three new
gates close the v2 review-boundary loop: packet generation proves
consumer-side readability, packet validation proves the packet
schema contract holds, replay-smoke proves the recorded sandbox
SHA still produces the run it claims to.

The replay-smoke job copies the finalized Run record from main
HEAD into the runner temp dir, checks out the sandbox SHA,
restores the record over the working tree at that SHA, and runs
replay. The producer code, inputs, and exporter at the sandbox
SHA match production; only the bookkeeping pointer is rolled
forward to its resolved value. The packet hash check inside
replay does the actual proof.

## evidence

- `.github/workflows/run-evidence-gates.yml` adds the three new
  contract gates with no `continue-on-error` and no
  `if: ${{ failure() }}` shortcuts.
- `.github/workflows/build.yml` adds the `npm test` step so the
  TypeScript test runner gates on every push.
- `.github/workflows/gates.yml` continues to run the universal
  Python validators (schema cache freshness, voice lint, BOM,
  spec check, decisions, roles, tools, policies, dreams,
  validate_run_evidence, the Python test modules, and the
  data-freshness gate).
- `ops/run-records/run-6a665b303138.json` is the canonical sample
  the new gates target; its `sandbox_image_ref` carries the
  resolved SHA `86d22482fb8a7425b3edfad99020f83deefec734`.

## rollback

Delete `.github/workflows/run-evidence-gates.yml` and revert the
`npm test` line in `.github/workflows/build.yml`. `R-FIN-021`
through `R-FIN-024` come out of `requirements.md` and
`traceability.md` in the same revert. No source code changed.

## coverage

This DEC resolves the following requirements added to spec 0002:

- `R-FIN-021` chip-supply-chain-map's CI workflow set triggers on
  every `pull_request` and every `push` to `main`, runs on
  `ubuntu-latest`, and pins Python 3.11 + Node 20.
- `R-FIN-022` the CI workflow set enforces the DEC-CDCP-015
  contract gates end-to-end: schema cache freshness, voice lint,
  BOM check, spec check, decisions validation, typed event
  payload validation with Run/Event cross-checks, the Python and
  TypeScript test runners, packet generation from the canonical
  sample, packet validation, and replay smoke.
- `R-FIN-023` the replay-smoke job extracts the 40-char sandbox
  SHA from `Run.sandbox_image_ref`, checks out that SHA with
  `fetch-depth: 0`, restores the finalized Run record from main
  HEAD over the working tree at that SHA, and runs
  `scripts/replay_run.py --run-id run-6a665b303138` to exit 0
  with `replay_equivalent: true`.
- `R-FIN-024` no listed contract gate carries
  `continue-on-error: true` or any other escape hatch
  (`if: ${{ failure() }}`, path-filter skips that hide failures,
  or `--no-verify` on commit hooks).
