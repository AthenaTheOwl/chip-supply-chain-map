# Chip supply chain map

Seventy-eight nodes and 180 edges. Click a lithography node and the graph reminds you that a supply chain can fit on a screen only after you remove the panic.

**Live:** [chip-supply-chain-map.vercel.app](https://chip-supply-chain-map.vercel.app/)

![Graph overview](./public/screenshots/hero.png)

## What you can do

- Browse a hand-curated semiconductor dependency graph across foundries, fabless design, EDA/IP, equipment, materials, substrates, memory, packaging, hyperscalers, and industrial demand.
- Click a node to see dependencies, geography, lead times, chokepoint score, investor sensitivity records, and source IDs.
- Toggle nine scenarios, including Taiwan capacity shock, packaging bottleneck, substrate shortage, equipment delay, export-control tightening, HBM and CoWoS stress, and AI accelerator demand growth.
- Build an investor watchlist from graph nodes, inspect aggregate exposure, and export a sourced JSON or markdown risk packet.

![Scenario toggle preview](./public/screenshots/scenario-active.gif)

## How it works

The graph is rendered with Cytoscape.js and the fcose layout extension. Each node carries a chokepoint score:

```text
centrality * geographic_concentration * substitutability * lead_time * scenario_multiplier
```

The score is normalized onto a 0-100 display scale after each scenario change. It is a decision-support heuristic. The four factors are documented in [docs/methodology.md](./docs/methodology.md) and recorded as DEC-MAP-003.

The export-controls scenario visually suppresses restricted equipment-to-China edges by rendering them as dashed lines at low opacity. The edge still exists. The warning light changes color.

## What to inspect first

Start with one known node, then turn on one scenario. The useful moment is the second click: a dependency that looked local becomes a geography problem, a lead-time problem, or a single-tool problem.

For the scoring formula, read [docs/methodology.md](./docs/methodology.md). For the places where the model admits defeat, read [docs/known-limitations.md](./docs/known-limitations.md). For scenario design, read [docs/scenario-design.md](./docs/scenario-design.md).

## Stack

React 18, Vite 5, TypeScript 5 strict, Cytoscape.js, cytoscape-fcose, cytoscape-popper, Tailwind 3, Zustand.

The scoring layer is plain TypeScript against the `GraphData` contract. The graph library can change without rewriting the chokepoint calculation.

## Local dev

```bash
npm.cmd install
npm.cmd run dev
npm.cmd run build
```

## Live demo

Live Vercel app: <https://chip-supply-chain-map.vercel.app/>

Vercel build settings:

```text
build command: npm run build
output directory: dist
```

## Data

- `src/data/nodes.csv` - 78 companies and high-level attributes.
- `src/data/edges.csv` - 180 directional dependencies.
- `src/data/financial_sensitivity.csv` - sourced public-company revenue, capex, backlog, and exposure records keyed by node and scenario.
- `src/data/sources.md` - source IDs used by the CSV files.

Sources favor official annual reports, SEC and company pages, and industry reports from SIA, BCG, and SEMI. Some supplier-customer edges are public-claim heuristics where companies do not disclose exact volumes or customer mix.

## Governance

The repo runs the Cognitive Delivery Control Plane operating model: spec ledger, decisions, dreams, `.agents/`, `ops/`, and Python gate scripts.

- `specs/0001-cognitive-delivery-control-plane/` - the CDCP install.
- `decisions/` - map, financial-sensitivity, and watchlist decision records.
- `.agents/AGENTS.md` - the coding-agent contract.
- `ops/RELEASE_LEDGER.md` and `ops/RESET_LEDGER.md` - release and rollback audit trails.
- `scripts/` - spec, voice, decision, role, tool, policy, data-freshness, schema-cache, and dream gates.

The 180-day data-freshness gate is wired into `.github/workflows/stale-data.yml`.

## Connects to

- `supplier-risk-rag-agent` for cited SEC risk text behind supply-chain exposure claims.
- `semiconductor-e2e-manufacturing-optimization` for wafer-sourcing stress tests below the graph.
- `ai-supply-chain-copilot-prd` for the exception workflow that would route graph findings into triage.

## What's intentionally absent

- Real-time data feeds.
- Live market data or earnings projections.
- A complete capacity model of the industry.
- Wafer-start, HBM-stack, CoWoS-line, or fab-utilization data at private granularity.

## License

MIT for code. CC BY 4.0 for data and docs.
