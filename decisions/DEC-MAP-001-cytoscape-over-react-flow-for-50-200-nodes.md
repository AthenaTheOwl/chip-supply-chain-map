---
id: DEC-MAP-001-cytoscape-over-react-flow-for-50-200-nodes
spec: specs/0001-cognitive-delivery-control-plane/
requirement: R-MAP-001
date: 2026-05-24
status: approved
reversible: true
decision: |
  Render the supply-chain dependency graph with Cytoscape.js plus the
  fcose layout extension and the popper tooltip extension, wired into
  React through a single useEffect that owns the Cytoscape Core
  instance in `src/components/SupplyChainGraph.tsx`. The library
  carries the directed-graph primitives the chokepoint heuristic needs
  (Brandes betweenness, neighborhood traversal, edge filtering by
  class), and it scales to the 78-node / 180-edge curated graph
  without a virtualization layer.
alternatives:
  - label: react-flow (React component graph library)
    rejected_because: |
      react-flow targets workflow editors and node-based UIs first;
      its centrality and pathfinding story is thin, and its
      Auto-Layout add-on wraps elkjs and dagre instead of shipping
      a graph-algorithm engine. At 50-200 nodes with mixed
      forward and back-edges the layout quality is below fcose, and
      pulling in elkjs for betweenness centrality reproduces work
      Cytoscape already does.
  - label: vis-network
    rejected_because: |
      vis-network is a strong physics-simulation library but lacks
      a clean React integration and exposes a less typed API. The
      add-on ecosystem is smaller than Cytoscape's, and the layout
      hooks for stable initial positions are weaker.
  - label: d3-force
    rejected_because: |
      d3-force is the right tool when you want full control over the
      simulation, but every graph-algorithm helper (centrality,
      shortest paths, neighborhood) has to be written by hand. That
      reimplementation is the bulk of the work and adds no signal
      this app needs.
  - label: hand-rolled SVG with manual layout
    rejected_because: |
      The graph has 50-200 nodes and supports interactive pan, zoom,
      tap, hover, and edge filtering across six scenario toggles.
      Hand-rolled SVG turns into a layout engine rewrite for the
      first iteration; the second iteration adds touch and zoom
      handling. Cytoscape already covers these.
rationale: |
  Cytoscape sits in the sweet spot for this app's node count and
  computation needs. The 78-node / 180-edge curated graph is small
  enough that a single useEffect can own the Core instance, but
  large enough that automatic layout matters. The chokepoint score
  in `src/lib/scoring.ts` runs Brandes betweenness centrality
  directly on the GraphData adjacency, which is a TypeScript
  reimplementation, not a Cytoscape call. The visual side (node
  sizing by score, edge filtering by scenario, hover tooltips, tap
  selection) is straight Cytoscape API.

  The library is well-typed (`@types/cytoscape` covers the API
  surface this app uses), the extension ecosystem includes
  cytoscape-fcose for layout and cytoscape-popper for tooltips, and
  Vite picks up the ESM build cleanly. The bundled size is acceptable
  for the deployed Vercel preview; no virtualization or canvas-level
  optimization is needed at this node count.
evidence:
  - kind: doc
    ref: src/components/SupplyChainGraph.tsx (the Core-owning useEffect)
  - kind: doc
    ref: src/lib/scoring.ts (Brandes betweenness implementation that consumes the same GraphData)
  - kind: doc
    ref: package.json (cytoscape 3.30.0, cytoscape-fcose 2.2.0, cytoscape-popper 4.0.0, @types/cytoscape 3.21.0)
  - kind: doc
    ref: docs/methodology.md (the heuristic depends on graph-library primitives)
  - kind: doc
    ref: src/data/nodes.csv (78 nodes)
  - kind: doc
    ref: src/data/edges.csv (180 edges)
rollback: |
  The library choice is reversible with bounded effort. To swap to
  react-flow or d3-force: rewrite the `SupplyChainGraph.tsx`
  component against the new library's API, port the styling block
  (node colors by type, edge widths by strength, suppressed-edge
  class, hover tooltip), and re-wire the tap and hover handlers to
  call `setSelectedNode` and `setTooltip` from the same Zustand
  store. The GraphData type contract and the scoring layer in
  `src/lib/scoring.ts` are library-independent and stay as-is. The
  fcose layout call sites would convert to dagre, elkjs, or
  d3-force equivalents.
owner: engineering
---

## decision

Use Cytoscape.js plus cytoscape-fcose and cytoscape-popper as the
graph rendering layer for `SupplyChainGraph.tsx`. The choice covers
the 78-node / 180-edge curated graph at deploy time and the 50-200
range planned for any future data refresh.

## alternatives

- react-flow - workflow-editor focus; weaker centrality story; layout
  quality drops below fcose at this node count.
- vis-network - good physics engine; weaker React integration and
  smaller add-on ecosystem.
- d3-force - full control but reimplements centrality and
  neighborhood helpers Cytoscape ships.
- Hand-rolled SVG - turns into a layout-engine rewrite for the first
  iteration and a touch-handler rewrite for the second.

## rationale

The 78-node / 180-edge graph is small enough that Cytoscape's
single-Core-per-component pattern works, large enough that automatic
layout matters. Brandes betweenness runs against the GraphData
adjacency in TypeScript (in `src/lib/scoring.ts`); the rest of the
visual surface - node sizing by score, edge filtering by class,
hover tooltips, tap selection - sits cleanly on Cytoscape's API.
The library has strong TypeScript types, a Vite-friendly ESM build,
and a stable extension surface.

## evidence

- `src/components/SupplyChainGraph.tsx` - the Core-owning useEffect
  showing the rendering and event flow.
- `src/lib/scoring.ts` - the betweenness-centrality implementation
  that consumes GraphData independently of the library.
- `package.json` - the pinned `cytoscape@^3.30.0`,
  `cytoscape-fcose@^2.2.0`, `cytoscape-popper@^4.0.0`, and
  `@types/cytoscape@^3.21.0` entries.
- `docs/methodology.md` - documents why the heuristic needs the
  graph-library primitives.
- `src/data/nodes.csv` and `src/data/edges.csv` - the node and edge
  counts that define the relevant scale band.

## rollback

Swap libraries by rewriting `SupplyChainGraph.tsx` against the new
API and porting the styling block, the tap and hover handlers, and
the layout-call site. The GraphData type and the scoring layer are
library-independent. The layout call converts cleanly to dagre or
elkjs equivalents if react-flow is chosen later.
