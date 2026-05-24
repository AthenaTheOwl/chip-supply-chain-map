# RELEASE_LEDGER

Every commit on main that represents shippable scope lands here with
date, SHA, title, scope, and proof refs. Backfilled entries cover
the four pre-CDCP commits.

## Format

Each entry has the shape:

```
## YYYY-MM-DD - <sha> <title>

- scope: <one or two sentences>
- proof:
  - <gate or build name> - <where the proof lives>
```

## Entries

## 2026-04-29 - 611e497 Build chip supply chain map

- scope: full repo skeleton - React 18 plus Vite 5 plus
  TypeScript 5 strict app under `src/`, Cytoscape.js graph in
  `src/components/SupplyChainGraph.tsx`, chokepoint heuristic in
  `src/lib/scoring.ts`, scenario reducer in `src/lib/scenarios.ts`,
  CSV loader in `src/lib/graph.ts`, the 78-node / 180-edge curated
  dataset under `src/data/`, methodology and known-limitations docs
  under `docs/`, the legacy `DECISIONS.md` flat file.
- proof:
  - npm run build - tsc -b plus vite build green
  - manual smoke - graph renders, scenario toggles update scores,
    detail panel opens on tap

## 2026-04-30 - 42e5779 voice-pass README: lowercase headers, tighten what-it-does, drop internal-artifact line

- scope: README editorial pass - lowercase section headers,
  tightened "what it does" paragraph, dropped the internal-artifact
  line that referenced a non-public document.
- proof:
  - manual read - README renders cleanly on GitHub
  - voice pass - no banned phrases in the rewritten copy

## 2026-05-02 - 2b125fc ci: dependabot, build check, stale-data guard

- scope: `.github/workflows/build.yml` (npm ci plus npm run build
  on push and PR), `.github/workflows/stale-data.yml` (weekly cron
  that opens a GitHub issue if `src/data/nodes.csv` mtime exceeds
  180 days), `.github/dependabot.yml` (weekly updates for npm and
  github-actions ecosystems).
- proof:
  - first build.yml run - green on push to main
  - dependabot - first scheduled run produces PRs against
    package.json and .github/workflows/
  - stale-data dry-run - cron schedule registered; no issue opened
    yet (data within threshold)

## 2026-05-02 - 1a8b796 document deployed chip map URL

- scope: README points at `https://chip-supply-chain-map.vercel.app/`
  as the live demo. The Vercel project picks up main on its own
  cadence; the README documents the URL.
- proof:
  - manual smoke - Vercel renders the deployed graph
  - README - demo URL block reads clean

## 2026-05-24 - <pending> spec 0001: install full CDCP (base + operating model) + 5 architectural DECs

- scope: installs the CDCP governance scaffold - `specs/0001-*/`
  ledger, `decisions/` directory with `DEC-CDCP-001` plus the five
  architectural DECs (`DEC-MAP-001` cytoscape, `DEC-MAP-002` fcose,
  `DEC-MAP-003` chokepoint heuristic, `DEC-MAP-004` scenario
  toggles, `DEC-MAP-005` data-freshness gate), `dreams/README.md`,
  `.agents/AGENTS.md` plus six role contracts, tool registry, six
  policy files, three state machines, four workflow declarations,
  `ops/RELEASE_LEDGER.md` (this file), `ops/RESET_LEDGER.md`,
  `ops/event-log/`, schema cache, and six python gate scripts.
  README polished with a "For your role" section and a Governance
  section. The deployed Vercel app is untouched.
- proof:
  - spec_check - one active spec, ten R-CDCP-* requirements,
    bootstrap exemption applied
  - voice_lint - governance copy reads clean
  - validate_decisions - six DECs validated
  - validate_roles - six roles validated
  - validate_tools - tool registry validated
  - validate_policies - six policies validated
  - build - npm run build green; deployed app untouched
