---
id: DEC-FIN-009-additional-scenarios
amends: DEC-FIN-008-chip-map-dedicated-determinism-fixture
spec: specs/0002-earnings-sensitivity-overlay/
requirement: R-FIN-028
date: 2026-05-29
status: approved
reversible: true
decision: |
  chip-supply-chain-map adds two scenarios to `src/lib/scenarios.ts`:
  `cowos-l-bottleneck` (the deepened advanced-packaging-bottleneck
  variant focused on CoWoS-L line capacity) and
  `lithography-equipment-constraint` (the high-NA EUV plus
  mask-inspection capacity constraint on the lithography supplier
  layer). Both scenarios layer richer modeling on top of the existing
  `impactOn(node) => number` multiplier:

  - `edgeImpact(edge, graph)` returns an optional
    `ScenarioEdgeAdjustment` that bumps an edge's `strength` one step
    when the edge matches the scenario's failure mode. The
    `cowos-l-bottleneck` scenario bumps `packages-for`,
    `supplies-substrates`, and `manufactures-for` edges into the two
    accelerator platform rows (`nvidia-blackwell-gb200`,
    `amd-instinct-mi-family`). The
    `lithography-equipment-constraint` scenario bumps
    `supplies-equipment` edges from the four lithography suppliers
    (ASML, Nikon, Canon, Lasertec) into the three leading-edge
    foundries (TSMC, Samsung Foundry, Intel Foundry).
  - `nodeAttributeImpact(node)` returns an optional
    `ScenarioNodeAttributeAdjustment` that adds lead-time months on
    the directly exposed nodes. The `cowos-l-bottleneck` scenario
    adds six months on TSMC and the ABF substrate subtype nodes; the
    `lithography-equipment-constraint` scenario adds nine months on
    ASML and six months on Lasertec.

  `src/lib/scoring.ts::chokepointScore` folds the lead-time bumps
  into the lead-time term and adds a `scenarioEdgePressure` factor
  that reads the edge-strength bumps. The factor compares the
  scenario-on weighted-edge sum against the scenario-off baseline so
  an unmodified graph keeps its baseline score.

  The two scenarios appear in the existing `ScenarioControls.tsx`
  toggle list automatically because the UI iterates the `SCENARIOS`
  array. No new controls or wiring are needed in the React shell.

  Test coverage lands at `src/lib/scenarios.test.ts` (registry
  plumbing, per-node multiplier target sets, edge-strength bumps
  with both compounding and ceiling-at-critical behavior, lead-time
  bumps, raw chokepoint score deltas, and a normalized-rank
  snapshot). The test is wired into `npm test` via
  `scripts/run_ts_tests.mjs`.

  `docs/scenario-design.md` gains two sections that name the
  scenario id, the trigger, what is modeled and what is not, the
  multiplier, the edge impact, and the node attribute impact.
alternatives:
  - label: rename `advanced-packaging-bottleneck` in place to the deepened variant
    rejected_because: |
      The existing `advanced-packaging-bottleneck` scenario carries
      a coarser 1.8 multiplier on the broader packaging and
      substrate cluster. Renaming it to the deepened CoWoS-L variant
      would either drop the broader coverage or fold two different
      failure modes into one toggle. Adding a sibling scenario keeps
      both modes legible: a user can toggle the broad bottleneck or
      the deepened CoWoS-L variant, or both, and read each
      contribution to the score separately. The new scenario id
      `cowos-l-bottleneck` reads as the specific case it is.
  - label: replace `lithography-constraint` with the new
      `lithography-equipment-constraint`
    rejected_because: |
      The existing `lithography-constraint` scenario (label "EUV
      equipment delay") models a delivery-slip event: tools already
      on order miss their slot dates. The new
      `lithography-equipment-constraint` scenario models a different
      failure mode: vendor capacity caps. Both shapes are visible in
      the public discourse (delivery slips in 2023, capacity caps in
      2025-2026), so the toggles stay distinct. The id mirrors the
      original 4-repo plan's `lithography-equipment-constraint`
      shape exactly.
  - label: keep `impactOn` as the only scenario hook
    rejected_because: |
      The original `impactOn(node) => number` shape multiplies the
      chokepoint score for a hand-picked list of node ids. It cannot
      express edge-strength bumps (the failure mode where a
      previously medium link becomes critical because the supplier
      cannot ship enough volume) or node attribute bumps (the
      failure mode where a supplier's lead time stretches because
      tool throughput is rationed). The two new scenarios are about
      both shapes; bolting them onto `impactOn` would either crowd
      that function or push edge-level logic into the score
      reducer. Adding the optional `edgeImpact` and
      `nodeAttributeImpact` hooks keeps each shape in the place a
      reader expects to find it.
  - label: ship the new scenarios as a free-form scenario builder
    rejected_because: |
      DEC-MAP-004 already rejected the scenario-builder shape: it
      shifts the app from teaching tool to capacity-planning toy and
      reopens the false-precision problem the binary toggle was
      designed to avoid. The new scenarios stay inside the binary
      toggle frame; the richer modeling reads from typed callbacks,
      not user input.
rationale: |
  The original 4-repo plan listed six recommended scenario shapes:
  Taiwan capacity shock, advanced-packaging bottleneck, substrate
  shortage, lithography equipment constraint, export-control
  constraint, and AI accelerator demand spike. The chip-map repo
  had shipped variants of all six, but two of them sat at the
  coarse `impactOn(node) => number` level only. The packaging-side
  and lithography-side failure modes are the highest-impact gaps
  given the current AI hardware capacity discourse: CoWoS-L line
  capacity is the named bottleneck for the Blackwell ramp, and
  high-NA EUV plus mask-inspection capacity is the named
  bottleneck for the next leading-edge node transitions. Both modes
  need edge-level and node-attribute-level modeling to read
  honestly.

  This DEC adds two sibling scenarios with richer typed callbacks
  instead of rewriting the existing scenarios. The existing
  scenarios keep their simpler shape and their existing multipliers;
  the new scenarios add edge-strength bumps and lead-time bumps on
  top. A user can toggle either side, both, or any combination with
  the existing scenarios, and the score reducer composes the
  multipliers multiplicatively per DEC-MAP-004.

  Keeping the change reversible per the standard DEC contract: the
  new scenarios are additive entries in the `SCENARIOS` array, the
  `Scenario` interface gains two optional fields, and the scoring
  function gains a new pressure term that returns 1.0 when no
  scenario is active so the baseline score is unchanged. Reverting
  is a delete of the two array entries plus the optional fields.
evidence:
  - kind: decision
    ref: decisions/DEC-MAP-004-scenario-design-as-toggle-not-slider.md
  - kind: decision
    ref: decisions/DEC-MAP-003-chokepoint-score-heuristic.md
  - kind: decision
    ref: decisions/DEC-FIN-008-chip-map-dedicated-determinism-fixture.md
  - kind: doc
    ref: src/lib/scenarios.ts
  - kind: doc
    ref: src/lib/scoring.ts
  - kind: doc
    ref: src/lib/types.ts
  - kind: doc
    ref: src/lib/scenarios.test.ts
  - kind: doc
    ref: docs/scenario-design.md
  - kind: spec
    ref: specs/0002-earnings-sensitivity-overlay/requirements.md
rollback: |
  Delete the `cowos-l-bottleneck` and
  `lithography-equipment-constraint` entries from the `SCENARIOS`
  array in `src/lib/scenarios.ts`. Delete the
  `ScenarioEdgeAdjustment`, `ScenarioNodeAttributeAdjustment`,
  `edgeImpact`, and `nodeAttributeImpact` types from
  `src/lib/types.ts`. Delete `adjustedEdgeStrength`,
  `scenarioEdgeWeightMultiplier`, `scenarioLeadTimeBumpMonths`,
  `bumpStrength`, and the two bump helpers from
  `src/lib/scenarios.ts`. Revert the `chokepointScore` change in
  `src/lib/scoring.ts` to its DEC-FIN-008 shape (drop the
  `scenarioEdgePressure` term and the lead-time bump folding).
  Delete `src/lib/scenarios.test.ts` and revert the `npm test`
  entry in `package.json`. Revert the two new sections in
  `docs/scenario-design.md`. `R-FIN-028` through `R-FIN-030` come
  out of `requirements.md` and `traceability.md` in the same
  revert.
owner: control.coordinator
systems_map: |
  Scenario design as a typed extension point on a pure-function scoring
  pipeline. The system under change is the impact-modeling surface:
  scenarios layer richer callbacks (edgeImpact, nodeAttributeImpact) on
  top of the existing impactOn multiplier, and the scoring function
  reads through those callbacks instead of special-casing each id.
transferable_principle: |
  When a domain model needs richer modes, extend the existing interface
  with optional callbacks that compose with the baseline; do not fork
  the function. The scoring layer reads through the interface, not the
  scenario ids, so adding the eighth scenario costs no scoring change.
falsification_test: |
  If the scoring deltas under the two new scenarios produce ranks that
  domain reviewers reject as unrealistic (e.g. TSMC ranks below a
  non-leading-edge node under the lithography scenario), the multiplier
  or callback weights are wrong; the scenarios.test.ts snapshot is the
  ground-truth surface.
adoption_ladder:
  minimum_viable: |
    Two new scenarios in SCENARIOS array with impactOn lists only;
    edgeImpact and nodeAttributeImpact return undefined.
  mid_adoption: |
    Both callbacks populated for the two scenarios; scoring.ts folds
    the lead-time bumps and reads scenarioEdgePressure; tests cover
    the deltas.
  full_adoption: |
    Every scenario in the registry populates all three hooks where
    they apply; docs/scenario-design.md carries the analog for each;
    the test snapshot pins the normalized rank under each toggle.
  monitoring_signals:
    - scenarios.test.ts pass/fail per CI run
    - new scenario PRs include matching docs/scenario-design.md section
    - normalized-rank snapshot drift across scoring changes
---

## decision

chip-supply-chain-map adds two scenarios to `src/lib/scenarios.ts`:
`cowos-l-bottleneck` (the deepened advanced-packaging-bottleneck
variant focused on CoWoS-L line capacity) and
`lithography-equipment-constraint` (the high-NA EUV plus
mask-inspection capacity constraint). Both layer richer modeling on
top of the existing `impactOn` multiplier via two optional typed
hooks: `edgeImpact` bumps the `strength` of edges that match the
scenario's failure mode, and `nodeAttributeImpact` adds lead-time
months on the directly exposed nodes. `src/lib/scoring.ts` folds
the lead-time bumps into the lead-time term and reads the
edge-strength bumps through a `scenarioEdgePressure` factor that
returns 1.0 when no scenario is active.

Test coverage lands at `src/lib/scenarios.test.ts`. Documentation
lands at `docs/scenario-design.md`. The two scenarios appear in the
existing `ScenarioControls.tsx` toggle list because the UI iterates
the `SCENARIOS` array.

## alternatives

- Rename `advanced-packaging-bottleneck` in place: rejected because
  the existing scenario covers a broader cluster at a coarser
  multiplier; adding a sibling scenario keeps both failure modes
  legible.
- Replace `lithography-constraint` with the new
  `lithography-equipment-constraint`: rejected because the existing
  scenario models delivery slips on tools already on order; the new
  scenario models vendor capacity caps. Both shapes are visible in
  the public discourse, so the toggles stay distinct.
- Keep `impactOn` as the only scenario hook: rejected because the
  failure modes the two new scenarios target are about edge
  strength and lead-time stretch, not just per-node multipliers.
- Ship the new scenarios as a free-form scenario builder: rejected
  per DEC-MAP-004's toggle-not-builder framing.

## rationale

The original 4-repo plan recommended six scenario shapes; the
chip-map repo had shipped variants of all six but two of them sat
at the coarse `impactOn(node) => number` level only. The
packaging-side and lithography-side failure modes are the
highest-impact gaps given the AI hardware capacity discourse:
CoWoS-L line capacity is the named bottleneck for the Blackwell
ramp, and high-NA EUV plus mask-inspection capacity is the named
bottleneck for the next leading-edge node transitions. Both modes
need edge-level and node-attribute-level modeling to read honestly.

This DEC adds two sibling scenarios with richer typed callbacks
instead of rewriting the existing scenarios. The existing
scenarios keep their simpler shape and their existing multipliers;
the new scenarios add edge-strength bumps and lead-time bumps on
top. The score reducer composes the multipliers multiplicatively
per DEC-MAP-004.

The change is reversible: the new scenarios are additive entries in
the `SCENARIOS` array, the `Scenario` interface gains two optional
fields, and the scoring function gains a new pressure term that
returns 1.0 when no scenario is active so the baseline score is
unchanged.

## evidence

- `src/lib/scenarios.ts` carries the two new scenario entries plus
  the `adjustedEdgeStrength`, `scenarioEdgeWeightMultiplier`,
  `scenarioLeadTimeBumpMonths`, and `bumpStrength` helpers.
- `src/lib/types.ts` carries the new `ScenarioEdgeAdjustment`,
  `ScenarioNodeAttributeAdjustment`, `edgeImpact`, and
  `nodeAttributeImpact` types on the `Scenario` interface.
- `src/lib/scoring.ts` carries the `scenarioEdgePressure` factor
  plus the lead-time bump folding.
- `src/lib/scenarios.test.ts` carries the test coverage.
- `docs/scenario-design.md` carries the two new sections.

## rollback

Delete the two scenario entries from `SCENARIOS`, delete the
optional fields on the `Scenario` interface, revert the
`chokepointScore` change to the DEC-FIN-008 shape, delete the test
file, and revert the two new sections in `docs/scenario-design.md`.
`R-FIN-028` through `R-FIN-030` come out of `requirements.md` and
`traceability.md` in the same revert.

## coverage

This DEC resolves the following requirements added to spec 0002:

- `R-FIN-028` chip-supply-chain-map ships the `cowos-l-bottleneck`
  scenario at `src/lib/scenarios.ts` with the `impactOn` multiplier
  of 2.1 on TSMC, ASE, Amkor, Ibiden, Unimicron, Shinko, Blackwell
  GB200, and Instinct MI; the `edgeImpact` callback that bumps
  packaging and substrate edges into the accelerator platform rows
  one strength step; and the `nodeAttributeImpact` callback that
  adds a six-month lead-time bump on TSMC and the ABF substrate
  subtype nodes.
- `R-FIN-029` chip-supply-chain-map ships the
  `lithography-equipment-constraint` scenario at
  `src/lib/scenarios.ts` with the `impactOn` multiplier of 2.0 on
  ASML, Lasertec, Nikon, Canon, TSMC, Samsung Foundry, Intel
  Foundry, SK hynix, and Micron; the `edgeImpact` callback that
  bumps `supplies-equipment` edges from the four lithography
  suppliers into the three leading-edge foundries one strength
  step; and the `nodeAttributeImpact` callback that adds a
  nine-month lead-time bump on ASML and a six-month lead-time bump
  on Lasertec.
- `R-FIN-030` `src/lib/scoring.ts::chokepointScore` folds the
  scenario lead-time bumps into the lead-time term and reads the
  scenario edge-strength bumps through a `scenarioEdgePressure`
  factor that returns 1.0 when no scenario is active so the
  baseline chokepoint score is unchanged; the test fixture at
  `src/lib/scenarios.test.ts` covers registry plumbing, per-node
  multiplier target sets, edge-strength bumps with both
  compounding and ceiling-at-critical behavior, lead-time bumps,
  raw chokepoint score deltas, and a normalized-rank snapshot.
