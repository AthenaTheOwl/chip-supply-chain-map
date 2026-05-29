# tasks: earnings sensitivity overlay

## Data

- [x] Add `src/data/financial_sensitivity.csv` with 8-12 sourced
  public-company records.
- [x] Add source IDs for every new financial row.
- [x] Add the financial CSV to the 180-day freshness gate.

## App

- [x] Add a TypeScript loader for the financial sensitivity CSV.
- [x] Render an investor section in the selected-node panel.
- [x] Mark records whose scenario is active.
- [x] Add watchlist state for selected graph nodes.
- [x] Add a watchlist panel with aggregate exposure summary.
- [x] Add JSON and markdown risk packet export.

## Governance

- [x] Add `R-FIN-001`.
- [x] Add `DEC-FIN-001-static-sourced-sensitivity-over-live-market-data.md`.
- [x] Add `R-FIN-002`.
- [x] Add `DEC-FIN-002-deterministic-watchlist-risk-packets.md`.
- [x] Update README reader guidance.

## Run-evidence rollout (Phase D)

- [x] Mirror `ops/schemas-cache/event.schema.json` from athena-site.
- [x] Add `src/lib/runEvidence.ts` emitter module + tests.
- [x] Add `scripts/validate_run_evidence.py` validator gate.
- [x] Wire the validator into `.github/workflows/gates.yml`.
- [x] Add `scripts/export_watchlist/main.ts` CLI + `scripts/export_watchlist.mjs` launcher.
- [x] Add `npm run export:watchlist` script.
- [x] Add `R-FIN-003` through `R-FIN-008`.
- [x] Add `DEC-FIN-003-watchlist-export-emits-conformant-run-evidence.md`.
- [x] Ship a canonical sample Run record + event ledger under `ops/`.

## Run-evidence Round 3 (typed payloads + cross-checks)

- [x] Rename `tool_id` to `tool_name` in the two `tool.call.completed`
  emissions in `scripts/export_watchlist/main.ts`.
- [x] Rename `populated_fields` to `fields_populated` on both the
  success and failure `gate.run.evidence_recorded` emissions.
- [x] Clone `gate_results_summary` into the `pipeline.done` payload.
- [x] Extend `scripts/validate_run_evidence.py` with the five
  done-Run cross-checks.
- [x] Add `scripts/test_validate_run_evidence.py` (1 positive + 7
  negative cases) and wire it into `.github/workflows/gates.yml`.
- [x] Regenerate the canonical sample (`run-6a665b303138`) and
  retire the obsolete one (`run-efeb29900de3`).
- [x] Add `R-FIN-009` through `R-FIN-012`.
- [x] Add `DEC-FIN-004-watchlist-export-run-evidence-cross-checks.md`.

## Run-evidence Round 5 (deterministic replay command)

- [x] Add `scripts/replay_run.py` with HEAD-strict checkout,
  input-hash agreement, byte-equivalent output comparison, and
  per-replay ledger + record emission.
- [x] Add `scripts/test_replay_run.py` (1 positive + 3 negative
  cases: HEAD mismatch, missing Run record, input drift).
- [x] Bump the canonical sample's `sandbox_image_ref` so the replay
  command runs against the current HEAD.
- [x] Ship the canonical replay artifact pair under
  `ops/event-ledger/replay-run-6a665b303138-*.jsonl` and
  `ops/replay-records/run-6a665b303138/`.
- [x] Add `R-FIN-013` through `R-FIN-016`.
- [x] Add `DEC-FIN-005-watchlist-replay-command.md`.

## Run-evidence Round 6 (portable repo:// URIs + off-by-one fix)

- [x] Add `REPO_NAME`, `buildRepoUri`, `buildArtifactUri`,
  `pendingSandboxImageRef` exports to `src/lib/runEvidence.ts`.
- [x] Migrate `deriveSandboxImageRef` to return the
  `repo://chip-supply-chain-map@<sha>/` URI form.
- [x] Update `scripts/export_watchlist/main.ts` to wire URI shape
  into `sandbox_image_ref`, `inputs[].ref`,
  `outputs[].artifact_id`, and to set `workspace_id` to the bare
  repo name.
- [x] Add `resolve_uri` helper + URI regexes to
  `scripts/validate_run_evidence.py`.
- [x] Update `scripts/replay_run.py` `_parse_sandbox_sha` to
  accept both URI and legacy forms; refuse PENDING placeholder
  with a finalizer-pointing message.
- [x] Add `scripts/finalize_sandbox_ref.py` CLI helper that
  rewrites `@PENDING/` tokens to the post-commit head SHA.
- [x] Extend test matrices in
  `scripts/test_validate_run_evidence.py` and
  `scripts/test_replay_run.py` for the new URI helpers.
- [x] Add `scripts/test_finalize_sandbox_ref.py` (4 cases:
  positive, idempotent, missing, partial).
- [x] Update `src/lib/runEvidence.test.ts` to cover the URI
  helpers and the migrated Run record shape.
- [x] Regenerate the canonical sample (`run-6a665b303138`)
  carrying the URI form with the finalizer-resolved SHA.
- [x] Add `R-FIN-017` through `R-FIN-020`.
- [x] Add `DEC-FIN-006-watchlist-export-portable-repo-uri-migration.md`.

## Verification

- [x] Add aggregation and export tests.
- [x] Run the python gates.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `npm run lint`.
