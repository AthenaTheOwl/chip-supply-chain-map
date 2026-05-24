# acceptance: cognitive-delivery-control-plane

## Gates

- `python scripts/voice_lint.py` exits 0 across the governance copy
  (specs, decisions, dreams, agents, ops markdown).
- `python scripts/spec_check.py` exits 0 with one active spec
  (`0001-cognitive-delivery-control-plane`).
- `python scripts/validate_decisions.py` exits 0 with six DEC files
  validated (`DEC-CDCP-001` plus five `DEC-MAP-*` architectural
  DECs).
- `python scripts/validate_roles.py` exits 0 with six role files
  validated.
- `python scripts/validate_tools.py` exits 0 with the tool registry
  validated.
- `python scripts/validate_policies.py` exits 0 with six policy files
  validated.
- The existing `build.yml` (Vite build with `tsc -b && vite build`)
  and `stale-data.yml` (180-day CSV freshness alert) workflows remain
  green; this spec does not touch the code paths those gates cover.

## Done means

Spec 0001 is done when:

1. The CDCP scaffold (`specs/0001-*/`, `decisions/`, `dreams/`,
   `.agents/`, `ops/`) lands as files under
   `e:\claude_code\random-apps\chip-supply-chain-map`.
2. `scripts/validate_decisions.py` walks the six DEC files and exits
   0.
3. `scripts/spec_check.py` walks every R-* and confirms every one is
   covered by a DEC, allowlisted, or covered by the bootstrap
   exemption for R-CDCP-*.
4. `scripts/validate_roles.py`, `validate_tools.py`, and
   `validate_policies.py` walk the operating-model files and exit 0.
5. The new CI gates workflow runs the six python gates.
6. The root README points readers at the governance artifacts and
   carries the For-your-role section.

## Explicit non-acceptance

- No edits to `src/`, `index.html`, `vite.config.ts`, or
  `tailwind.config.cjs`. The deployed app stays untouched.
- No backfill DECs for graph rendering details, scoring weights,
  scenario-by-scenario design notes, or UI panel design beyond the
  five architectural DECs in this pass - those land when each surface
  earns its own spec (`0002-graph-render`, `0003-scoring-tune`, etc.)
  and the DECs land alongside.
- No first dream output; the README documents the format and the
  gate for that artifact lands when the first weekly dream lands.
- No new top-level npm dependencies. `jsonschema` and `pyyaml` are
  loaded lazily by the gate scripts; the scripts print a clear
  install hint and exit 1 if either is missing. The gates run via
  python, not via the node toolchain.
- The 44-role full operating-model catalog from athena-site is
  deferred. This spec installs the six core roles needed for
  single-change flow; the rest land as the repo grows.
