# .agents/CATALOG.md

Index of every role, tool, policy, state machine, and workflow
registered under `.agents/`. The `validate_*.py` scripts in
`scripts/` walk these files and validate each against the cross-repo
schema set from athena-site.

## Roles (6)

| ID | Guild | Mission |
|---|---|---|
| `control.coordinator` | control | Route a change through the workflow without overstepping into any step. |
| `product.spec-writer` | product | Write the six-file spec ledger and one DEC per R-* before any code lands. |
| `engineering.implementation` | engineering | Land the narrowest traceable code slice; never touch CSV data without a paired source citation. |
| `engineering.code-reviewer` | engineering | Read the diff against the spec and the DEC; never edit code. |
| `science.proof-gate-runner` | science | Own the six python governance gates and the build gate; refuse merges that regress any axis. |
| `learning.dream-orchestrator` | learning | Run the weekly offline-cognition pass; emit human-gated promotion candidates. |

Each role folder under `.agents/roles/<id>/` carries:

- `role.yaml` - schema-validated contract.
- `instructions.md` - narrative guidance.
- `tools.yaml` - allowed-tool subset (cross-checks role.yaml).
- `output.schema.json` - shape of the role's output artifact.
- `gates.yaml` - gates the role's run must pass.

## Deferred roles (38)

The full 44-role catalog from athena-site stays partly deferred. Six
roles ship today; the remaining 38 land as future product surfaces
earn them. The two most likely next graduations are
`learning.skill-curator` (lands when the first reusable skill
package graduates from observed practice) and `data.curator` (lands
when the CSV refresh cadence outgrows the manual single-commit
pattern).

## Tools (10)

Registered in `.agents/tools.yaml`. Categories:

- **repo**: `repo.read`, `repo.apply_patch`, `dream.read_recent_commits`
- **shell**: `npm.build`, `npm.test`, `gates.run_voice_lint`,
  `gates.run_spec_check`, `gates.run_validate_decisions`,
  `gates.run_validate_roles`, `gates.run_validate_tools`,
  `gates.run_validate_policies`
- **skill**: `dream.write_candidate`

The high-risk write tool `repo.apply_patch` carries the forbidden
path list (`.env`, `secrets/**`, `src/data/raw/**`).

## Policies (6)

Registered in `.agents/policies/`. Sorted by priority (higher wins):

| ID | Priority | Decision |
|---|---|---|
| `data-csv-changes-require-source-citation` | 100 | require_approval |
| `coordinator-routing-only` | 100 | deny |
| `reviewer-cannot-edit-code` | 100 | deny |
| `dream-candidates-require-human-approval` | 90 | require_approval |
| `implementation-can-edit-code` | 80 | allow |
| `default-deny` | 0 | deny |

The default-deny baseline sits at priority 0; every other policy is
an explicit grant or require_approval at higher priority.

## State machines (3)

Registered in `.agents/state-machines/`:

- `spec-lifecycle.yaml` - drafted -> approved -> in_implementation -> complete -> superseded.
- `run-lifecycle.yaml` - queued -> in_progress -> awaiting_gate -> awaiting_approval -> completed (or failed / escalated).
- `release-lifecycle.yaml` - candidate -> shipped -> rolled_back.

## Workflows (4)

Registered in `.agents/workflows/`:

- `single-change.yaml` - intake -> spec -> architecture -> implementation -> code_review -> tests -> proof_gates -> human_approval -> release.
- `weekly-dream.yaml` - pull_history -> run_modes -> write_report -> write_output_json -> human_review.
- `incident-response.yaml` - contain -> diagnose -> decide -> record_reset (conditional) -> postmortem.
- `data-update.yaml` - validate_csv_shape -> check_source_citation -> run_scoring -> diff_chokepoint_scores -> human_approval -> release. Repo-specific; fires when `src/data/nodes.csv` or `src/data/edges.csv` changes.

## Gates

| Script | What it checks |
|---|---|
| `scripts/voice_lint.py` | Voice rules over governance copy (specs, decisions, dreams, agents, ops). |
| `scripts/spec_check.py` | Six-file spec ledger, R-* prefix set, traceability, DEC coverage. |
| `scripts/validate_decisions.py` | DEC files parse against the cross-repo decision schema. |
| `scripts/validate_roles.py` | Role YAML parses against the cross-repo role schema. |
| `scripts/validate_tools.py` | Tool registry parses against the cross-repo tool schema. |
| `scripts/validate_policies.py` | Policy YAML parses against the cross-repo policy schema. |

The existing `build.yml` (Vite build) and `stale-data.yml` (180-day
data freshness cron) workflows continue to run alongside the new
gates job.

## Deferred work

- The full 44-role operating-model catalog stays partly deferred.
  Six roles ship today; the remaining 38 land as future surfaces
  earn them.
- A `validate_dreams.py` gate lands when the first
  `dreams/YYYY-WNN/output.json` file lands.
- A `validate_skills.py` gate lands when the first skill graduates.
- A `check_data_freshness.py` gate that asserts CSV mtime <= 180
  days at PR time (today the cron-driven `stale-data.yml` opens an
  issue but does not fail the build).
