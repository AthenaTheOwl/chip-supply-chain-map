# No. 12 - chip-supply-chain-map

The global semiconductor supply chain as a dependency graph. Foundries,
OSATs, equipment, substrates, EDA, hyperscalers, and chokepoints are mapped
with scenario toggles for disruption analysis.

Deployed at: pending. The parent agent will create the remote and handle push.

![Graph overview](./public/screenshots/hero.png)

## What It Does

The app renders 78 companies and 180 curated dependency edges. Selecting a node
shows what it depends on, what depends on it, source links, geography, and a
chokepoint score that updates as disruption scenarios are toggled.

![Scenario toggle preview](./public/screenshots/scenario-active.gif)

## Stack

React 18, Vite 5, TypeScript 5, Cytoscape.js, cytoscape-fcose, Tailwind CSS 3,
and Zustand.

## Local Dev

```bash
npm.cmd install
npm.cmd run dev
npm.cmd run build
```

## Methodology

See [docs/methodology.md](./docs/methodology.md). This is a decision-support
heuristic, not a rigorous industry model. Limitations are documented in
[docs/known-limitations.md](./docs/known-limitations.md).

## Data

- `src/data/nodes.csv` - companies and high-level attributes
- `src/data/edges.csv` - directional dependencies
- `src/data/sources.md` - source IDs used by the CSV files

The data favors official annual reports, SEC/company pages, and industry reports.
Some supplier-customer edges are public-claim heuristics where companies do not
disclose exact volumes or customer mix.
