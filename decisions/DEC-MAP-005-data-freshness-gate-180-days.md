---
id: DEC-MAP-005-data-freshness-gate-180-days
spec: specs/0001-cognitive-delivery-control-plane/
requirement: R-MAP-005
date: 2026-05-24
status: approved
reversible: true
decision: |
  Hold `src/data/nodes.csv` and `src/data/edges.csv` to a 180-day
  freshness gate. The check is wired into
  `.github/workflows/stale-data.yml` as a weekly cron that opens a
  GitHub issue if `git log -1` on either CSV reports an mtime older
  than 180 days. The athena-site portfolio-manifest references the
  same threshold so the cross-repo audit picks up the rule.
alternatives:
  - label: 90 days
    rejected_because: |
      90 days is the cadence for fast-moving operational data (lead
      times, prices, news, earnings). Supply-chain structure
      (companies, regions, dependency edges, type categories) moves
      slower than that. Forcing a refresh every quarter would either
      reopen the same issues with no real change or push the
      curation onto rumor-grade data.
  - label: no gate (manual refresh when the team feels like it)
    rejected_because: |
      The legacy state. The repo has no enforced cadence, no audit
      trail of staleness, and no incentive to refresh. The
      attestation chain (CSV row -> source_id -> sources.md entry)
      decays silently. The portfolio audit cannot tell which
      datasets are current.
  - label: real-time pull from a vendor feed
    rejected_because: |
      No vendor publishes the curated supply-chain shape this app
      uses. SEMI, SIA, BCG, and IDC publish reports; SEC filings
      cover financials but not supplier-customer edges. A real-time
      feed would mean either parsing announcements (fragile) or
      paying a vendor for a static dataset.
  - label: 365 days
    rejected_because: |
      Too lax. A full year between refreshes lets the curation
      drift past two earnings cycles and likely one major industry
      announcement (a new fab, a new export-control rule, a new
      acquisition). 180 days catches the half-yearly cadence of
      industry-report updates without forcing quarterly churn.
rationale: |
  Supply-chain structure changes slowly. The 78 companies in
  `src/data/nodes.csv` and the 180 edges in `src/data/edges.csv`
  reflect a 2024-2026 public-information snapshot of foundries,
  fabless designers, EDA/IP, lithography, deposition/etch/metrology,
  materials, substrates, memory, advanced packaging, and downstream
  demand. The companies and the broad dependencies do not turn over
  every quarter.

  Two semiconductor-industry refresh cadences anchor the 180-day
  threshold. SIA and BCG publish supply-chain work on roughly a
  six-month cadence; SEMI publishes its World Fab Forecast updates
  twice a year; the industry-wide capacity figures the curation
  references settle into stable numbers over 90-180 day windows. A
  refresh that catches each of those cycles is enough to keep the
  graph from drifting; a refresh that fires faster than the cycle
  catches noise.

  The gate is alert, not block. The cron opens a GitHub issue
  labeled `stale-data,maintenance` once the threshold trips; the
  build still passes. The intent is to keep the team honest, not
  to block deploys when the data is one day past 180.

  The cross-repo athena-site portfolio-manifest references the same
  180-day threshold so the portfolio audit picks up this repo's
  data-freshness status alongside other product repos' freshness
  contracts. The data-csv-changes-require-source-citation policy
  pairs with this gate: every CSV refresh must update
  `src/data/sources.md` in the same commit, keeping the attestation
  chain intact through the refresh.
evidence:
  - kind: doc
    ref: .github/workflows/stale-data.yml (the cron and the THRESHOLD_DAYS=180 env)
  - kind: doc
    ref: src/data/nodes.csv (78 nodes, 2024-2026 snapshot)
  - kind: doc
    ref: src/data/edges.csv (180 edges)
  - kind: doc
    ref: src/data/sources.md (the source attestation file the data-update policy pairs with)
  - kind: doc
    ref: docs/known-limitations.md (the "Static Snapshot" section)
  - kind: doc
    ref: .agents/policies/data-csv-changes-require-source-citation.yaml (the paired policy)
rollback: |
  Edit `THRESHOLD_DAYS` in `.github/workflows/stale-data.yml` to a
  different value (90, 365, or 0 to disable). The change is local
  to one file. To remove the gate entirely, delete the workflow
  and remove the data-CSV entry from the athena-site portfolio-
  manifest. The `data-csv-changes-require-source-citation` policy
  stays in place either way; it enforces the attestation rule
  independent of the freshness threshold.
owner: platform
---

## decision

Hold `src/data/nodes.csv` and `src/data/edges.csv` to a 180-day
freshness threshold. The check is the weekly cron in
`.github/workflows/stale-data.yml`; the action is opening a
GitHub issue, not failing the build.

## alternatives

- 90 days - too aggressive for slow-moving supply-chain structure.
- No gate - the legacy state; lets the attestation chain decay
  silently.
- Real-time vendor feed - no vendor publishes the curated shape this
  app uses.
- 365 days - too lax; misses two earnings cycles and likely a major
  industry announcement.

## rationale

Supply-chain structure changes slowly. The 78 nodes and 180 edges
in the CSV files reflect a 2024-2026 snapshot of companies and
broad dependencies. SIA, BCG, and SEMI publish updates on roughly
a six-month cadence; the 180-day threshold matches that cycle.

The gate is alert, not block. The cron opens an issue when
threshold trips; the build still passes. The intent is to keep the
team honest, not to fail deploys when the data is one day past
the threshold.

The cross-repo athena-site portfolio-manifest references the same
threshold. The `data-csv-changes-require-source-citation` policy
pairs with this gate: every CSV refresh updates
`src/data/sources.md` in the same commit.

## evidence

- `.github/workflows/stale-data.yml` - the cron and
  `THRESHOLD_DAYS=180`.
- `src/data/nodes.csv` and `src/data/edges.csv` - the dataset the
  gate guards.
- `src/data/sources.md` - the attestation file paired with the gate
  via the policy.
- `docs/known-limitations.md` - the "Static Snapshot" section.
- `.agents/policies/data-csv-changes-require-source-citation.yaml` -
  the paired policy.

## rollback

Edit `THRESHOLD_DAYS` in the workflow YAML, or delete the workflow
entirely. The change is local to one file. The
`data-csv-changes-require-source-citation` policy stays in place
either way; it enforces the attestation rule independent of the
freshness threshold.
