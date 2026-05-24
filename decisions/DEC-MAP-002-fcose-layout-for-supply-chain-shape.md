---
id: DEC-MAP-002-fcose-layout-for-supply-chain-shape
spec: specs/0001-cognitive-delivery-control-plane/
requirement: R-MAP-002
date: 2026-05-24
status: approved
reversible: true
decision: |
  Use the fcose layout from cytoscape-fcose for the initial graph
  placement, configured with `quality: "proof"`, `idealEdgeLength: 120`,
  `nodeSeparation: 90`, `packComponents: true`, `animate: false`, and
  `randomize: false`. The combination produces a stable, readable
  placement for a mostly-DAG supply chain that has occasional back-
  edges from materials and equipment into foundries.
alternatives:
  - label: dagre (rank-based DAG layout)
    rejected_because: |
      dagre is the right choice for a strict directed acyclic graph.
      The supply-chain graph here has back-edges (materials suppliers
      depend on equipment makers, fabless companies depend on EDA
      tools, packaging substrates feed into the same foundries that
      consume them indirectly), and dagre forces those into a
      rank-violating arc. The result reads as a tangled vertical
      stack and loses the regional cluster signal.
  - label: klay (KIELER layered layout)
    rejected_because: |
      klay handles layered graphs cleanly but the supply chain is not
      one. The graph has natural geographic and type clusters (Taiwan
      foundries, US fabless designers, EDA tools, Japanese materials)
      that fcose surfaces through force-directed proximity. klay
      flattens those into a layered view that loses the cluster
      signal.
  - label: cose (Cytoscape's bundled force-directed layout)
    rejected_because: |
      cose works but produces less stable placements between runs and
      handles disconnected sub-components less cleanly than fcose.
      fcose is the modern replacement and ships separately as
      cytoscape-fcose.
  - label: breadthfirst (concentric tree layout)
    rejected_because: |
      breadthfirst needs a designated root and produces a tree, not
      a graph. Picking TSMC or NVIDIA as the root forces the rest of
      the graph into a hierarchy that hides cross-cluster edges.
  - label: preset (hand-coded coordinates per node)
    rejected_because: |
      Hand coordinates require maintenance every time the CSV
      changes. The data refresh cadence (per the 180-day freshness
      gate) is months; hand-coding 78 positions and re-running them
      on every refresh is a chore that fcose handles automatically.
rationale: |
  The supply chain reads as clusters with some bridging back-edges:
  Taiwan foundries, US fabless designers, US/JP/NL lithography and
  process equipment, JP/KR materials, US/JP/TW packaging substrates,
  KR/US memory, US hyperscalers, plus auto/industrial demand. fcose
  surfaces those clusters through force-directed proximity while
  keeping the bridges (equipment supplying foundries, foundries
  supplying fabless, packaging consuming substrates) readable.

  The `randomize: false` and `quality: "proof"` settings together
  give a deterministic placement on every fresh load, which matters
  for screenshots, demo links, and visual review across data
  refreshes. `packComponents: true` keeps disconnected components
  (rare here but possible after a data refresh) from drifting off-
  canvas. `idealEdgeLength: 120` and `nodeSeparation: 90` were tuned
  by hand for the current 78-node / 180-edge graph; they may need a
  pass when the node count crosses 100.
evidence:
  - kind: doc
    ref: src/components/SupplyChainGraph.tsx (lines 140-150, the cy.layout call)
  - kind: doc
    ref: package.json (cytoscape-fcose pinned at ^2.2.0)
  - kind: doc
    ref: src/data/nodes.csv (78 nodes across 10 type categories)
  - kind: doc
    ref: src/data/edges.csv (180 edges including back-edges from materials and equipment)
  - kind: doc
    ref: docs/methodology.md (graph is treated as undirected for centrality, but the visual layer respects edge direction)
rollback: |
  Replace the `cy.layout({ name: "fcose", ... }).run()` block in
  `SupplyChainGraph.tsx` with a call to one of the bundled layouts
  (`cose`, `breadthfirst`, `dagre`, `preset`). For `preset`, supply a
  `positions` map keyed by node id. For `dagre`, install
  `cytoscape-dagre` and register the extension before the cytoscape
  call. The layout choice is local to the component; no other file
  changes.
owner: engineering
---

## decision

Use cytoscape-fcose with `quality: "proof"`,
`idealEdgeLength: 120`, `nodeSeparation: 90`,
`packComponents: true`, `animate: false`, and `randomize: false` as
the initial layout. The settings produce a deterministic,
cluster-readable placement of the supply-chain graph on every fresh
load.

## alternatives

- dagre - strict-DAG rank layout; back-edges force a tangled vertical
  stack.
- klay - layered layout; loses the geographic and type clusters.
- cose - force-directed but older and less stable than fcose.
- breadthfirst - tree layout; needs a root and hides cross-cluster
  edges.
- preset - hand-coded coordinates; maintenance burden on every CSV
  refresh.

## rationale

The supply chain reads as clusters (Taiwan foundries, US fabless,
EDA, equipment, materials, substrates, memory, hyperscalers,
auto/industrial) with bridging back-edges. fcose surfaces clusters
through force-directed proximity while keeping the bridges
readable. `randomize: false` gives deterministic placement for
screenshots and demo links. `packComponents: true` keeps
disconnected components on canvas. The tuning values
(`idealEdgeLength: 120`, `nodeSeparation: 90`) were chosen by hand
for the current node count.

## evidence

- `src/components/SupplyChainGraph.tsx` (lines 140-150) - the
  exact `cy.layout` call with all six settings.
- `package.json` - `cytoscape-fcose@^2.2.0` pinned.
- `src/data/nodes.csv` and `src/data/edges.csv` - the 78-node /
  180-edge shape the tuning was done against.
- `docs/methodology.md` - notes that centrality treats the graph
  as undirected even though the visual layer respects direction.

## rollback

Replace the `cy.layout` call with a different layout name and
options block. The layout choice is local to one component; no
other file changes are required. If a future refresh pushes the
node count past 100, the tuning values may need a pass before
reverting to a different layout.
