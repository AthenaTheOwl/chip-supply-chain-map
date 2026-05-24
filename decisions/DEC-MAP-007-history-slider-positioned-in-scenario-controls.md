---
id: DEC-MAP-007-history-slider-positioned-in-scenario-controls
spec: specs/0001-cognitive-delivery-control-plane/
requirement: R-MAP-007
date: 2026-05-24
status: approved
reversible: true
decision: |
  Mount `HistorySlider` inside the existing `ScenarioControls`
  panel, below the scenario toggle group. The slider shares the
  same left-hand sidebar as the scenario toggles and shares the
  same disclosure pattern (`<details>` open by default, summary
  shows the active count). The slider reads and writes the
  `currentQuarter` field on the Zustand store. The graph reads
  the same field and recolors nodes as the slider moves.
alternatives:
  - label: dedicated History tab as a top-level navigation
    rejected_because: |
      Tabs add a navigation surface to an app whose primary
      affordance is a single screen with three panes. A second
      tab would split the audience's attention away from the
      graph and would imply that History is a separate mode of
      the app instead of another lens on the same graph.
  - label: modal overlay triggered by a History button
    rejected_because: |
      Modals hide the graph behind a curtain while the user
      scrubs. The whole point of the slider is to watch the
      graph recolor as the quarter moves; a modal defeats the
      affordance.
  - label: top-of-page banner with a horizontal scrubber
    rejected_because: |
      A banner consumes vertical space on every screen size.
      The compact slider inside ScenarioControls leaves the
      graph fully visible on a 1024-px-wide laptop screen, which
      is the dominant target for the layperson audience.
  - label: floating overlay anchored to the bottom of the graph
    rejected_because: |
      A floating overlay overlaps the Legend in the bottom-left
      corner and overlaps the cytoscape pan/zoom affordances.
      Co-locating with ScenarioControls keeps the graph area
      clear.
rationale: |
  History and scenarios are both "what-if" surfaces. Scenarios
  ask "what if this shock fires today"; the slider asks "what
  did the chokepoint shape look like one quarter ago, two
  quarters ago, three quarters ago." Co-locating them keeps the
  UI compact for laypeople and signals that both controls speak
  to the same audience question: how chokepoint risk shifts
  under different conditions.

  The slider lives below the scenario toggle group (not above it)
  so the default view (the live snapshot with no scenarios
  active) still presents the scenarios first. A user
  who scrolls past the toggles meets the slider next. The
  slider's helper text names the historical row as synthetic
  data, mirroring the disclosure pattern in
  `docs/scoring-history.md`.

  The slider writes to the same Zustand store as the scenario
  toggles, keeping a single source of truth for the graph's
  display state. The graph reads `currentQuarter` and recolors
  nodes via `getScoreMapForQuarter` in `src/lib/history.ts`.
  When `currentQuarter` is `"current"`, the graph falls back to
  the live scoring path, preserving the existing
  single-snapshot behavior.
evidence:
  - kind: doc
    ref: src/components/HistorySlider.tsx (the slider component)
  - kind: doc
    ref: src/components/ScenarioControls.tsx (the host panel that mounts the slider)
  - kind: doc
    ref: src/state/store.ts (the currentQuarter field on the Zustand store)
  - kind: doc
    ref: src/components/SupplyChainGraph.tsx (the quarter prop that drives recoloring)
  - kind: doc
    ref: src/App.tsx (the wiring of store -> graph)
  - kind: decision
    ref: decisions/DEC-MAP-004-scenario-design-as-toggle-not-slider.md (the scenario-toggle pattern the slider sits next to)
rollback: |
  Move `HistorySlider` out of `ScenarioControls.tsx` and into a
  new top-level component (for example
  `src/components/HistoryPanel.tsx`). Mount the new component
  alongside `ScenarioControls` in `src/App.tsx`. The data layer
  in `src/lib/history.ts`, the `currentQuarter` field on the
  store, and the `quarter` prop on `SupplyChainGraph` stay
  unchanged. The reposition is a one-component move; the slider
  itself does not change.
owner: engineering
---

## decision

Mount `HistorySlider` inside the existing `ScenarioControls`
panel, below the scenario toggle group. The slider shares the
sidebar and the disclosure pattern with the toggles. The slider
writes to a `currentQuarter` field on the Zustand store; the
graph reads the same field and recolors via
`getScoreMapForQuarter`.

## alternatives

- Dedicated History tab - adds a navigation surface to a
  single-screen app and splits the audience's attention.
- Modal overlay - hides the graph while the user scrubs, which
  defeats the watch-it-recolor affordance.
- Top-of-page banner - consumes vertical space on every screen
  size.
- Floating overlay on the graph - overlaps the Legend and the
  pan/zoom affordances.

## rationale

History and scenarios are both "what-if" surfaces aimed at the
same audience question: how chokepoint risk shifts under
different conditions. Co-locating them keeps the UI compact for
laypeople. The slider lives below the toggle group so the
default view still presents the scenarios first; the helper
text names the historical row as synthetic data.

## evidence

- `src/components/HistorySlider.tsx` - the slider component.
- `src/components/ScenarioControls.tsx` - the host panel.
- `src/state/store.ts` - the `currentQuarter` field.
- `src/components/SupplyChainGraph.tsx` - the `quarter` prop.
- `src/App.tsx` - the wiring of store to graph.
- `DEC-MAP-004-scenario-design-as-toggle-not-slider.md` - the
  scenario-toggle pattern the slider sits next to.

## rollback

Move `HistorySlider` into a new top-level component (for
example `src/components/HistoryPanel.tsx`) and mount it
alongside `ScenarioControls` in `src/App.tsx`. The data layer,
the store field, and the graph prop stay unchanged. The
reposition is a one-component move.
