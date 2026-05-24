---
id: DEC-MAP-006-synthetic-historical-data-for-pedagogy
spec: specs/0001-cognitive-delivery-control-plane/
requirement: R-MAP-006
date: 2026-05-24
status: approved
reversible: true
decision: |
  Seed `src/data/nodes_history.csv` with synthetic quarterly
  chokepoint scores authored by hand from public industry news.
  Use the synthesis to drive the History slider in
  `src/components/HistorySlider.tsx` and the
  `getScoreMapForQuarter` lookup in `src/lib/history.ts`. The
  2026-Q2 column matches the live snapshot in `src/data/nodes.csv`;
  the three earlier quarters are plausible drifts anchored to the
  public news events cited in `docs/scoring-history.md`. The
  synthetic origin and the caveat are stated explicitly in
  `docs/scoring-history.md` and `src/data/sources.md` and surfaced
  in the slider's helper text so a layperson cannot miss it.
alternatives:
  - label: pull measured history from a semiconductor research vendor
    rejected_because: |
      The vendors with the closest fit (SEMI World Fab Forecast,
      Gartner, IDC, BCG, McKinsey) publish industry-aggregate
      capacity and revenue figures, not a per-node chokepoint
      time series. Buying a license would cost more than the app's
      whole budget and would lock the repo to a vendor-controlled
      surface that the public-facing methodology cannot show. The
      cross-repo data-CSV policy requires every row to cite a
      public source; a paid feed breaks that contract.
  - label: web-scrape news archives and derive scores
    rejected_because: |
      A scraper of news archives plus a sentiment-to-score pipeline
      would be brittle (archives go behind paywalls, layouts
      change, redirects break the chain) and would invent a
      methodology that the chokepoint formula in DEC-MAP-003 does
      not have. The score is a transparent product of four named
      factors; sentiment-derived scores would erase that
      transparency.
  - label: ship current-snapshot only (no time dimension)
    rejected_because: |
      The existing app already does that. The point of the History
      slider is to give the deployed app a second mode and to put
      the 180-day data-freshness gate to productive use. A
      single-snapshot product cannot show how chokepoint risk
      composes over time, which is the layperson intuition the
      slider builds.
  - label: synthesize from a forecasting model
    rejected_because: |
      A trained model on the small historical outage corpus would
      overfit and would not be auditable. The synthesis here is
      hand-authored from cited public news, so any reviewer can
      check each drift against the news anchor.
rationale: |
  The chokepoint score is decision-support, not measurement.
  Holding the historical surface to the same disclosure standard
  as the live snapshot is the honest move: the audit trail is the
  public news cited in `docs/scoring-history.md`, and the
  authoring judgement is named as judgement.

  Three considerations make synthesis the right call here. First,
  cost: no public vendor publishes a per-node quarterly chokepoint
  time series, and the licenses on the closest substitutes block
  the public-source attestation chain. Second, pedagogy: the slider
  is for a layperson audience, and the storytelling value comes
  from showing plausible movement anchored to nameable events.
  Third, transparency: the synthetic origin is stated in three
  places (the data file's notes column, the methodology doc, and
  the slider's helper text), so a reader cannot mistake the
  historical view for measured data.

  The chokepoint score formula is unchanged from DEC-MAP-003. The
  history CSV stores the final 0-100 score plus the four factor
  inputs (geography_concentration, substitutability_penalty,
  lead_time_penalty, dependency_centrality) for each node-quarter,
  so a reader can inspect how the factors would have composed at
  each point in time. The four-factor decomposition is the same
  one DEC-MAP-003 documents.
evidence:
  - kind: doc
    ref: src/data/nodes_history.csv (78 nodes x 4 quarters = 312 rows)
  - kind: doc
    ref: docs/scoring-history.md (synthesis methodology and the news anchors)
  - kind: doc
    ref: src/data/sources.md (the scenario-history attestation paragraph)
  - kind: doc
    ref: src/lib/history.ts (loadHistory + getScoresAtQuarter + getScoreMapForQuarter)
  - kind: doc
    ref: src/components/HistorySlider.tsx (the slider plus the synthetic-data helper text)
  - kind: decision
    ref: decisions/DEC-MAP-003-chokepoint-score-heuristic.md (the formula the history shows)
  - kind: decision
    ref: decisions/DEC-MAP-005-data-freshness-gate-180-days.md (the freshness gate the history CSV joins)
rollback: |
  Delete `src/data/nodes_history.csv`, `src/lib/history.ts`,
  `src/components/HistorySlider.tsx`, and the History-slider
  mount in `src/components/ScenarioControls.tsx`. Remove the
  `currentQuarter` field and the `setCurrentQuarter` action from
  `src/state/store.ts`. Remove the `quarter` prop from
  `src/components/SupplyChainGraph.tsx`. Remove
  `src/data/nodes_history.csv` from the PATHS tuple in
  `scripts/check_data_freshness.py`. The current-snapshot mode
  reads from `src/data/nodes.csv` and is unchanged.
owner: engineering
---

## decision

Seed `src/data/nodes_history.csv` with 78 nodes by 4 quarters of
synthetic chokepoint scores authored from public industry news.
The History slider in `src/components/HistorySlider.tsx` reads the
file and recolors the graph as the user scrubs across the
quarters. The synthetic origin is stated in three places so a
layperson cannot mistake the historical view for measured data.

## alternatives

- Pull measured history from a semiconductor research vendor -
  cost and license issues; vendors do not publish a per-node
  chokepoint time series; paid feed breaks the public-source
  attestation chain.
- Web-scrape news archives and derive scores - brittle pipeline
  and invents a methodology that erases the four-factor
  transparency in DEC-MAP-003.
- Ship current-snapshot only (no time dimension) - the existing
  state of the app; misses the layperson intuition the slider
  builds.
- Synthesize from a forecasting model - overfits the small outage
  corpus and is not auditable.

## rationale

The chokepoint score is decision-support, not measurement. The
historical surface is held to the same disclosure standard as
the live snapshot: the audit trail is the public news cited in
`docs/scoring-history.md`, and the authoring judgement is named
as judgement.

The chokepoint formula is unchanged from DEC-MAP-003. The
history CSV stores the final score plus the four factor inputs
for each node-quarter, so a reader can inspect how the factors
would have composed at each point in time.

## evidence

- `src/data/nodes_history.csv` - 78 nodes x 4 quarters = 312 rows.
- `docs/scoring-history.md` - the synthesis methodology and the
  public news anchors cited.
- `src/data/sources.md` - the scenario-history attestation
  paragraph.
- `src/lib/history.ts` - the loader and the lookup helpers.
- `src/components/HistorySlider.tsx` - the slider plus the
  synthetic-data helper text.
- `DEC-MAP-003-chokepoint-score-heuristic.md` - the formula the
  history view shows.
- `DEC-MAP-005-data-freshness-gate-180-days.md` - the freshness
  gate the history CSV joins.

## rollback

Delete `src/data/nodes_history.csv`, `src/lib/history.ts`,
`src/components/HistorySlider.tsx`, and the History-slider mount
in `src/components/ScenarioControls.tsx`. Remove the
`currentQuarter` field from `src/state/store.ts`. Remove the
`quarter` prop from `src/components/SupplyChainGraph.tsx`.
Remove `src/data/nodes_history.csv` from the PATHS tuple in
`scripts/check_data_freshness.py`. The current-snapshot mode
reads from `src/data/nodes.csv` and is unchanged.
