# Methodology

This app is a decision-support heuristic. It is designed to expose dependency
shape and chokepoint intuition, not to estimate revenue, wafer starts, customer
allocation, or exact outage impact.

## Score Formula

For each node, the raw chokepoint score is:

```text
centrality * geographic_concentration * substitutability * lead_time * scenario_multiplier
```

The raw scores are normalized to a 0-100 display scale after each scenario
change so the UI remains readable.

## Variables

`centrality` uses Brandes betweenness centrality on the curated graph. The graph
is treated as undirected for centrality because dependency risk can propagate in
both directions: a supplier outage affects customers, and a demand shock affects
suppliers.

`geographic_concentration` is `1 + top_country_share` within the node's peer
group. The peer group is subtype-specific where possible and falls back to type
when the subtype would be too sparse.

`substitutability` is:

```text
1 / (1 + log(1 + alternatives))
```

Alternatives are counted from companies with the same type and subtype. More
public alternatives lower the score.

`lead_time` is `1 + lead_time_months / 12`. Lead times are type-level estimates:
foundries and EUV lithography score high, packaging substrates and OSATs sit in
the middle, and downstream buyers score lower. These are coarse assumptions,
not sourced construction schedules.

`scenario_multiplier` is the product of all active scenario impacts. Each
scenario has a narrow multiplier list in `src/lib/scenarios.ts`.

## Why These Factors

Betweenness centrality captures graph brokerage. ASML, TSMC, Arm, HBM suppliers,
ABF substrate suppliers, and advanced packaging firms often sit between many
upstream and downstream nodes.

Geography matters because the semiconductor value chain is regionally clustered.
The SIA/BCG supply-chain report describes a deeply specialized and geographically
distributed value chain with concentration risks across manufacturing stages.

Substitutability matters because a second or third qualified source can absorb
some disruption. This app counts public alternatives but does not model whether
they are actually qualified for a given product.

Lead time matters because a spare supplier is less useful if replacement capacity
takes quarters or years to qualify.

## Source Handling

The CSV files use `source_id` values that resolve in `src/data/sources.md`.
Sources are mostly official annual reports, SEC filings, investor pages, company
technology pages, plus industry reports from SIA/BCG and SEMI.

Some edge claims are broad dependency heuristics. Public companies often disclose
supplier, customer, and manufacturing risk at the ecosystem level rather than
volumes by counterparty.
