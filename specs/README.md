# specs

The repo uses a six-file spec pattern:

- `requirements.md`
- `design.md`
- `tasks.md`
- `acceptance.md`
- `research.md`
- `traceability.md`

Active specs:

- `0001-cognitive-delivery-control-plane/` - CDCP scaffold install
  (R-CDCP-001..010).

Each spec folder carries the same six files:
`requirements.md`, `design.md`, `tasks.md`, `acceptance.md`,
`research.md`, `traceability.md`.

Allowed R-* prefixes:

- `CDCP` - 0001 cognitive delivery control plane
- `MAP` - supply-chain map architecture (Cytoscape, fcose, scoring,
  scenarios, data-freshness)
- `GRAPH` - graph rendering surface
- `DATA` - data CSV contract, freshness, sources
- `UI` - app surface, panels, controls
- `SCEN` - scenario design and toggles
- `OPS` - ops, deployment, CI gates

Development loop:

1. Add or update requirement IDs.
2. Design interfaces and failure modes before code.
3. Add fixtures or golden cases before implementation.
4. Implement the narrowest traceable slice.
5. Run gates and record evidence.
6. Update traceability and status.
