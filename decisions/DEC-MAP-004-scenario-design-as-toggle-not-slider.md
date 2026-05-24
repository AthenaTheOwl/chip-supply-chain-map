---
id: DEC-MAP-004-scenario-design-as-toggle-not-slider
spec: specs/0001-cognitive-delivery-control-plane/
requirement: R-MAP-004
date: 2026-05-24
status: approved
reversible: true
decision: |
  Render scenarios as binary on/off toggles in `ScenarioControls.tsx`,
  each driving a fixed multiplier on a named list of nodes via the
  `impactOn` function in `SCENARIOS`. Multiple scenarios may run at
  once; their multipliers compose multiplicatively in
  `scenarioMultiplier`. The six bundled scenarios are
  `taiwan-capacity-shock`, `advanced-packaging-bottleneck`,
  `substrate-shortage`, `lithography-constraint`, `export-controls`,
  and `ai-demand-spike`. The export-controls scenario also visually
  suppresses equipment-to-China edges via the edge `suppressed` class.
alternatives:
  - label: continuous intensity slider per scenario
    rejected_because: |
      A slider implies the multiplier is calibrated. It is not: the
      2.3 for Taiwan-capacity-shock, the 1.9 for EUV equipment delay,
      and the 1.5 for export controls are coarse expert judgements,
      not measured elasticities. Letting the user dial intensity from
      0% to 200% gives the false impression that 47% is meaningfully
      different from 52%. The chokepoint score is a heuristic;
      pedagogical clarity beats false precision.
  - label: multi-state dropdown per scenario (mild / moderate / severe)
    rejected_because: |
      Same problem as the slider, milder. Three buckets still implies
      calibration that does not exist. The binary toggle is honest:
      the scenario is either on or off; if it is on, the affected
      nodes get the bundled multiplier.
  - label: free-form scenario builder (user picks nodes and multiplier)
    rejected_because: |
      Premature and off-topic. The app's job is to expose chokepoint
      intuition under a small set of pre-curated disruption shapes,
      not to be a scenario-design tool. A builder shifts the surface
      from teaching tool to capacity-planning toy and reopens the
      false-precision problem at scale.
  - label: single-scenario radio (pick one)
    rejected_because: |
      Real disruption events compound. ABF substrate shortages
      coincided with COVID auto-chip demand whiplash; export controls
      compound with capacity shocks. Forbidding compound scenarios
      hides that interaction, which is one of the points the app
      makes.
rationale: |
  The chokepoint score is a transparent heuristic, not a measurement.
  Each scenario multiplier in `src/lib/scenarios.ts` is hand-picked
  to match a publicly documented historical analog (the 2.2 for ABF
  substrate shortage references the 2020-2022 ABF squeeze; the 1.9
  for EUV equipment delay matches reported deployment slips; the
  1.5 for export controls matches the share of restricted equipment
  flows). Those numbers carry meaning at coarse intervals but not at
  fine ones.

  The binary toggle keeps the control surface honest. A user sees
  six scenarios, picks any subset, and reads the resulting
  chokepoint distribution. The export-controls scenario adds a
  second teaching signal: edges from US/JP/NL equipment makers into
  SMIC, YMTC, and Hua Hong render as suppressed dashed lines,
  showing the flow that is no longer permitted. That visual cue
  generalizes the multiplier into a structural change in the graph.

  Compound scenarios are explicitly allowed because real disruptions
  compound. The reducer in `scenarioMultiplier` multiplies the
  per-scenario impact, so a node hit by two active scenarios
  receives the product of both multipliers - matching the
  intuition that two simultaneous shocks are worse than either
  alone.
evidence:
  - kind: doc
    ref: src/lib/scenarios.ts (SCENARIOS array, impactOn lambdas, scenarioMultiplier reducer)
  - kind: doc
    ref: src/components/ScenarioControls.tsx (the toggle UI surface)
  - kind: doc
    ref: docs/scenario-design.md (per-scenario rationale and historical analogs)
  - kind: doc
    ref: docs/methodology.md (notes the score is a heuristic, not a measurement)
  - kind: doc
    ref: src/components/SupplyChainGraph.tsx (edge suppressed class for export-controls)
rollback: |
  Replacing the toggle with a slider is a localized change: edit
  `ScenarioControls.tsx` to render a range input, change `impactOn`
  in `src/lib/scenarios.ts` to accept a per-scenario intensity
  parameter, and update `scenarioMultiplier` to read the intensity
  from the store. The export-controls edge-suppression rule in
  `src/lib/scenarios.ts::isEdgeSuppressedByScenarios` stays binary
  unless the slider crosses a configured threshold. The Zustand
  store `activeScenarioIds` would convert to a map of id-to-intensity.
owner: engineering
---

## decision

Render scenarios as binary on/off toggles. Each active scenario
contributes a fixed multiplier to affected nodes; multiple active
scenarios compose multiplicatively. The control surface lives in
`ScenarioControls.tsx`; the impact functions live in
`src/lib/scenarios.ts`.

## alternatives

- Continuous intensity slider - implies calibration the heuristic
  does not have.
- Multi-state dropdown (mild / moderate / severe) - same problem,
  milder.
- Free-form scenario builder - turns a teaching tool into a
  capacity-planning toy.
- Single-scenario radio - hides the real compounding of disruptions.

## rationale

The chokepoint score is a transparent heuristic. The per-scenario
multipliers (2.3 for Taiwan capacity, 1.9 for EUV equipment delay,
1.5 for export controls) match publicly documented historical
analogs at coarse intervals. Sliders or dropdowns imply finer
calibration than the data supports. Toggles keep the surface honest;
compound scenarios are allowed because real disruptions compound.
The export-controls scenario also suppresses equipment-to-China
edges visually, generalizing the multiplier into a structural
graph change.

## evidence

- `src/lib/scenarios.ts` - the SCENARIOS array and the
  `scenarioMultiplier` reducer.
- `src/components/ScenarioControls.tsx` - the toggle UI.
- `docs/scenario-design.md` - per-scenario rationale plus historical
  analogs.
- `docs/methodology.md` - documents the score as a heuristic.
- `src/components/SupplyChainGraph.tsx` - the edge `suppressed`
  class for the export-controls visual rule.

## rollback

Convert to a slider by editing `ScenarioControls.tsx`, the
`impactOn` lambdas in `src/lib/scenarios.ts`, and the
`scenarioMultiplier` reducer. The Zustand `activeScenarioIds` shape
becomes a map of id-to-intensity. The edge-suppression rule stays
binary unless the slider crosses a configured threshold.
