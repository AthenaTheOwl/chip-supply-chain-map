# requirements: earnings sensitivity overlay

## Scope

Spec 0002 adds a static financial sensitivity layer to the chip map.
It records public-company revenue, capex, backlog, and exposure
claims that explain why selected chokepoints matter to investors.

## Requirements

### R-FIN-001: static sourced financial sensitivity records

WHEN a user selects a covered node, THE SYSTEM SHALL show financial
sensitivity records from `src/data/financial_sensitivity.csv` without
market feeds or paid APIs.

Acceptance:
- The CSV columns are `company`, `ticker`, `node_id`, `scenario_id`,
  `metric_name`, `metric_value`, `period`, `source_id`,
  `sensitivity_band`, and `note`.
- Each row carries a `source_id` listed in `src/data/sources.md`.
- The selected-node panel lists matching rows with metric, period,
  scenario label, sensitivity band, note, and source link.
- Active scenario matches are marked in the panel.
- The 180-day freshness script checks the financial CSV.

### R-FIN-002: investor watchlist risk packet export

WHEN a user builds a small watchlist from graph nodes, THE SYSTEM
SHALL show an aggregate exposure summary and export a deterministic
risk packet assembled from existing graph and financial sensitivity
facts.

Acceptance:
- The user can add and remove graph nodes without auth, persistence,
  backend storage, or paid data feeds.
- The watchlist summary shows watched-node count, average and maximum
  chokepoint score when scores are present, top dependencies, top
  regions, and sensitive graph links.
- The export can be copied or downloaded as JSON or markdown.
- The export includes source IDs and source labels or URLs for graph
  nodes, edges, and financial sensitivity rows when those references
  are available.
- The export is derived from data fields already loaded in the app and
  does not write analyst recommendations.

### R-FIN-003: watchlist export CLI emits a conformant Event ledger

WHEN the watchlist export CLI runs the deterministic packet pipeline,
THE SYSTEM SHALL append an event-ledger file at
`ops/event-ledger/<run-id>.jsonl` whose lines validate against the
cached `ops/schemas-cache/event.schema.json`.

Acceptance:
- Each pipeline execution writes at least one `pipeline.start`, one
  `tool.call.completed`, one `gate.check.passed` or
  `gate.check.failed`, one `gate.run.evidence_recorded`, and one
  `pipeline.done` event.
- Every line in the JSONL file parses as JSON and conforms to the
  cached event schema.
- The `run_id` field on each event matches the file name.

### R-FIN-004: watchlist export CLI emits a conformant Run record

WHEN the watchlist export CLI finishes a pipeline execution, THE
SYSTEM SHALL write `ops/run-records/<run-id>.json` whose body
validates against the cached `ops/schemas-cache/run.schema.json`.

Acceptance:
- Required fields populated: `id`, `spec_id` =
  `specs/0002-earnings-sensitivity-overlay/`, `agent_id` =
  `chip-supply-chain-map-export`, `runtime` =
  `chip-supply-chain-map-export`, `workspace_id` = the repo path,
  `started_at`, `finished_at`, `status` (`done` or `failed`),
  `inputs` (one `dataset` entry per source CSV or markdown file).
- The validator gate `scripts/validate_run_evidence.py` exits zero
  against the produced file.

### R-FIN-005: prompt and tool-schema hashes are always populated

WHEN the watchlist export CLI emits a Run record, THE SYSTEM SHALL
populate the `prompt_snapshot_hash` and `tool_schemas_snapshot_hash`
fields with SHA-256 digests of canonicalized inputs.

Acceptance:
- `prompt_snapshot_hash` covers the scoring heuristic config: the
  heuristic version label, the `strengthWeight` mapping, the packet
  version, and the runtime label. The "prompt" analog in a no-LLM
  pipeline is the policy that turns inputs into outputs.
- `tool_schemas_snapshot_hash` covers the canonicalized contents of
  `src/data/nodes.csv`, `src/data/edges.csv`, `src/data/sources.md`,
  and `src/data/financial_sensitivity.csv`. The input data IS the
  tool surface in a deterministic data pipeline.
- Both digests match the schema pattern `^[a-f0-9]{64}$`.

### R-FIN-006: sandbox_image_ref pins the producing commit

WHEN the watchlist export CLI emits a Run record, THE SYSTEM SHALL
populate `sandbox_image_ref` with `<repo-path>@<HEAD-SHA>` so a
reviewer can pin the replay context to the producing commit.

Acceptance:
- The field is populated whenever the CLI can resolve
  `git rev-parse HEAD` against the repo working tree.
- The field is omitted (not populated with placeholder text) when
  `git rev-parse` fails.

### R-FIN-007: gate_results_summary aggregates fired gate events

WHEN the watchlist export CLI emits a Run record, THE SYSTEM SHALL
populate `gate_results_summary` from the `gate.check.passed` and
`gate.check.failed` events fired during the pipeline execution.

Acceptance:
- Names in `gates_passed` and `gates_failed` come from the
  `payload.gate_name` field of each event.
- `all_passed` is true iff `gates_failed` is empty.
- The two shipped gate names are `input_validation` (every edge
  endpoint resolves to a known node, all four input files parse
  non-empty) and `packet_shape` (the packet version is 1, the
  required arrays are present, the summary count matches the
  watchlist length).

### R-FIN-008: validate_run_evidence gates commits

WHEN a commit lands on the main branch, THE SYSTEM SHALL run
`scripts/validate_run_evidence.py` as a CI gate and SHALL block the
merge if any ledger line or Run record fails to validate.

Acceptance:
- The validator runs in `.github/workflows/gates.yml` alongside
  `spec_check.py`, `validate_decisions.py`, and the others.
- A schema-violating record produces exit code 1 with the violation
  list on stderr.
- The validator runs offline against the cached schemas; no network
  call is required.
