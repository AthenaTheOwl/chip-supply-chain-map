# Known Limitations

This project is candidly incomplete. It is useful for exploring dependency
shape, not for operational planning.

## No Real Capacity Data

The graph does not include wafer starts, HBM stacks, CoWoS lines, substrate
layer counts, test capacity, or fab-level utilization. Scores are relative.

## No Customer-Mix Data

Many semiconductor companies do not disclose exact supplier or customer mix.
Edges represent public ecosystem dependencies, known strategic relationships,
and common industry flows. They should not be read as complete purchase-order
evidence.

## Static Snapshot

The curation reflects a 2024-2026 public-information snapshot. It will go stale
as new fabs, packaging lines, export-control rules, and customer wins change.

## No Demand Or Price Feedback

The scenario model does not include price responses, allocation behavior,
inventory burn-down, substitution timing, or capex pull-forward.

## Simplified Graph Direction

Most edges are supplier-to-consumer. Procurement edges are downstream-buyer to
supplier because the brief defined them that way. The detail panel handles this
semantic difference, but graph centrality treats edges as undirected.

## Heuristic Not Validated

The chokepoint score has not been validated against historical disruptions.
It is a transparent heuristic for discussion, not a statistical model.
