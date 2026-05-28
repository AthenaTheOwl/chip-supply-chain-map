# tasks: earnings sensitivity overlay

## Data

- [x] Add `src/data/financial_sensitivity.csv` with 8-12 sourced
  public-company records.
- [x] Add source IDs for every new financial row.
- [x] Add the financial CSV to the 180-day freshness gate.

## App

- [x] Add a TypeScript loader for the financial sensitivity CSV.
- [x] Render an investor section in the selected-node panel.
- [x] Mark records whose scenario is active.
- [x] Add watchlist state for selected graph nodes.
- [x] Add a watchlist panel with aggregate exposure summary.
- [x] Add JSON and markdown risk packet export.

## Governance

- [x] Add `R-FIN-001`.
- [x] Add `DEC-FIN-001-static-sourced-sensitivity-over-live-market-data.md`.
- [x] Add `R-FIN-002`.
- [x] Add `DEC-FIN-002-deterministic-watchlist-risk-packets.md`.
- [x] Update README reader guidance.

## Run-evidence rollout (Phase D)

- [x] Mirror `ops/schemas-cache/event.schema.json` from athena-site.
- [x] Add `src/lib/runEvidence.ts` emitter module + tests.
- [x] Add `scripts/validate_run_evidence.py` validator gate.
- [x] Wire the validator into `.github/workflows/gates.yml`.
- [x] Add `scripts/export_watchlist/main.ts` CLI + `scripts/export_watchlist.mjs` launcher.
- [x] Add `npm run export:watchlist` script.
- [x] Add `R-FIN-003` through `R-FIN-008`.
- [x] Add `DEC-FIN-003-watchlist-export-emits-conformant-run-evidence.md`.
- [x] Ship a canonical sample Run record + event ledger under `ops/`.

## Run-evidence Round 3 (typed payloads + cross-checks)

- [x] Rename `tool_id` to `tool_name` in the two `tool.call.completed`
  emissions in `scripts/export_watchlist/main.ts`.
- [x] Rename `populated_fields` to `fields_populated` on both the
  success and failure `gate.run.evidence_recorded` emissions.
- [x] Clone `gate_results_summary` into the `pipeline.done` payload.
- [x] Extend `scripts/validate_run_evidence.py` with the five
  done-Run cross-checks.
- [x] Add `scripts/test_validate_run_evidence.py` (1 positive + 7
  negative cases) and wire it into `.github/workflows/gates.yml`.
- [x] Regenerate the canonical sample (`run-6a665b303138`) and
  retire the obsolete one (`run-efeb29900de3`).
- [x] Add `R-FIN-009` through `R-FIN-012`.
- [x] Add `DEC-FIN-004-watchlist-export-run-evidence-cross-checks.md`.

## Run-evidence Round 5 (deterministic replay command)

- [x] Add `scripts/replay_run.py` with HEAD-strict checkout,
  input-hash agreement, byte-equivalent output comparison, and
  per-replay ledger + record emission.
- [x] Add `scripts/test_replay_run.py` (1 positive + 3 negative
  cases: HEAD mismatch, missing Run record, input drift).
- [x] Bump the canonical sample's `sandbox_image_ref` so the replay
  command runs against the current HEAD.
- [x] Ship the canonical replay artifact pair under
  `ops/event-ledger/replay-run-6a665b303138-*.jsonl` and
  `ops/replay-records/run-6a665b303138/`.
- [x] Add `R-FIN-013` through `R-FIN-016`.
- [x] Add `DEC-FIN-005-watchlist-replay-command.md`.

## Verification

- [x] Add aggregation and export tests.
- [x] Run the python gates.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `npm run lint`.
