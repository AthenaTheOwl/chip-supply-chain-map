# Scoring history methodology

`src/data/nodes_history.csv` carries quarterly chokepoint snapshots
for every node from 2025-Q3 through 2026-Q2. The History slider in
`src/components/HistorySlider.tsx` reads these rows and recolors the
graph to show how the chokepoint score moved across the four
quarters.

## Honest disclaimer

The historical scores are synthetic. They were modeled by hand from
public industry news, not pulled from a vendor feed or measured
against ground-truth data. This file describes the synthesis
methodology so a reader can decide how much weight to give the
historical view.

The chokepoint score formula itself is unchanged from
`docs/methodology.md` and `DEC-MAP-003-chokepoint-score-heuristic.md`.
Centrality, geographic concentration, substitutability, and lead
time still compose multiplicatively. The historical CSV stores the
final 0-100 chokepoint number plus the four factor inputs for each
node-quarter, so a reader can inspect how each factor would have
contributed at each point in time.

## Score formula reminder

```text
centrality * geographic_concentration * substitutability * lead_time * scenario_multiplier
```

The raw product is normalized onto a 0-100 display scale. The slider
shows the normalized number, the value the layperson sees in the
live snapshot.

## What "synthetic" means here

For each of the 78 nodes in `src/data/nodes.csv`, I authored a row
per quarter (2025-Q3, 2025-Q4, 2026-Q1, 2026-Q2). The 2026-Q2 row is
the "current" snapshot and was anchored to the score the live app
renders from `src/data/nodes.csv`. Earlier quarters were drifted
backwards along plausible directions:

- Nodes named in industry news for stress (TSMC, ASML, ASE, Ibiden,
  SK Hynix, NVIDIA) carry visible quarter-over-quarter movement.
- Nodes outside the news cycle (UMC, Vanguard, Tower Semi, Cisco,
  Tesla) hold close to flat with small drift.
- A handful of nodes show a transient dip or spike anchored to a
  specific dated event (ASML in 2025-Q4 on the Nikon DUV-i
  announcement, Samsung Memory on the HBM3e qualification path).

The numerical movements were chosen for storytelling clarity, not
for econometric realism. A node whose chokepoint score moves
from 60 to 70 in this file should be read as "the public news in
that window pointed toward more pressure," not as "the chokepoint
score was measured at 60 and then measured at 70."

## Public news anchors

The quarterly drifts are anchored to the following public events.
Each row in `nodes_history.csv` carries a `notes` column that points
at the event in shorthand.

1. **TSMC Arizona delay and CoWoS allocation.** Reported across 2025
   and into 2026 as advanced-packaging capacity remained the gating
   resource for AI accelerators.
   https://www.tsmc.com/english/news-events/press-releases
2. **ASML High-NA EUV ramp.** ASML's High-NA EUV systems shipped to
   leading-edge customers across 2025-2026; the Q4 2025 dip in the
   ASML row is anchored to coverage of competing DUV-i alternatives
   (Nikon's roadmap reporting).
   https://www.asml.com/en/news
3. **Samsung Foundry 3nm yield path.** Reported recovery in 3nm
   gate-all-around yields through late 2025 and into 2026.
   https://www.samsungsemiconductor.com/global/news/
4. **AI accelerator demand spike.** NVIDIA's Blackwell ramp, AMD's
   MI300/MI325X cadence, Broadcom's custom XPU programs (Google
   TPU and Meta MTIA).
   https://investor.nvidia.com/financial-info/financial-reports/
   https://ir.amd.com/news-events/press-releases
   https://investors.broadcom.com/news-releases
5. **HBM tightness at SK Hynix, Micron, Samsung Memory.** HBM3e
   qualification at NVIDIA, HBM4 sampling, allocation extending to
   2026.
   https://www.skhynix.com/eng/pr/pressReleaseList.do
   https://investors.micron.com/news-releases
6. **ABF substrate and advanced packaging at Ibiden, Unimicron,
   Shinko, Ajinomoto.** ABF allocation tightened with CoWoS demand
   through 2025-2026; capacity expansion announcements ran 18 months
   out.
   https://www.ibiden.com/news/
   https://www.unimicron.com/en/news
7. **OSAT advanced-packaging at ASE and Amkor.** CoWoS-S volume
   growth at ASE; Arizona OSAT site groundbreaking at Amkor.
   https://www.aseglobal.com/en/News/
   https://ir.amkor.com/news-releases
8. **Lasertec and Hoya, mask-side EUV tooling.** High-NA mask blank
   demand and inspection-tool reorders.
   https://www.lasertec.co.jp/en/news/
   https://www.hoya.com/en/news/
9. **Nikon and Canon, alternative-path lithography.** Nikon's DUV-i
   roadmap and Canon's nanoimprint shipment to Kioxia.
   https://www.nikon.com/company/news/
   https://global.canon/en/news/
10. **SIA and BCG supply-chain reports.** General context for
    half-yearly industry shape; the 2025 release ran through late
    2024 and into 2025, with refreshes through 2026.
    https://www.semiconductors.org/sia-and-bcg-publish-strengthening-the-global-semiconductor-supply-chain-report/
11. **SEMI World Fab Forecast updates.** General context for
    quarter-over-quarter capacity additions.
    https://www.semi.org/en/products-services/market-data
12. **Renesas Naka recovery legacy.** The post-fire recovery flat
    line at Renesas through 2025-2026.
    https://www.renesas.com/en/about/newsroom

## What this view is good for

The History slider is pedagogy. It shows a layperson how
chokepoint risk shifts as public news pushes individual nodes up
or down. It is good for:

- Telling the story of advanced-packaging tightness from 2025
  through 2026.
- Showing the asymmetric pace at which different parts of the
  supply chain move (foundries and HBM climb; analog and auto-MCU
  stay flat).
- Making the chokepoint score feel less static than a single
  snapshot.

## What this view is not good for

- Backtesting any forecast. The historical numbers were authored
  to be plausible, not to be measurement records.
- Computing volatility, correlations, or any statistic that treats
  the history as a sample of measurements.
- Audit. The audit trail is the public news cited above plus the
  authoring judgement; a reader who disagrees with a particular
  drift should treat the row as a hypothesis, not a finding.

## How to refresh

To extend the history surface, follow the data-update workflow at
`.agents/workflows/data-update.yaml` plus the
`data-csv-changes-require-source-citation` policy:

1. Add or update rows in `src/data/nodes_history.csv`.
2. Cite the public source for each drift in the `notes` column.
3. Update this doc if the news anchor changes shape.
4. Run the gates and re-run `scripts/check_data_freshness.py`
   (the freshness threshold from
   `DEC-MAP-005-data-freshness-gate-180-days.md` covers the
   history CSV alongside the current snapshot).

A future pass may extend the slider to monthly granularity once
public reporting cadences support that. Quarterly is the floor
that the news anchors support today.
