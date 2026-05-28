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

### R-FIN-009: tool.call.completed payloads carry tool_name

WHEN the watchlist export CLI emits a `tool.call.completed` event,
THE SYSTEM SHALL populate the payload's `tool_name` field (matching
the typed payload schema added in Round 2) and SHALL NOT populate a
legacy `tool_id` field.

Acceptance:
- The two call sites in `scripts/export_watchlist/main.ts`
  (`computeChokepointScores` and `buildWatchlistRiskPacket`) emit
  `tool_name`.
- The cached `event.schema.json`'s `tool.call.completed` branch
  requires `tool_name`; a payload missing the key fails validation.

### R-FIN-010: gate.run.evidence_recorded payloads carry fields_populated

WHEN the watchlist export CLI emits a `gate.run.evidence_recorded`
event, THE SYSTEM SHALL populate the payload's `fields_populated`
field with the sorted set of replay-equivalence fields populated on
the Run record, and SHALL NOT populate a legacy `populated_fields`
field.

Acceptance:
- Both success and failure call sites in
  `scripts/export_watchlist/main.ts` emit `fields_populated`.
- The cached `event.schema.json`'s `gate.run.evidence_recorded`
  branch requires `fields_populated`.

### R-FIN-011: pipeline.done carries a cloned gate_results_summary

WHEN the watchlist export CLI emits the terminal `pipeline.done`
event, THE SYSTEM SHALL clone the Run record's
`gate_results_summary` into the event payload so the rollup is
auditable from the ledger alone.

Acceptance:
- The `pipeline.done` payload carries the same
  `gates_passed` / `gates_failed` / `all_passed` shape as the Run
  record's `gate_results_summary`.
- A downstream mutation of the event payload cannot reach back into
  the Run record (cloned by value, not by reference).

### R-FIN-012: validator enforces done-Run cross-checks

WHEN `scripts/validate_run_evidence.py` runs against a done Run
record, THE SYSTEM SHALL exit 1 if any of the following cross-checks
fails:

Acceptance:
- Required fields populated on the Run record:
  `prompt_snapshot_hash`, `tool_schemas_snapshot_hash`,
  `sandbox_image_ref`, `gate_results_summary`.
- At least one `gate.run.evidence_recorded` event in the ledger for
  the same run_id.
- `pipeline.start.payload.prompt_snapshot_hash` agrees with the Run
  record's field of the same name.
- `pipeline.start.payload.tool_schemas_snapshot_hash` agrees with
  the Run record's field of the same name.
- `gate.run.evidence_recorded.payload.fields_populated` (sorted)
  equals the sorted set of replay-equivalence fields populated on
  the Run record.
- `Run.gate_results_summary` matches the scan of
  `gate.check.passed` / `gate.check.failed` events: `gates_passed`
  and `gates_failed` are the sorted lists of `payload.gate_name`;
  `all_passed` is true iff `gates_failed` is empty.
- Each violation prints a message naming the run-id and the specific
  check.
