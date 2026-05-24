---
id: DEC-MAP-003-chokepoint-score-heuristic
spec: specs/0001-cognitive-delivery-control-plane/
requirement: R-MAP-003
date: 2026-05-24
status: approved
reversible: true
decision: |
  Score each node as a four-factor product:
  `centrality * geographic_concentration * substitutability * lead_time * scenario_multiplier`,
  then normalize raw scores onto a 0-100 display scale after each
  scenario change. `centrality` is Brandes betweenness on the
  undirected adjacency; `geographic_concentration` is `1 + top_country_share`
  within the node's peer group; `substitutability` is
  `1 / (1 + log(1 + alternatives))`; `lead_time` is
  `1 + lead_time_months / 12` driven by type-level constants in
  `LEAD_TIME_BY_TYPE` plus a small set of named overrides (ASML,
  TSMC, Samsung Foundry, Intel Foundry, ABF substrate suppliers).
alternatives:
  - label: pure betweenness centrality
    rejected_because: |
      Betweenness alone scores graph brokerage but ignores geographic
      concentration, substitutability, and lead time. ASML scores
      high on betweenness but the load-bearing intuition that EUV
      lithography is a chokepoint comes from also being the sole
      supplier in its category (substitutability), Dutch-only
      (geographic concentration), and 30-month lead-time. The
      four-factor product is the whole reason this app exists.
  - label: capacity-simulation model
    rejected_because: |
      A real simulation would need wafer starts, HBM stacks, CoWoS
      lines, substrate layer counts, test capacity, and fab-level
      utilization. None of those numbers are public at this
      granularity for most companies. The chokepoint score is a
      decision-support heuristic for discussion, not a simulator;
      docs/known-limitations.md says so explicitly.
  - label: expert-weighted scorecard
    rejected_because: |
      Hand-picking weights per node hides the methodology and breaks
      the audit trail. The formula in src/lib/scoring.ts is open and
      reproducible; any reviewer can re-derive a node's score from
      the CSV and the scoring code.
  - label: deep-learning predictor trained on outage history
    rejected_because: |
      Premature. The historical outage corpus is small (Renesas Naka
      fire, COVID auto-chip crisis, ABF shortage from 2020-2022,
      a handful of fab water and power events). A trained model on
      this dataset would overfit and would not be reviewable; the
      heuristic is reviewable.
rationale: |
  Each factor maps to one piece of the chokepoint intuition. Centrality
  captures graph brokerage: ASML, TSMC, ABF substrate suppliers, and
  advanced packaging firms sit between many upstream and downstream
  nodes, and betweenness picks that up. Geographic concentration
  captures the regionally clustered nature of the value chain (SIA/
  BCG describe a specialized and geographically distributed
  industry). Substitutability captures whether a second or third
  qualified source can absorb disruption, counted as public
  alternatives at the same type and subtype. Lead time captures the
  hard floor on how long a replacement takes to qualify; ASML's
  30-month and TSMC's 36-month entries dominate the lead-time term.

  Multiplying the factors (not adding them) means a node scoring
  high on every dimension scores far above the median; a node
  scoring high on three of four but low on one falls back toward
  the middle. That matches how supply-chain risk composes: a
  sole-supplier with short lead times has a hedge (build
  inventory); a sole-supplier with multi-quarter lead times has
  none.

  The heuristic is decision-support, not forecast. docs/methodology.md
  documents the formula, docs/known-limitations.md names what is
  not modeled (capacity, inventory, customer mix, pricing,
  demand elasticity), and DEC-MAP-004 documents the scenario-toggle
  control surface that interacts with the score.
evidence:
  - kind: doc
    ref: src/lib/scoring.ts (chokepointScore + betweennessCentrality + the four factor helpers)
  - kind: doc
    ref: docs/methodology.md (the formula, the variables, and the why)
  - kind: doc
    ref: docs/known-limitations.md (what the score does not model)
  - kind: doc
    ref: src/lib/scenarios.ts (scenarioMultiplier consumes the score)
  - kind: doc
    ref: src/components/ChokepointScoreBadge.tsx (the display surface)
rollback: |
  Swap the chokepoint formula by editing `chokepointScore` in
  `src/lib/scoring.ts`. The four helper functions
  (`betweennessCentrality`, `topRegionShare`, `countAlternatives`,
  `leadTimeMonths`) are independent; any can be replaced or removed
  without touching the others. The normalization step in
  `computeChokepointScores` (divide by max, multiply by 100, round)
  is a separate function and can stay or go. The display layer in
  `ChokepointScoreBadge.tsx` and the node sizing in
  `SupplyChainGraph.tsx` consume the final 0-100 number, not the raw
  factors; downstream code does not change.
owner: engineering
---

## decision

Score each node as
`centrality * geographic_concentration * substitutability * lead_time * scenario_multiplier`,
then normalize raw scores to a 0-100 display scale. The four factors
are computed in `src/lib/scoring.ts`; the scenario multiplier comes
from `src/lib/scenarios.ts`.

## alternatives

- Pure betweenness - misses geography, substitutability, and lead
  time.
- Capacity-simulation model - needs non-public capacity data.
- Expert-weighted scorecard - hides methodology and breaks the audit
  trail.
- Deep-learning predictor - overfits on a small outage corpus and is
  not reviewable.

## rationale

Each factor maps to one piece of chokepoint intuition. Multiplying
the factors means a node scoring high across the board scores far
above the median; a node strong on three of four but weak on one
falls back to the middle. That matches supply-chain risk composition:
a sole-supplier with short lead times has a hedge (inventory); a
sole-supplier with multi-quarter lead times does not.

The score is decision-support, not forecast. `docs/methodology.md`
documents the formula and the variables; `docs/known-limitations.md`
names what is not modeled (capacity, inventory, customer mix,
pricing, demand elasticity).

## evidence

- `src/lib/scoring.ts` - `chokepointScore` plus the four factor
  helpers and the betweenness implementation.
- `docs/methodology.md` - prose version of the same formula.
- `docs/known-limitations.md` - the explicit non-coverage list.
- `src/lib/scenarios.ts` - `scenarioMultiplier` is the fifth factor.
- `src/components/ChokepointScoreBadge.tsx` - the display surface.

## rollback

Edit `chokepointScore` in `src/lib/scoring.ts`. The four helpers
are independent; any can be swapped without touching the others.
The normalization in `computeChokepointScores` is separate. Display
and node-sizing code reads the final 0-100 number and does not
change.
