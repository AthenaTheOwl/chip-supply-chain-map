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

## Verification

- [x] Add aggregation and export tests.
- [x] Run the python gates.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `npm run lint`.
