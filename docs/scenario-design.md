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

Modeled: higher stress on TSMC, ASE, Amkor, Ibiden, Unimicron, Shinko,
NVIDIA Blackwell GB200, and AMD Instinct MI family platform rows.

Not modeled: exact CoWoS capacity, package mix, substrate allocation, or customer
priority.

Multiplier: 1.8 for the directly exposed packaging, substrate, and accelerator
platform nodes.

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

## Blackwell And MI Supply Drought

Trigger: cloud demand exceeds available GB200 and AMD Instinct MI accelerator
supply for a full allocation cycle.

Modeled: higher stress on NVIDIA, AMD, the Blackwell GB200 and Instinct MI
platform rows, TSMC, HBM suppliers, and the cloud operators most directly
represented in the graph.

Not modeled: exact allocation by customer, resale markets, cloud reservation
terms, OEM server readiness, or rack power availability.

Multiplier: 1.7 for directly exposed accelerator suppliers, HBM suppliers,
foundry capacity, and cloud buyers.

## Taiwan AI Cluster Stress

Trigger: Taiwan foundry, OSAT, memory-package, and substrate flows are
interrupted at the same time.

Modeled: higher stress on TSMC, Taiwan mature-node foundries, ASE, Powertech,
Unimicron, and the two largest current AI accelerator platform rows.

Not modeled: inventory buffers, recovery sequencing by fab or package line,
customer priority, or non-Taiwan substitution timing.

Multiplier: 1.9 because this combines wafer and backend concentration for AI
clusters without assuming a total Taiwan capacity outage.

## HBM And CoWoS Crunch

Trigger: HBM3E and CoWoS capacity lag the Blackwell and Instinct MI platform
ramps used for training and inference clusters.

Modeled: higher stress on TSMC, SK Hynix, Micron, Samsung Memory, ASE, Amkor,
Ibiden, Unimicron, Shinko, NVIDIA Blackwell GB200, and AMD Instinct MI.

Not modeled: HBM stack height, substrate layer count, known-good-stack yield,
exact CoWoS line capacity, pricing, or customer allocation.

Multiplier: 2.0 because HBM and advanced packaging are both required for
current high-end accelerator platforms.

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

Modeled: higher stress on NVIDIA, AMD, NVIDIA Blackwell GB200, AMD Instinct MI,
Cerebras WSE CS, SambaNova SN40L, Etched Sohu, Broadcom, Marvell, TSMC, HBM
suppliers, Oracle Cloud Infrastructure, and CoreWeave.

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
