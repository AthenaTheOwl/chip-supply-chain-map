# Decisions

## Data Model

- Kept the brief's CSV schemas exactly for `nodes.csv` and `edges.csv`.
- Used 78 nodes and 180 edges to stay inside the requested 50-100 node and
  100-200 edge ranges while covering every required company.
- Treated most edges as supplier-to-consumer, but kept the brief's procurement
  semantics for `procures-from-foundry` and `procures-from-fabless`: the source
  is the downstream buyer and the target is the supplier.

## Scoring

- Implemented Brandes betweenness centrality directly in TypeScript and
  normalized final raw heuristic scores onto a 0-100 UI scale.
- Computed geographic concentration from peer groups by type and subtype because
  exact capacity share is not available in public sources at this granularity.
- Used type-level lead-time assumptions documented in `docs/methodology.md`
  instead of adding non-brief fields to the node CSV.

## Sourcing

- Preferred official annual-report, SEC, investor-relations, and company pages.
- Used source IDs on every node and edge. Some edges are broad public-dependency
  assertions where exact supplier volumes are not disclosed; this limitation is
  documented in `docs/known-limitations.md`.

## Deployment

- Did not create a GitHub remote, push, or deploy to Vercel. This intentionally
  follows the Worker 3 instruction that the parent agent handles remote creation
  and push.
