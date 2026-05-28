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

## Verification

- [x] Add aggregation and export tests.
- [x] Run the python gates.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `npm run lint`.
