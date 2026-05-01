# No. 12 - chip-supply-chain-map

The global semiconductor supply chain as a dependency graph. Foundries,
OSATs, equipment, substrates, EDA, hyperscalers, and chokepoints — with
scenario toggles for disruption analysis.

deployed at: <URL once live>

![Graph overview](./public/screenshots/hero.png)

## what it does

78 companies. 180 curated dependency edges. Click any node to see what it
depends on, what depends on it, source links, geography, and a chokepoint
score that updates as you toggle disruption scenarios.

![Scenario toggle preview](./public/screenshots/scenario-active.gif)

## stack

React 18 · Vite 5 · TypeScript 5 · Cytoscape.js · cytoscape-fcose · Tailwind 3
· Zustand.

## local dev

```bash
npm.cmd install
npm.cmd run dev
npm.cmd run build
```

## methodology

See [docs/methodology.md](./docs/methodology.md). A decision-support heuristic,
not a rigorous industry model. Limitations are documented in
[docs/known-limitations.md](./docs/known-limitations.md).

## data

- `src/data/nodes.csv` — companies and high-level attributes
- `src/data/edges.csv` — directional dependencies
- `src/data/sources.md` — source IDs used by the CSV files

Sources favor official annual reports, SEC and company pages, and industry
reports. Some supplier-customer edges are public-claim heuristics where
companies don't disclose exact volumes or customer mix.
