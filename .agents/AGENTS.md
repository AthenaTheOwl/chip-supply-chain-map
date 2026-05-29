# .agents/AGENTS.md

The single contract a coding agent (Claude, Codex, or other) reads
before acting on this repo. Specs name what we build. Decisions name
why. This file names how the agent behaves while building.

## Systems-thinking discipline (per DEC-CDCP-020)

Per DEC-CDCP-020 in athena-site, every substantive DEC + dream candidate
+ Run record in this repo SHOULD carry four fields:

- `systems_map`: what underlying mechanism does this expose?
- `transferable_principle`: what generalizes beyond this decision?
- `falsification_test`: what would prove this wrong?
- `adoption_ladder`: `minimum_viable` -> `mid_adoption` -> `full_adoption`
  plus `monitoring_signals`

All four fields are optional in the schema. `validate_decisions.py`
emits a warning to stderr when a new DEC with `status: approved` is
missing any of the four; the warning does not fail the build. After
30 days, the warning ratchets to failure via amendment DEC. A pure-
design DEC documents why a field does not apply (e.g. "falsification
test not applicable; pure-design choice") instead of fabricating
content.

## Coding style

- React 18 plus Vite 5 plus TypeScript 5 strict. The build runs
  `tsc -b && vite build`; both passes must stay green.
- Tailwind 3 for styling. Class names live in JSX; no separate CSS
  file unless an extension hook needs it.
- Cytoscape.js with cytoscape-fcose and cytoscape-popper is the
  graph layer; the choice is recorded in DEC-MAP-001 and DEC-MAP-002.
  Do not swap the library without a new DEC.
- Zustand for app state. The store lives at `src/state/store.ts`
  and tracks `activeScenarioIds`, `selectedNodeId`, and the
  setters.
- Edit existing files. Use the `Edit` tool over `Write` when the
  file already exists; `Write` rewrites the whole file and risks
  losing context. Reserve `Write` for new files.
- The deployed Vercel preview at
  `https://chip-supply-chain-map.vercel.app/` runs the same code as
  main on its own cadence. Do not commit secrets; the app has no
  server-side keys.
- The chokepoint score in `src/lib/scoring.ts` is a heuristic. The
  four-factor product (centrality, geographic concentration,
  substitutability, lead time) is documented in DEC-MAP-003 and
  `docs/methodology.md`. Any change to the formula needs a new DEC.

## Domain decisions

- Code ships under MIT. Data and docs ship under CC BY 4.0.
- The graph holds 78 nodes and 180 edges as of the 2024-2026
  snapshot. The CSV contract lives at `src/data/nodes.csv` and
  `src/data/edges.csv`; the source attestation lives at
  `src/data/sources.md` with `s\d+` IDs that the row-level
  `source_id` fields reference.
- The 180-day data freshness gate (DEC-MAP-005) opens a GitHub
  issue when either CSV's last commit is older than the threshold.
  The check is alert, not block.
- Scenarios are binary on/off toggles, not sliders. The choice is
  recorded in DEC-MAP-004; the impact lambdas live in
  `src/lib/scenarios.ts`. The export-controls scenario also
  visually suppresses equipment-to-China edges via the
  `suppressed` edge class.
- The legacy `DECISIONS.md` flat file remains as a documentation
  surface for the data-model and sourcing notes; the architectural
  decisions migrated to the DEC-* shape in this install.
- Voice rules in `scripts/voice_lint.py` are not optional for
  governance copy under the documented globs. Banlist is hard-FAIL.

## Workflow conventions

- Push to main directly. The repo's CI runs the gates on push; a
  failed gate fails the check.
- Six python gates run on every push:
  `spec_check`, `voice_lint`, `validate_decisions`,
  `validate_roles`, `validate_tools`, `validate_policies`. Plus the
  existing `build.yml` (`npm ci && npm run build`) and
  `stale-data.yml` (weekly 180-day CSV freshness alert).
- Every shipped R-* requirement gets at least one DEC-* file
  before the commit reaches main. `spec_check` flags an orphan
  R-* and fails unless the requirement is listed in
  `decisions/.spec-check-allowlist.yaml` as deferred backfill, or
  carries the `R-CDCP-*` prefix (covered by `DEC-CDCP-001`).
- Dream-job outputs are human-gated. A dream candidate (memory
  update, generated test, skill patch, backlog item) carries
  `human_review_required: true` per the cross-repo schema default.
  No CI job auto-applies a dream candidate. The policy
  `.agents/policies/dream-candidates-require-human-approval.yaml`
  encodes the rule.
- Data-CSV changes hit a hard gate. Edits to
  `src/data/nodes.csv` or `src/data/edges.csv` route through the
  `data-update.yaml` workflow and require a paired source-citation
  update in `src/data/sources.md` before the change lands. The
  policy
  `.agents/policies/data-csv-changes-require-source-citation.yaml`
  encodes the rule.
- A force-push, history rewrite, or rollback gets an entry in
  `ops/RESET_LEDGER.md` in the same push that performs the rewrite.
- A release gets an entry in `ops/RELEASE_LEDGER.md` with date,
  SHA, title, scope, and proof refs.

## Cross-repo links

- The CDCP charter at `../athena-site/ops/control-plane.md` names
  the six artifact types and the cross-repo contracts.
- The schemas at `../athena-site/ops/schemas/` are the source of
  truth for decision, role, tool, policy, skill, dream-output, and
  artifact shapes. This repo references them by URL and keeps cache
  copies under `ops/schemas-cache/` for offline CI.
- The portfolio manifest at
  `../athena-site/ops/portfolio-manifest.yml` lists every product
  repo and which gates each repo runs, including the 180-day data-
  freshness threshold this repo holds for `src/data/`.

## Where to look

| If you want to | Read |
|---|---|
| understand the what | `specs/NNNN-*/requirements.md` |
| understand the why | `decisions/DEC-*.md` |
| understand what we learned last week | `dreams/YYYY-WNN/report.md` |
| read the chokepoint heuristic | `src/lib/scoring.ts` + `docs/methodology.md` |
| read the scenario impact list | `src/lib/scenarios.ts` + `docs/scenario-design.md` |
| audit a release | `ops/RELEASE_LEDGER.md` |
| audit a history rewrite | `ops/RESET_LEDGER.md` |
| add a new spec | `specs/README.md` plus the six-file pattern |
| add a new decision | `decisions/README.md` |
| register a new role or tool or policy | `.agents/CATALOG.md` |

## Failure modes the agent watches for

- A new R-* requirement without a DEC: `spec_check` fails. Fix by
  adding the DEC file in the same commit, or add the ID to the
  allowlist with a tracking note.
- A DEC file out of schema shape: `validate_decisions` fails. Fix
  the front-matter against `ops/schemas-cache/decision.schema.json`.
- A role, tool, or policy out of shape: the matching `validate_*`
  script fails. Fix against the cached schema.
- A voice-lint hit in governance copy: rewrite the line. Per-line
  allowlist via `voice_lint:allow <label>` ships only when the
  rule does not apply and the agent leaves a note.
- A CSV edit without a paired source-citation update: the
  `data-csv-changes-require-source-citation` policy fires and the
  change is held for human approval.
- A scenario added without a multiplier rationale: the change is
  blocked. New scenarios document their multiplier choice in
  `docs/scenario-design.md` with a historical analog (the existing
  six scenarios do this).

## Lessons promoted from weekly dreams

This section holds memory entries promoted from the
`learning.dream-orchestrator` weekly retrospective. Each entry names
the lesson, the do/don't shape, and the candidate file the lesson
was promoted from. No entries yet; the first dream lands when the
weekly job ships.
