---
id: DEC-FIN-001-static-sourced-sensitivity-over-live-market-data
spec: specs/0002-earnings-sensitivity-overlay/
requirement: R-FIN-001
date: 2026-05-25
status: approved
reversible: true
decision: |
  Add a static CSV-backed earnings sensitivity layer for selected
  public-company chokepoints. Records carry company, ticker, node,
  scenario, metric, period, source, band, and note fields; the
  selected-node panel renders them with source links.
alternatives:
  - label: live market-data feed
    rejected_because: |
      Market feeds add API keys, rate limits, vendor terms, and price
      noise. The map needs sourced exposure facts.
  - label: computed earnings forecast
    rejected_because: |
      EPS estimates imply calibration outside this map's data. The
      graph has chokepoint heuristics and public metrics, not a model
      for earnings outcomes.
  - label: financial badges on graph nodes
    rejected_because: |
      Badges on nodes would compete with chokepoint scores and make
      the default graph busy. The detail panel is the right place for
      source-backed financial context.
rationale: |
  Investor readers need row-level facts that explain why a chokepoint
  has earnings relevance. A static CSV keeps the app demoable offline,
  keeps provenance visible, and avoids equating a heuristic with an
  earnings forecast. The `scenario_id` field ties records to existing
  scenario toggles without changing the scoring formula.
evidence:
  - kind: spec
    ref: specs/0002-earnings-sensitivity-overlay/requirements.md (R-FIN-001)
  - kind: doc
    ref: src/data/financial_sensitivity.csv
  - kind: doc
    ref: src/components/NodeDetailPanel.tsx
  - kind: doc
    ref: src/data/sources.md
rollback: |
  Delete `src/data/financial_sensitivity.csv` and `src/lib/financial.ts`,
  remove the investor section from `NodeDetailPanel.tsx`, remove the
  import and prop wiring in `App.tsx`, remove the financial CSV path
  from `check_data_freshness.py`, and delete spec 0002 plus this DEC.
owner: engineering
---

## decision

Add a static CSV-backed earnings sensitivity layer for selected
public-company chokepoints. The selected-node panel renders matching
records with source links and active-scenario markers.

## alternatives

- Live market-data feed - adds API keys, rate limits, vendor terms,
  and price noise.
- Computed earnings forecast - implies calibration outside this map's
  data.
- Financial badges on graph nodes - competes with the chokepoint
  score and makes the default graph busy.

## rationale

Investor readers need row-level facts that explain why a chokepoint
has earnings relevance. A static CSV keeps the app demoable offline
and keeps provenance visible. The `scenario_id` field ties records to
existing scenario toggles without changing the scoring formula.

## evidence

- `specs/0002-earnings-sensitivity-overlay/requirements.md` -
  R-FIN-001.
- `src/data/financial_sensitivity.csv` - the seeded records.
- `src/components/NodeDetailPanel.tsx` - the investor section.
- `src/data/sources.md` - source IDs `s104` through `s113`.

## rollback

Delete the financial CSV and loader, remove the investor section from
the node detail panel, remove the app prop wiring, remove the financial
CSV from the freshness gate, and delete spec 0002 plus this DEC.
