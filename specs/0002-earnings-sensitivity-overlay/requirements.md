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

### R-FIN-013: replay command enforces HEAD-strict checkout

WHEN `scripts/replay_run.py` runs against a recorded Run record,
THE SYSTEM SHALL parse the `@<sha>` suffix from
`Run.sandbox_image_ref` and compare it to the working-tree
`git rev-parse HEAD`. IF the SHAs differ, the script SHALL exit 1
with the message
`replay requires checkout of <sha>; current HEAD is <current-sha>.
Run: git checkout <sha>` and SHALL NOT auto-checkout.

Acceptance:
- The script exits 1 when HEAD does not match the recorded SHA.
- The error message names both the recorded SHA and the current
  HEAD, and includes the exact `git checkout <sha>` command.
- The script does not modify the working tree on mismatch.

### R-FIN-014: replay command verifies input hash agreement

WHEN `scripts/replay_run.py` runs after a successful HEAD check,
THE SYSTEM SHALL recompute `prompt_snapshot_hash` (from the
scoring heuristic config) and `tool_schemas_snapshot_hash` (from
the canonicalized contents of the four input files) and SHALL
assert equality with the values recorded on the Run record before
invoking the export.

Acceptance:
- The recompute uses a byte-equivalent canonicalization of the
  TypeScript emitter: heuristic-config keys sorted at every
  nesting level, inputs sorted by path, JSON.stringify with no
  whitespace, UTF-8 SHA-256 of the canonical bytes.
- On mismatch the script exits 1, writes a replay record with
  `verdict: input_hash_mismatch`, emits a
  `run.evidence.replayed` event with `replay_equivalent: false`,
  and does not invoke the export.

### R-FIN-015: replay command verifies byte-equivalent output

WHEN `scripts/replay_run.py` runs after a successful input-hash
check, THE SYSTEM SHALL shell out to
`node scripts/export_watchlist.mjs --no-emit-evidence
--output=<tmp>` and compare the produced packet's SHA-256 to the
committed packet's SHA-256 at
`ops/exports/chip-watchlist-risk-packet.json`.

Acceptance:
- The export sub-process runs with `--no-emit-evidence` so it does
  not write to `ops/event-ledger/` or `ops/run-records/`.
- The replay record carries both hashes
  (`replayed_packet_hash`, `committed_packet_hash`) and a
  `verdict` field (`byte_equal` or `byte_diff`).
- The script exits 0 iff the hashes are equal.

### R-FIN-016: replay command emits a per-replay ledger and record

WHEN `scripts/replay_run.py` runs end-to-end, THE SYSTEM SHALL
emit a `run.evidence.replayed` event to a fresh per-replay
ledger at
`ops/event-ledger/replay-<run-id>-<ISO-timestamp>.jsonl` and
write a replay report at
`ops/replay-records/<run-id>/<replay-event-id>.json`.

Acceptance:
- The per-replay ledger is a new file per replay (the source
  `<run-id>.jsonl` ledger is never modified).
- The `run.evidence.replayed` event payload carries `run_id`,
  `packet_ref` (the sibling trace-to-eval packet path or the
  committed producer packet as fallback), `replay_equivalent`,
  and `replay_method` (always `deterministic` for this repo).
- The replay record carries the recomputed hashes, the
  recorded sandbox SHA, the verdict, and a workspace-relative
  pointer to the matching per-replay ledger.

### R-FIN-017: emitter produces portable repo:// URIs

WHEN the watchlist export CLI emits a Run record, THE SYSTEM SHALL
populate the `sandbox_image_ref`, `inputs[].ref`, and
`outputs[].artifact_id` fields using the portable URI grammar
defined in DEC-CDCP-014, and SHALL populate `workspace_id` with the
bare repo name `chip-supply-chain-map`.

Acceptance:
- `sandbox_image_ref` matches `^repo://chip-supply-chain-map@
  ([a-f0-9]{40}|PENDING)/$`.
- Every `inputs[].ref` matches `^repo://chip-supply-chain-map@
  ([a-f0-9]{40}|PENDING)/.+$` with the relative path of the
  source file inside the repo (e.g.
  `src/data/nodes.csv`).
- Each `outputs[].artifact_id` matches `^artifact://
  chip-supply-chain-map/.+$` (logical artifact reference, not a
  file path).
- `workspace_id` equals `chip-supply-chain-map` (no scheme prefix,
  no SHA, no absolute filesystem path).

### R-FIN-018: validator resolves repo:// and accepts legacy paths

WHEN `scripts/validate_run_evidence.py` walks Run records and
events, THE SYSTEM SHALL expose a `resolve_uri(uri, portfolio_root)`
helper that resolves `repo://` URIs to local paths, returns None for
`artifact://` URIs, and returns the input as `Path(uri)` for legacy
local paths (DEC-CDCP-014 interop clause).

Acceptance:
- `repo://<repo>@<sha>/<rel-path>` resolves to
  `<portfolio_root>/<repo>/<rel-path>` with the default
  `portfolio_root = e:/claude_code/random-apps`.
- `artifact://<repo>/<id>` returns None.
- Legacy local paths (e.g. `src/data/nodes.csv`) return
  `Path(<path>)`.
- The PENDING placeholder SHA is accepted by the grammar and
  resolves the same way as a 40-char SHA (the validator does
  not refuse PENDING; the replay command does).

### R-FIN-019: replay accepts repo:// URIs and refuses PENDING

WHEN `scripts/replay_run.py` extracts the recorded SHA from
`Run.sandbox_image_ref`, THE SYSTEM SHALL accept both the
`repo://chip-supply-chain-map@<sha>/` URI form and the legacy
`<abs-path>@<sha>` form. IF the recorded SHA is the literal
`PENDING` placeholder, THE SYSTEM SHALL exit 1 with a message
naming `scripts/finalize_sandbox_ref.py` as the command to run
before replay can proceed.

Acceptance:
- The replay command extracts the SHA via the URI regex when
  the ref starts with `repo://`, else falls back to the legacy
  `@<sha>` suffix.
- A PENDING placeholder triggers a clean refusal; the script
  does not run `git rev-parse HEAD`, does not run the export,
  and does not write a replay record.

### R-FIN-020: finalizer rewrites PENDING to the post-commit SHA

WHEN `scripts/finalize_sandbox_ref.py --run-id <id>` runs against
a Run record carrying the PENDING placeholder, THE SYSTEM SHALL
read the current `git rev-parse HEAD` SHA and rewrite every
`@PENDING/` token in `sandbox_image_ref` and every `inputs[].ref`
to `@<head-sha>/` in place. The rewrite SHALL be idempotent on
records that already carry a resolved SHA.

Acceptance:
- The finalizer touches only `sandbox_image_ref` and
  `inputs[].ref`; other string fields containing the literal
  `PENDING` (notes, payloads, free-form text) are untouched.
- The rewritten file ends with one trailing newline and uses
  sort-keys + 2-space indent (matches the emitter's shape).
- A second invocation on the same file is a no-op that exits 0
  with the "no PENDING tokens" message.
- A missing Run record file produces exit 1 with a clear "not
  found" message.

### R-FIN-021: CI workflow set triggers on every PR + push to main

WHEN a pull request targets the `main` branch OR a push lands on
`main`, THE SYSTEM SHALL run the chip-supply-chain-map CI workflow
set on `ubuntu-latest` with Python 3.11 and Node 20.

Acceptance:
- `.github/workflows/gates.yml`,
  `.github/workflows/build.yml`, and
  `.github/workflows/run-evidence-gates.yml` each declare
  `on.pull_request:` with no branch filter and
  `on.push.branches: [main]`.
- Every job in the workflow set runs on `ubuntu-latest`.
- Python jobs set up `python-version: "3.11"`.
- Node jobs set up `node-version: "20"`.

### R-FIN-022: CI enforces the DEC-CDCP-015 contract gates

WHEN the CI workflow set runs, THE SYSTEM SHALL execute every
contract gate named in DEC-CDCP-015 and SHALL fail the build if
any gate fails.

Acceptance:
- Universal gates run via `gates.yml`:
  `check_schema_cache_freshness.py`, `voice_lint.py`,
  `check_no_bom.py`, `spec_check.py`, `validate_decisions.py`,
  `validate_roles.py`, `validate_tools.py`,
  `validate_policies.py`, `validate_dreams.py`, and
  `validate_run_evidence.py`.
- The Python test runner (`python -m unittest
  scripts.test_validate_run_evidence`, `scripts.test_replay_run`)
  runs via `gates.yml`.
- The TypeScript test runner (`npm test`) runs via `build.yml`.
- The product-side gates run via `run-evidence-gates.yml`:
  packet-generation-from-canonical-sample (clones the
  trace-to-eval bridge repo as a sibling and runs
  `python -m trace_to_eval evidence from-cdcp-events` over the
  canonical sample ledger with `--portfolio-root` pointed at the
  GitHub workspace), packet-validation
  (`python -m trace_to_eval evidence validate`), and
  replay-smoke (`python scripts/replay_run.py --run-id
  run-6a665b303138` after checking out the recorded sandbox SHA).
- The canonical sample is `run-6a665b303138`.

### R-FIN-023: replay-smoke checks out the recorded sandbox SHA

WHEN the replay-smoke gate runs, THE SYSTEM SHALL extract the
40-char sandbox SHA from `Run.sandbox_image_ref`, check out that
SHA, restore the finalized Run record over the working tree at
that SHA, and run `scripts/replay_run.py` to exit 0 with
`replay_equivalent: true`.

Acceptance:
- The job uses `actions/checkout@v4` with `fetch-depth: 0` so the
  recorded SHA is reachable.
- The SHA is extracted from the `sandbox_image_ref` URI via
  `jq -r .sandbox_image_ref` plus a regex that accepts both
  `repo://<repo>@<sha>/` and legacy `<abs-path>@<sha>` forms.
- The job copies the canonical Run record to the runner temp dir
  before checkout and restores it over the working tree after
  checkout, so the replay command receives the finalized record
  even when the bytes at the recorded SHA still carry PENDING.
- The replay command exits 0 with `replay_equivalent: true`.

### R-FIN-024: no escape hatch on any contract gate

WHEN any contract gate runs in CI, THE SYSTEM SHALL NOT carry a
`continue-on-error: true` flag, an `if: ${{ failure() }}` marker,
or any other shortcut that turns a gate failure into a build
pass.

Acceptance:
- `.github/workflows/gates.yml`,
  `.github/workflows/build.yml`, and
  `.github/workflows/run-evidence-gates.yml` carry zero
  `continue-on-error: true` lines on any contract gate.
- No step uses `if: ${{ failure() }}` or `if: always()` to mask
  failures on a contract gate.
- No path filter on `pull_request` or `push` excludes paths that
  would hide contract-gate failures.
- Documented developer and CI flows omit the `--no-verify`
  commit-hook bypass.

### R-FIN-025: dedicated multi-rerun replay determinism fixture

WHEN the replay determinism gate runs, THE SYSTEM SHALL execute a
dedicated unittest fixture at `scripts/test_replay_determinism.py`
that replays the canonical sample `run-6a665b303138` RERUNS times
(default 3 via env) at the recorded sandbox SHA and asserts every
replay produces an identical canonicalized SHA-256 over the tuple
`(replayed_packet_hash, recomputed_prompt_snapshot_hash,
recomputed_tool_schemas_snapshot_hash)`.

Acceptance:
- The fixture reads
  `ops/run-records/run-6a665b303138.json`, extracts the sandbox
  SHA from `sandbox_image_ref` via the DEC-FIN-006 `repo://` URI
  parser, saves the finalized Run record from the original HEAD,
  checks out the recorded sandbox SHA, restores the saved record
  over the working tree at that SHA, runs
  `python scripts/replay_run.py --run-id run-6a665b303138` RERUNS
  times, and reads each fresh replay record under
  `ops/replay-records/run-6a665b303138/<replay-event-id>.json`.
- Every replay carries `verdict == "byte_equal"` AND every
  `replayed_packet_hash` matches the recorded
  `committed_packet_hash`.
- The canonical hash is computed by JSON-encoding the three-field
  tuple with `sort_keys=True` and `separators=(",", ":")` and
  taking SHA-256 of the byte string; every rerun produces the
  same hash.
- On hash divergence the fixture writes
  `artifacts/failbundles/determinism_failure.json` plus
  `trace_0.json` and `trace_1.json` for the first two diverging
  canonical traces and fails the test with the bundle path.
- Teardown restores the original HEAD and removes any replay
  records and per-replay ledger files the fixture created so the
  working tree returns to its starting state.
- The fixture lives at `scripts/test_replay_determinism.py`
  (Python unittest, matching the existing
  `scripts/test_replay_run.py` convention) and is distinct from
  the producer-side integration test in `test_replay_run.py`.

### R-FIN-026: per-replay ledger filename carries the replay UUID

WHEN `scripts/replay_run.py` writes the per-replay ledger entry in
`emit_replay_event`, THE SYSTEM SHALL include the per-replay UUID
in the ledger filename so two replays inside the same wall-clock
second land on distinct files.

Acceptance:
- The ledger filename in `emit_replay_event` is
  `replay-<run-id>-<safe-ts>-<replay-event-id>.jsonl` where
  `safe-ts` is the ISO timestamp with colons and dashes stripped
  and `replay-event-id` is the UUID generated for the replay.
- The existing `replay-<run-id>-*.jsonl` glob the
  `test_replay_run` cases match against still matches because
  the UUID suffix sits inside the wildcard.
- Two consecutive replays in the determinism fixture never
  overwrite each other's ledger file.

### R-FIN-027: CI runs replay-determinism as a contract gate

WHEN the CI workflow set runs, THE SYSTEM SHALL execute the
`replay-determinism` job in
`.github/workflows/run-evidence-gates.yml` as a contract gate
with no escape hatch.

Acceptance:
- `.github/workflows/run-evidence-gates.yml` declares a separate
  `replay-determinism` job that runs on `ubuntu-latest` with
  Python 3.11 and Node 20.
- The job checks out chip-supply-chain-map with `fetch-depth: 0`
  so the recorded sandbox SHA is reachable, installs the
  gate-script dependencies plus the Node modules, and runs
  `python -m unittest scripts.test_replay_determinism` with
  `RERUNS=3`.
- The job carries no `continue-on-error: true` and no
  `if: ${{ failure() }}` mask.
- A failure-bundle upload step runs only on failure to capture
  `artifacts/failbundles/` for review and does not mask the
  underlying job failure.

### R-FIN-028: cowos-l-bottleneck scenario

WHEN a user toggles the `cowos-l-bottleneck` scenario, THE SYSTEM
SHALL apply a 2.1 chokepoint multiplier to the directly exposed
packaging cluster, bump packaging and substrate edges into the
accelerator platform rows one strength step, and add a six-month
lead-time bump on TSMC and the ABF substrate subtype nodes.

Acceptance:
- The scenario entry sits in the `SCENARIOS` array in
  `src/lib/scenarios.ts` with id `cowos-l-bottleneck`, label
  `CoWoS-L bottleneck (deepened)`, and the documented multiplier
  list (TSMC, ASE, Amkor, Ibiden, Unimicron, Shinko,
  `nvidia-blackwell-gb200`, `amd-instinct-mi-family`).
- The scenario's `edgeImpact` callback returns a one-step strength
  bump on edges whose `relation` is `packages-for`,
  `supplies-substrates`, or `manufactures-for` and whose `target`
  is `nvidia-blackwell-gb200` or `amd-instinct-mi-family`.
- The scenario's `nodeAttributeImpact` callback returns a
  six-month lead-time bump on the node id `tsmc` and on any node
  whose `subtype` is `abf-substrate`.
- The scenario appears as a toggle in
  `src/components/ScenarioControls.tsx` without UI wiring changes
  because the component iterates the `SCENARIOS` array.

### R-FIN-029: lithography-equipment-constraint scenario

WHEN a user toggles the `lithography-equipment-constraint`
scenario, THE SYSTEM SHALL apply a 2.0 chokepoint multiplier to the
directly exposed lithography and leading-edge cluster, bump
`supplies-equipment` edges from the four lithography suppliers into
the three leading-edge foundries one strength step, and add
nine-month and six-month lead-time bumps on ASML and Lasertec
respectively.

Acceptance:
- The scenario entry sits in the `SCENARIOS` array in
  `src/lib/scenarios.ts` with id
  `lithography-equipment-constraint`, label
  `Lithography equipment constraint`, and the documented
  multiplier list (ASML, Lasertec, Nikon, Canon, TSMC,
  `samsung-foundry`, `intel-foundry`, `sk-hynix`, Micron).
- The scenario's `edgeImpact` callback returns a one-step strength
  bump on edges whose `relation` is `supplies-equipment`, whose
  `source` is one of `asml`, `nikon`, `canon`, or `lasertec`, and
  whose `target` is one of `tsmc`, `samsung-foundry`, or
  `intel-foundry`.
- The scenario's `nodeAttributeImpact` callback returns a
  nine-month lead-time bump on the node id `asml` and a six-month
  lead-time bump on the node id `lasertec`.
- The scenario appears as a toggle in
  `src/components/ScenarioControls.tsx` without UI wiring changes
  because the component iterates the `SCENARIOS` array.

### R-FIN-030: scoring folds scenario edge and node bumps

WHEN `src/lib/scoring.ts::chokepointScore` runs against an active
scenario set that includes `cowos-l-bottleneck` or
`lithography-equipment-constraint`, THE SYSTEM SHALL fold the
scenario lead-time bumps into the lead-time term and read the
scenario edge-strength bumps through a `scenarioEdgePressure`
factor that returns 1.0 when no scenario is active.

Acceptance:
- The lead-time term in `chokepointScore` is
  `1 + (baseLeadTime + scenarioLeadTimeBumpMonths(node, ids)) / 12`
  so the lead-time bump composes with the baseline lead-time.
- The `scenarioEdgePressure` factor compares the scenario-on
  weighted-edge sum (sum over incident edges of
  `scenarioEdgeWeightMultiplier(edge, graph, ids)`) against the
  scenario-off baseline (sum over the same edges with empty ids)
  and returns the ratio; the factor is 1.0 when `ids` is empty so
  the baseline chokepoint score is unchanged.
- The test fixture at `src/lib/scenarios.test.ts` covers registry
  plumbing for both new scenarios, per-node multiplier target
  sets, edge-strength bumps with both compounding and
  ceiling-at-critical behavior, lead-time bumps, raw chokepoint
  score deltas under each scenario, and a normalized-rank
  snapshot. The fixture is wired into `npm test` via
  `scripts/run_ts_tests.mjs`.

### R-FIN-031: chaos test suite covers seven mutation classes

WHEN `scripts/validate_run_evidence.py` runs against the canonical
sample, THE SYSTEM SHALL also run a chaos test suite at
`scripts/test_chaos_run_evidence.py` that loads the canonical
sample pair, applies one mutation per Round-2 / Round-3 invariant
to a copy in a temp tree, runs the validator against the mutated
copy, and asserts the validator exits non-zero with a stderr line
that names the right check.

Acceptance:
- `scripts/test_chaos_run_evidence.py` carries seven mutation
  classes M1 through M7 mapped one-to-one onto the validator
  invariants:
  - M1 flips `Run.prompt_snapshot_hash` to a different
    valid-shape sha256-hex; cross-check #3 (hash agreement vs
    `pipeline.start`) must fire.
  - M2 flips `Run.tool_schemas_snapshot_hash` likewise; the same
    hash-agreement check must fire on the second field.
  - M3 appends a phantom gate name to
    `Run.gate_results_summary.gates_passed`; cross-check #5
    (gate-results agreement) must fire.
  - M4 strips the terminal `gate.run.evidence_recorded` event
    from the ledger; cross-check #2 (required terminal event)
    must fire.
  - M5 drops `prompt_snapshot_hash` from the `pipeline.start`
    event's payload; the typed-payload `oneOf` branch on
    `pipeline.start` must fire.
  - M6 adds `determinism` to
    `gate.run.evidence_recorded.payload.fields_populated` while
    the Run record does not populate that field; cross-check #4
    (fields_populated agreement) must fire.
  - M7 removes `sandbox_image_ref` from the Run record while
    `Run.status` stays `"done"`; cross-check #1
    (required-for-done field) must fire.
- Each chaos test reads the canonical sample from
  `ops/run-records/run-6a665b303138.json` and
  `ops/event-ledger/run-6a665b303138.jsonl`, applies its mutation
  in memory, writes the mutated copy to a `TemporaryDirectory`,
  monkey-patches the validator module's `ROOT` /
  `EVENT_LEDGER_DIR` / `RUN_RECORDS_DIR` to point at the temp
  tree, and runs `main`. The canonical sample on disk is never
  modified.
- Every chaos test asserts the validator returns exit code 1 and
  the stderr names the right check (or, for M5, names the
  mutated ledger file and a typed-payload schema rejection).

### R-FIN-032: chaos suite carries sanity + manifest assertions

WHEN the chaos test suite runs, THE SYSTEM SHALL also assert that
the unmutated canonical pair validates clean inside the harness
and that the mutation-class count stays pinned at seven.

Acceptance:
- The suite carries a `ChaosSanityCheck` class with a
  `test_unmutated_canonical_pair_passes` method that loads the
  canonical pair, writes it to the temp tree unmodified, runs
  the validator, and asserts exit code 0 plus
  `validate_run_evidence OK` in stdout. A failure here means the
  canonical sample broke (clear), not the harness leaked state
  (confusing).
- The suite carries a `MutationCoverageManifest` class with a
  `test_seven_mutation_classes_present` method that walks the
  module's globals for `TestCase` subclasses whose name starts
  with `M` plus a digit, sorts them, and asserts the sorted
  result equals the documented seven-class manifest. The
  assertion also pins the count at seven so a future class drop
  fails at test time, not in CI silence.

### R-FIN-033: chaos suite runs in CI as a contract gate

WHEN the CI workflow set runs, THE SYSTEM SHALL execute the
chaos test suite as a contract gate in both
`.github/workflows/gates.yml` and
`.github/workflows/run-evidence-gates.yml` with no
`continue-on-error: true` and no failure-masking conditionals.

Acceptance:
- `.github/workflows/gates.yml` carries a
  `chaos_run_evidence_tests` step that runs
  `python -m unittest scripts.test_chaos_run_evidence` next to
  the existing `validate_run_evidence_tests` step.
- `.github/workflows/run-evidence-gates.yml` carries a dedicated
  `chaos-validation` job that runs on `ubuntu-latest` with
  Python 3.11, installs the gate dependencies (`jsonschema`),
  and runs `python -m unittest scripts.test_chaos_run_evidence`.
- Neither workflow step or job carries `continue-on-error: true`
  or `if: ${{ failure() }}` or `if: always()` on the chaos step.
