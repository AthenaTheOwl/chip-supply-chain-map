# Scenario Design

The scenarios are intentionally simple. They change chokepoint scores and, for
export controls, visually suppress affected equipment edges. They do not simulate
capacity, inventory, pricing, or demand elasticity.

## Taiwan Capacity Shock

Trigger: a geopolitical or natural-disaster event cuts Taiwan foundry output.

Modeled: higher stress on TSMC, UMC, Vanguard, and PSMC.

Not modeled: inventory buffers, cross-strait escalation paths, insurance,
customer prioritization, or fab-level recovery timing.

Multiplier: 2.3 for Taiwan foundry nodes. TSMC receives this through the same
scenario path as other Taiwan foundries because it is already amplified by
centrality, lead time, and advanced-node edge density.

## Advanced Packaging Bottleneck

Trigger: CoWoS and high-end OSAT capacity becomes tighter for AI accelerators.

Modeled: higher stress on TSMC, ASE, Amkor, Ibiden, Unimicron, and Shinko.

Not modeled: exact CoWoS capacity, package mix, substrate allocation, or customer
priority.

Multiplier: 1.8 for the directly exposed packaging and substrate nodes.

## ABF Substrate Shortage

Trigger: ABF substrate supply cannot keep pace with advanced CPU, GPU, AI, and
networking packages.

Modeled: higher stress on Ibiden, Unimicron, Shinko, and Ajinomoto.

Not modeled: layer count, package size, substrate yield, inventory, or price.

Multiplier: 2.2 because ABF shortages from 2020-2022 showed that a substrate
constraint can bottleneck high-value semiconductors even when wafer supply exists.

## EUV Equipment Delay

Trigger: EUV and advanced DUV equipment deliveries slip for two quarters.

Modeled: higher stress on ASML, Nikon, Canon, and Lasertec.

Not modeled: used-tool markets, field upgrades, fab installation sequencing, or
node-specific lithography recipes.

Multiplier: 1.9 because lithography delays affect expansion timing across both
logic and memory.

## Tightened Export Controls

Trigger: US allied equipment access narrows for China-based advanced nodes.

Modeled: higher stress on SMIC, YMTC, and Hua Hong. Equipment edges from US,
Japan, and Netherlands suppliers into those China nodes are rendered as suppressed
when the scenario is active.

Not modeled: license exceptions, domestic substitution, gray-market behavior, or
node-by-node technical capability.

Multiplier: 1.5 for affected China-based manufacturing nodes.

## AI Accelerator Demand 3x

Trigger: hyperscaler accelerator demand rises faster than HBM, advanced
packaging, and advanced-node capacity.

Modeled: higher stress on NVIDIA, AMD, Broadcom, Marvell, TSMC, SK Hynix,
Micron, and Samsung Memory.

Not modeled: cloud capex budgets, rack power, networking backlogs, or accelerator
generation transitions.

Multiplier: 1.6 for directly exposed AI compute, HBM, and foundry nodes.

## Historical Analogs

- Renesas Naka factory fire: a single automotive semiconductor plant disruption
  worsened an already tight auto-chip market.
- COVID auto-chip crisis: demand whiplash and long qualification cycles made
  mature-node automotive chips difficult to replace quickly.
- ABF substrate shortage from 2020-2022: package substrates became a gating item
  for advanced CPUs, GPUs, and networking silicon.
- SIA/BCG supply-chain work: the industry is globally specialized and efficient
  but contains concentrated stages that can become chokepoints.
