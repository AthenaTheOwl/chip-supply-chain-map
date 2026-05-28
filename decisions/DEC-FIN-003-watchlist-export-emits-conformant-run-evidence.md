---
id: DEC-FIN-003-watchlist-export-emits-conformant-run-evidence
spec: specs/0002-earnings-sensitivity-overlay/
requirement: R-FIN-003
date: 2026-05-27
status: approved
reversible: true
decision: |
  The watchlist export CLI MUST emit a conformant Event ledger plus a
  final Run record per execution, with the four derivable
  replay-equivalence fields populated. The ledger lands at
  `ops/event-ledger/<run-id>.jsonl` and the Run record lands at
  `ops/run-records/<run-id>.json`; both conform to the cached
  cross-repo schemas mirrored from athena-site under
  `ops/schemas-cache/`. The validator gate at
  `scripts/validate_run_evidence.py` walks both directories on every
  CI run and exits non-zero on schema violations.
alternatives:
  - label: keep the in-app browser-only export, skip the CLI
    rejected_because: |
      The browser-only export at WatchlistPanel.tsx produces the same
      packet bytes, but there is no audit trail. A reviewer reading
      a packet copied from the running app cannot prove which
      commit, which heuristic version, and which input bytes
      produced it. The Run record makes that audit trail explicit.
      The CLI is the replay surface; the browser export stays as
      the interactive surface.
  - label: emit only the Run record, skip the per-execution JSONL ledger
    rejected_because: |
      A Run record alone records the rollup but not the timeline.
      The cross-repo consumer's packet generator (Codex's
      bfd1d48 in the sibling consumer repo) needs `gate.check.*`
      and `tool.call.*` events to populate gate and tool lists in
      the run-evidence packet shape. The ledger is the source of
      those events.
  - label: populate all six replay-equivalence fields including
      determinism and checkpoint_ref
    rejected_because: |
      The pipeline has no sampler (no LLM, no random component) and
      no resumable checkpoint store. The determinism block would
      carry placeholder values that lie about replay equivalence;
      checkpoint_ref would point at nothing. The schema treats
      absence as "not applicable", which is the honest record. If a
      future variant adds a stochastic step (a Monte Carlo
      sensitivity scan, say) the field gets populated automatically
      because runEvidence.buildRunEvidenceFields already accepts the
      knob.
  - label: pick chokepoint score recomputation as the Run boundary
    rejected_because: |
      Score recomputation is a pure function inside the watchlist
      export pipeline (computeChokepointScores is called from
      buildWatchlistRiskPacket via the CLI). Naming scores as the
      Run boundary would split the pipeline in two, with two Run
      records per logical export. The watchlist export is the
      user-facing artifact and the right boundary for the audit
      trail.
  - label: emit the run evidence from the React app's download button
    rejected_because: |
      Browser writes to disk via download require user interaction
      and produce no JSONL stream the validator can walk. The CI
      gate needs files in the repo's ops/ tree, not transient
      browser downloads.
rationale: |
  This is Phase D of the run-evidence rollout that started with
  DEC-CDCP-011 in athena-site (commit f314fd7), which amended
  `run.schema.json` with six replay-equivalence fields. Phase B
  shipped the first emitter in procurement-negotiation-lab
  (DEC-FACTORY-007 + sample run-cb524eb06115). Phase D earlier
  shipped a second emitter in supplier-risk-rag-agent (DEC-EVL-006 +
  sample run-13f2a48fe8bc). Phase B.1 (Codex commit bfd1d48 in the
  sibling consumer repo) shipped the consumer side: a
  `run-evidence.schema.json` packet format and a
  `trace-to-eval evidence from-cdcp-events` CLI that reads a CDCP
  event log and produces a packet. The missing piece in this repo
  was the emitter that writes the new schema fields in the first
  place.

  chip-supply-chain-map differs from the other Phase D / Phase B
  repos in one load-bearing way: no LLM is in the loop. The closest
  analog to a "prompt" is the deterministic scoring heuristic
  config; the closest analog to a "tool surface" is the curated
  input data. The schema does not care which kind of pipeline
  produces a Run record - the hashes and the audit trail work the
  same way for a no-LLM data pipeline as for an LLM-driven one. The
  field-population rules in `src/lib/runEvidence.ts` document the
  framing explicitly so a future reader does not mistake the absence
  of `determinism` for sloppiness.

  Naming the watchlist export as the Run boundary (not the
  chokepoint recomputation, not the static graph rebuild) tracks the
  user-facing artifact a reviewer cares about. The pipeline reads
  versioned input data, applies a deterministic heuristic, and
  produces a JSON packet consumed by external readers (investors).
  Replay equivalence has clear value here: an auditor can verify a
  published watchlist was generated from the claimed input bytes by
  re-running the CLI from the sandbox_image_ref commit.

  Keeping the emitter reversible via a CLI flag
  (`--no-emit-evidence`) and the validator gate (gates can be
  relaxed for emergency commits) means the discipline is opt-out by
  intent, not opt-in by accident.
evidence:
  - kind: spec
    ref: specs/0002-earnings-sensitivity-overlay/requirements.md
  - kind: decision
    ref: https://github.com/AthenaTheOwl/athena-site/blob/main/decisions/DEC-CDCP-011-run-schema-replay-equivalence-fields.md
  - kind: decision
    ref: https://github.com/AthenaTheOwl/procurement-negotiation-lab/blob/main/decisions/DEC-FACTORY-007-factory-emits-conformant-run-evidence.md
  - kind: decision
    ref: https://github.com/AthenaTheOwl/supplier-risk-rag-agent/blob/main/decisions/DEC-EVL-006-eval-runner-emits-conformant-run-evidence.md
  - kind: doc
    ref: src/lib/runEvidence.ts
  - kind: doc
    ref: scripts/export_watchlist/main.ts
  - kind: doc
    ref: scripts/export_watchlist.mjs
  - kind: doc
    ref: scripts/validate_run_evidence.py
  - kind: doc
    ref: ops/schemas-cache/run.schema.json
  - kind: doc
    ref: ops/schemas-cache/event.schema.json
  - kind: doc
    ref: .github/workflows/gates.yml
rollback: |
  Revert the wiring commits (the watchlist export CLI, the validator
  gate, the schema cache mirror) and delete this DEC. The
  R-FIN-003..008 requirements come out of
  specs/0002-earnings-sensitivity-overlay/requirements.md and
  traceability.md in the same revert. The cached event.schema.json
  stays because other validators may need it. No data migration is
  needed because the ledger and Run record files are append-only
  audit trails with no foreign-key fan-out. After the rollback the
  in-app browser export at WatchlistPanel.tsx still works
  identically because it does not depend on the CLI.
owner: control.coordinator
---

## decision

The watchlist export CLI emits a conformant Event ledger plus a
final Run record per execution, with the four derivable
replay-equivalence fields populated. The ledger lands at
`ops/event-ledger/<run-id>.jsonl`; the Run record lands at
`ops/run-records/<run-id>.json`. A validator gate enforces
conformance to the cross-repo schemas on every CI run.

## alternatives

- Keep the in-app browser-only export: rejected because the browser
  export produces no audit trail a reviewer can walk.
- Emit only the Run record, skip the ledger: rejected because the
  consumer's packet generator needs the event timeline.
- Populate all six fields including determinism and checkpoint_ref:
  rejected because the pipeline has no sampler and no checkpoint
  store; placeholder values would lie about replay equivalence.
- Pick chokepoint score recomputation as the Run boundary: rejected
  because scoring is a step inside the watchlist export pipeline;
  splitting the pipeline in two would produce two Run records per
  logical export.
- Emit run evidence from the React app's download button: rejected
  because browser downloads produce no JSONL stream the CI gate can
  walk.

## rationale

DEC-CDCP-011 in athena-site amended `run.schema.json` with six
replay-equivalence fields. Phase B shipped the first emitter in
procurement-negotiation-lab (DEC-FACTORY-007). Phase D earlier
shipped a second emitter in supplier-risk-rag-agent (DEC-EVL-006).
Codex's commit bfd1d48 in the sibling consumer repo shipped the
consumer side. Without an emitter that populates the new schema
fields here, the fields are dead letters and the bridge between
producer and consumer does not exist for chip-supply-chain-map.

chip-supply-chain-map has no LLM in the loop. The closest analog to
a "prompt" is the deterministic scoring heuristic config; the
closest analog to a "tool surface" is the curated input data. The
schema does not care which kind of pipeline produces a Run record -
the hashes and the audit trail work the same way. Replay
equivalence is "same input bytes plus same heuristic equals same
packet bytes", and the Run record makes that claim auditable.

The watchlist export is the right Run boundary: a user-facing
artifact consumed by external readers, derived from versioned input
data via a deterministic heuristic. An auditor can verify a
published watchlist by re-running the CLI from the
`sandbox_image_ref` commit and comparing byte counts.

## evidence

- `specs/0002-earnings-sensitivity-overlay/requirements.md` lists
  R-FIN-003..008.
- `athena-site/decisions/DEC-CDCP-011-*` records the source-of-truth
  schema amendment.
- `procurement-negotiation-lab/decisions/DEC-FACTORY-007-*` is the
  Phase B precedent.
- `supplier-risk-rag-agent/decisions/DEC-EVL-006-*` is the earlier
  Phase D precedent (the closest match in shape, also four-field
  population).
- `src/lib/runEvidence.ts` is the TypeScript emitter module.
- `scripts/export_watchlist/main.ts` wires the emitter into the
  watchlist export pipeline.
- `scripts/validate_run_evidence.py` is the validator gate.
- `ops/schemas-cache/run.schema.json` and
  `ops/schemas-cache/event.schema.json` mirror the cross-repo
  contract.

## rollback

Revert the wiring commits, drop the validator gate from
`.github/workflows/gates.yml`, delete `scripts/validate_run_evidence.py`
and the export CLI plus emitter module, then delete the
R-FIN-003..008 requirements and remove this DEC. The cached
`event.schema.json` stays because other validators may need it. No
data migration is needed because the ledger files are append-only
audit trails. The in-app browser export at WatchlistPanel.tsx still
works after the rollback because it does not depend on the CLI.

## coverage

This DEC resolves the following requirements added to spec 0002:

- `R-FIN-003` watchlist export CLI emits a conformant Event ledger
  to `ops/event-ledger/<run-id>.jsonl` on every execution.
- `R-FIN-004` watchlist export CLI emits a conformant Run record to
  `ops/run-records/<run-id>.json` per execution.
- `R-FIN-005` `prompt_snapshot_hash` and
  `tool_schemas_snapshot_hash` are always populated (the heuristic
  config and the input-data canonicalization respectively).
- `R-FIN-006` `sandbox_image_ref` is populated from the repo HEAD.
- `R-FIN-007` `gate_results_summary` is populated by aggregating
  `gate.check.*` events fired for the `input_validation` and
  `packet_shape` gates.
- `R-FIN-008` `validate_run_evidence.py` runs on every push to main
  and exits non-zero on schema violations.
