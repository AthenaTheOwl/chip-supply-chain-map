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

## Governance

- [x] Add `R-FIN-001`.
- [x] Add `DEC-FIN-001-static-sourced-sensitivity-over-live-market-data.md`.
- [x] Update README reader guidance.

## Verification

- [x] Run the python gates.
- [x] Run `npm run build`.
