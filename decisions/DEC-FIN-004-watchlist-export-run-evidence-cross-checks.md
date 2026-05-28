---
id: DEC-FIN-004-watchlist-export-run-evidence-cross-checks
amends: DEC-FIN-003-watchlist-export-emits-conformant-run-evidence
spec: specs/0002-earnings-sensitivity-overlay/
requirement: R-FIN-009
date: 2026-05-28
status: approved
reversible: true
decision: |
  The watchlist export pipeline MUST emit Event payloads whose keys
  match the typed payload schemas added to `event.schema.json` in
  Round 2: `tool.call.completed` uses `tool_name`, not `tool_id`;
  `gate.run.evidence_recorded` uses `fields_populated`, not
  `populated_fields`; `pipeline.done` carries a cloned
  `gate_results_summary` so the rollup is auditable from the ledger
  alone. The validator at `scripts/validate_run_evidence.py` MUST
  enforce four cross-checks on every done Run record:
  (1) Run-level required-for-done fields (`prompt_snapshot_hash`,
  `tool_schemas_snapshot_hash`, `sandbox_image_ref`,
  `gate_results_summary`) are populated; (2) a
  `gate.run.evidence_recorded` event is present in the ledger;
  (3) the `pipeline.start` event's `prompt_snapshot_hash` and
  `tool_schemas_snapshot_hash` agree with the Run record;
  (4) `<gate.run.evidence_recorded>.payload.fields_populated`
  (sorted) equals the sorted set of replay-equivalence fields the Run
  record populates; (5) `Run.gate_results_summary` matches
  the scan of `gate.check.passed` / `gate.check.failed` events.
alternatives:
  - label: keep the emitter as-is and weaken the schema in athena-site
    rejected_because: |
      The Round-2 schema amendment in athena-site (commit `bfc735a`)
      is the cross-repo contract. Two other Phase D / Phase B
      producers (procurement-negotiation-lab, supplier-risk-rag-agent)
      already emit `tool_name` and `fields_populated`; relaxing the
      schema would re-introduce the same field-name drift the typed
      payload branches were added to catch. The fix lives on the
      producer side.
  - label: enforce only schema conformance, skip the cross-checks
    rejected_because: |
      Schema conformance catches typos like `tool_id` versus
      `tool_name`, but it does not catch a `Run.gate_results_summary`
      that lists gates the ledger never recorded, or a
      `pipeline.start.prompt_snapshot_hash` that disagrees with the
      Run record. The cross-checks are the second layer that closes
      the gap between "valid JSON" and "internally consistent run
      evidence". Codex's audit found three such gaps; the validator
      now refuses to merge a Run with the same shape.
  - label: cross-check at the consumer (trace-to-eval) instead of the
      producer
    rejected_because: |
      The consumer in the sibling repo runs after the artifact has
      already landed. Pushing the check upstream to the producer's
      CI means a malformed Run record never lands on main in the
      first place. The consumer-side packet regeneration is the
      Round 4 work and is out of scope here.
  - label: clone gate_results_summary into pipeline.complete instead
      of pipeline.done
    rejected_because: |
      The shipped emitter uses `pipeline.done` as the terminal event,
      not `pipeline.complete`. The schema lists both as canonical
      types; the Round-3 audit cited `pipeline.done` as the rollup
      source. Cloning into `pipeline.complete` would require renaming
      the terminal event across every shipped emitter in the
      portfolio for no audit-trail gain.
rationale: |
  This DEC amends DEC-FIN-003. Phase D shipped the first conformant
  emitter in this repo (DEC-FIN-003, sample `run-efeb29900de3`).
  Round 2 in athena-site (DEC-CDCP-013, commit `bfc735a`) added typed
  payload schemas for the eight canonical event types. The Codex
  audit caught three pre-amendment field names that survived the
  schema bump: two `tool.call.completed` events using `tool_id`, one
  `gate.run.evidence_recorded` event using `populated_fields`. The
  audit also recommended Run-level cross-checks: the new schema
  catches field-name drift but does not catch internal-consistency
  drift (a Run record's `gate_results_summary` lists gates the ledger
  never recorded; an evidence_recorded event's `fields_populated`
  disagrees with the Run record).

  The fix is two-sided. The emitter side (this commit) renames the
  three payload keys and clones `gate_results_summary` into the
  `pipeline.done` payload so the rollup is auditable from the ledger
  alone. The validator side adds five cross-checks that fire on every
  done Run record. Each cross-check exits 1 with a message naming the
  run-id and the specific check, so a reviewer can pinpoint the
  drifted field from the gate output.

  The Round-3 audit's three sample-record violations are now caught
  at the schema layer; the regenerated sample `run-6a665b303138`
  passes both schema validation and all five cross-checks. The
  pytest module `scripts/test_validate_run_evidence.py` covers one
  positive case plus seven negative cases (six core failure modes
  plus an `all_passed`-flag disagreement) so a future change to the
  validator cannot regress the cross-check matrix.

  Keeping the cross-checks reversible per the standard DEC contract:
  the validator's cross-check function isolates the new logic in one
  module-level function, the regenerated sample replaces the prior
  one cleanly, and the pytest pins the expected violation messages.
  A rollback drops the cross_check additions, the regenerated
  sample, and this DEC.
evidence:
  - kind: spec
    ref: specs/0002-earnings-sensitivity-overlay/requirements.md
  - kind: decision
    ref: decisions/DEC-FIN-003-watchlist-export-emits-conformant-run-evidence.md
  - kind: decision
    ref: https://github.com/AthenaTheOwl/athena-site/blob/main/decisions/DEC-CDCP-013-event-schema-typed-payloads.md
  - kind: doc
    ref: scripts/validate_run_evidence.py
  - kind: doc
    ref: scripts/test_validate_run_evidence.py
  - kind: doc
    ref: scripts/export_watchlist/main.ts
  - kind: doc
    ref: ops/run-records/run-6a665b303138.json
  - kind: doc
    ref: ops/event-ledger/run-6a665b303138.jsonl
  - kind: doc
    ref: ops/schemas-cache/event.schema.json
rollback: |
  Revert the four Round-3 commits in order: the regenerated sample,
  the validator extension, the emitter rename, and this DEC. The
  R-FIN-009..012 requirements come out of
  specs/0002-earnings-sensitivity-overlay/requirements.md and
  traceability.md in the same revert. The cached event.schema.json
  stays because it mirrors athena-site's source-of-truth amendment.
  No data migration is needed because the ledger and Run record
  files are append-only audit trails with no foreign-key fan-out.
  After the rollback the prior sample (`run-efeb29900de3`) would
  need to be re-emitted by a pre-Round-2 emitter to validate; the
  simpler path is to leave the Round-3 sample in place and revert
  only the validator + emitter changes.
owner: control.coordinator
---

## decision

The watchlist export emitter must use schema-aligned payload keys
(`tool_name` for `tool.call.completed`, `fields_populated` for
`gate.run.evidence_recorded`) and clone `gate_results_summary` into
the `pipeline.done` payload. The validator must enforce five
cross-checks on every done Run record: required fields populated,
terminal `gate.run.evidence_recorded` event present, hash agreement
between `pipeline.start` and the Run record, `fields_populated`
agreement between the evidence event and the Run record, and
`gate_results_summary` agreement between the Run record and the
scan of `gate.check.*` events.

## alternatives

- Weaken the cross-repo schema: rejected because the schema is the
  contract; the fix lives at the producer.
- Schema-only conformance: rejected because schema catches typos,
  not internal-consistency drift.
- Check at the consumer: rejected because the producer's CI is the
  right gate for a producer-side artifact.
- Clone the summary into `pipeline.complete` instead of
  `pipeline.done`: rejected because the shipped terminal event is
  `pipeline.done` across the portfolio.

## rationale

DEC-FIN-003 shipped the first conformant emitter (Phase D, sample
`run-efeb29900de3`). Round 2 (DEC-CDCP-013 in athena-site, commit
`bfc735a`) added typed payload schemas. Codex's audit caught three
field-name violations the typed schema flagged plus internal-
consistency gaps the schema cannot see (a `Run.gate_results_summary`
listing gates the ledger never recorded; an evidence_recorded event
disagreeing with the Run record on `fields_populated`).

The fix renames the three payload keys, clones the summary into the
terminal event so the rollup is auditable from the ledger alone,
and adds five cross-checks at the validator. Each cross-check exits
1 with a run-id-tagged message so a reviewer can pinpoint the drift
from the gate output. The pytest `scripts/test_validate_run_evidence.py`
pins one positive case plus seven negative cases against the
expected violation messages so a regression cannot ship silently.

## evidence

- `specs/0002-earnings-sensitivity-overlay/requirements.md` lists
  R-FIN-009 through R-FIN-012 added in the same commit.
- `decisions/DEC-FIN-003-*` is the amended Phase D decision.
- `athena-site/decisions/DEC-CDCP-013-*` records the source-of-truth
  schema amendment (Round 2).
- `scripts/validate_run_evidence.py` carries the cross-check logic.
- `scripts/test_validate_run_evidence.py` carries the test matrix.
- `scripts/export_watchlist/main.ts` carries the renamed payload
  keys and the cloned `gate_results_summary`.
- `ops/run-records/run-6a665b303138.json` and
  `ops/event-ledger/run-6a665b303138.jsonl` are the regenerated
  sample that passes the new gate.

## rollback

Revert the four Round-3 commits in order: regenerated sample,
validator extension, emitter rename, and this DEC. The
R-FIN-009..012 requirements come out of
`specs/0002-earnings-sensitivity-overlay/requirements.md` and
`traceability.md` in the same revert. The cached
`event.schema.json` stays because it mirrors the athena-site
amendment. No data migration is needed; the ledger files are
append-only audit trails.

## coverage

This DEC resolves the following requirements added to spec 0002:

- `R-FIN-009` `tool.call.completed` payloads carry `tool_name`
  (matching the typed payload schema), not `tool_id`.
- `R-FIN-010` `gate.run.evidence_recorded` payloads carry
  `fields_populated`, not `populated_fields`.
- `R-FIN-011` `pipeline.done` payloads carry a cloned
  `gate_results_summary` so the rollup is auditable from the ledger
  alone.
- `R-FIN-012` `scripts/validate_run_evidence.py` enforces five
  done-Run cross-checks (required-for-done fields, terminal event
  presence, hash agreement with `pipeline.start`, `fields_populated`
  agreement, `gate_results_summary` agreement with the
  `gate.check.*` scan).
