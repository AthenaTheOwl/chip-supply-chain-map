---
id: DEC-FIN-006-watchlist-export-portable-repo-uri-migration
amends: DEC-FIN-005-watchlist-replay-command
spec: specs/0002-earnings-sensitivity-overlay/
requirement: R-FIN-017
date: 2026-05-29
status: approved
reversible: true
decision: |
  chip-supply-chain-map's watchlist export adopts the portable
  repo:// + artifact:// URI grammar defined in DEC-CDCP-014
  (athena-site). The Run record's `sandbox_image_ref` becomes
  `repo://chip-supply-chain-map@<sha>/`; every `inputs[].ref`
  becomes `repo://chip-supply-chain-map@<sha>/<rel-path>`;
  `outputs[].artifact_id` becomes
  `artifact://chip-supply-chain-map/<id>`; `workspace_id` becomes
  the bare repo name `chip-supply-chain-map` (no scheme prefix, no
  SHA). The validator at `scripts/validate_run_evidence.py` and
  the replay command at `scripts/replay_run.py` gain a
  `resolve_uri` helper that accepts the new URI form, the
  `artifact://` form, and legacy local paths during the migration
  window (DEC-CDCP-014 interop clause).

  The systemic `sandbox_image_ref` off-by-one bug all four Round-5
  agents independently caught at the sample level is fixed at the
  root with **Option A (two-pass emit)**: the emitter writes a
  placeholder URI `repo://chip-supply-chain-map@PENDING/` at first
  emit; a separate helper
  `scripts/finalize_sandbox_ref.py` rewrites every
  `@PENDING/` token in the Run record's `sandbox_image_ref` and
  `inputs[].ref` URIs to the post-commit SHA via
  `git rev-parse HEAD`. The finalizer runs after the regenerate
  commit lands, so the recorded SHA always points at a commit
  that contains the sample bytes. Replay refuses to process a Run
  record that still carries the PENDING placeholder; the
  canonical message names the finalizer command.
alternatives:
  - label: Option B (post-commit emission with --sandbox-sha flag)
    rejected_because: |
      Option B requires the regenerate wrapper to defer Run record
      emission until after the data commit lands, then pass the
      newly-resolved SHA into the emitter via `--sandbox-sha`. That
      flow inverts the normal emit-then-commit order: the ledger
      events are emitted at run time, but the Run record only
      lands at commit time, leaving the ledger orphaned until the
      commit happens. Option A (placeholder + finalizer) keeps the
      normal emit order intact and isolates the SHA rewrite to
      one targeted post-commit step; if the finalizer fails or is
      skipped, the validator and replay both detect the PENDING
      placeholder cleanly.
  - label: Option C (single-pass with post-edit of the JSON file)
    rejected_because: |
      Option C reads the just-written Run record JSON at the end of
      the regenerate flow and edits `sandbox_image_ref` in place
      via the wrapper script. The behavior is functionally
      equivalent to Option A but couples the rewrite to the
      regenerate wrapper instead of factoring it into a named CLI
      helper. The Option A finalizer is reusable across
      regenerate runs, post-commit hooks, and the eventual CI
      gate; Option C requires duplicating the rewrite logic each
      time. The cost is one extra script and one extra invocation
      in the regenerate flow; the benefit is the rewrite gets a
      typed CLI surface and a unit test matrix.
  - label: keep emitting the legacy `<abs-path>@<sha>` form
    rejected_because: |
      DEC-CDCP-014 mandates portable URIs across the portfolio so
      consumer-side tools (the trace-to-eval bridge repo,
      athena-site dashboards) can resolve cross-repo references
      without hard-coding absolute filesystem layouts. Keeping the
      legacy form would require every consumer to special-case
      chip-supply-chain-map's ref shape; the migration cost
      compounds with every repo that lags. Round 6 cuts the cost
      once.
rationale: |
  This DEC amends DEC-FIN-005. Round 5 shipped the deterministic
  replay command and patched the canonical sample's
  `sandbox_image_ref` from `ef79a7ff` to `4814747e` to satisfy
  HEAD-strict replay; that bump was the symptom of a systemic bug
  the agent fleet caught independently. The emitter computes
  `git rev-parse HEAD` at emit time, BEFORE the commit that
  contains the sample lands; the recorded SHA is therefore one
  commit behind the truth. Every Round-5 sample-level patch
  re-introduced the same fragility on the next regenerate.

  Round 6 fixes the root cause. The emitter no longer claims to
  know the producing commit's SHA at emit time; it records the
  placeholder `repo://chip-supply-chain-map@PENDING/` instead.
  The finalizer runs after the regenerate commit lands and swaps
  PENDING for the resolved SHA. The audit trail is honest: the
  Run record records the producer-intent at first emit and the
  resolved truth after the commit lands; both states are
  legible to a reviewer.

  Three discipline points:

  1. URI grammar: emitted refs match `^repo://[a-z][a-z0-9-]*@
     [a-f0-9]{40}/` (or the PENDING placeholder during the
     emit-then-finalize window). The validator and replay
     regexes pin the grammar.

  2. Interop: validator + replay continue to accept legacy local
     paths so consumer-side tools and older Run records do not
     break during the migration window. DEC-CDCP-014's interop
     clause is load-bearing.

  3. Off-by-one fix: PENDING + finalizer instead of an in-emitter
     post-commit hook because the finalizer is reusable across
     regenerate runs, future post-commit hooks, and the CI gate
     that lands in Round 7.

  Tests cover the URI helpers (TS emitter), the `resolve_uri`
  helper (Python validator + replay), the `_parse_sandbox_sha`
  parser across both URI and legacy forms, and the finalizer
  flow (positive, idempotent, partial, missing).

  Keeping the change reversible per the standard DEC contract:
  the emitter helper functions are additive, the placeholder
  shape is documented in the module docstring, the finalizer is
  a single self-contained script, and the validator/replay
  changes are pure additions (no behavior is removed). A
  rollback restores the legacy `<abs-path>@<sha>` form by
  reverting the four Round-6 commits in order.
evidence:
  - kind: spec
    ref: specs/0002-earnings-sensitivity-overlay/requirements.md
  - kind: decision
    ref: decisions/DEC-FIN-005-watchlist-replay-command.md
  - kind: doc
    ref: src/lib/runEvidence.ts
  - kind: doc
    ref: src/lib/runEvidence.test.ts
  - kind: doc
    ref: scripts/export_watchlist/main.ts
  - kind: doc
    ref: scripts/validate_run_evidence.py
  - kind: doc
    ref: scripts/test_validate_run_evidence.py
  - kind: doc
    ref: scripts/replay_run.py
  - kind: doc
    ref: scripts/test_replay_run.py
  - kind: doc
    ref: scripts/finalize_sandbox_ref.py
  - kind: doc
    ref: scripts/test_finalize_sandbox_ref.py
rollback: |
  Revert the four Round-6 commits in order: the DEC and spec
  ledger updates, the regenerated sample, the validator + replay
  + finalizer Python changes, and the TypeScript emitter
  migration. The `R-FIN-017` through `R-FIN-020` requirements
  come out of `requirements.md` and `traceability.md` in the
  same revert. The cached `event.schema.json` and
  `run.schema.json` stay because Round 6 does not touch the
  schema bodies; the URI shape is permitted under the existing
  string-typed ref fields. No data migration is needed because
  the legacy `<abs-path>@<sha>` form is still accepted by the
  validator + replay after the rollback; the rollback just
  removes the URI emission path. After the rollback the
  canonical sample's `sandbox_image_ref` goes back to the
  Round-5 `4814747e` legacy form and `validate_run_evidence`
  still passes.
owner: control.coordinator
---

## decision

The watchlist export emitter produces portable repo:// URIs per
DEC-CDCP-014. The validator and replay command accept both URI
and legacy forms during the migration window. The systemic
`sandbox_image_ref` off-by-one is fixed via Option A
(placeholder + finalizer): the emitter writes
`repo://chip-supply-chain-map@PENDING/` at first emit;
`scripts/finalize_sandbox_ref.py` rewrites PENDING to the
post-commit `git rev-parse HEAD` SHA once the regenerate commit
lands.

## alternatives

- Option B (post-commit emission via `--sandbox-sha`): rejected
  because it inverts the normal emit-then-commit order and
  orphans the ledger until the commit happens.
- Option C (single-pass post-edit in the regenerate wrapper):
  rejected because it duplicates the rewrite logic each time
  instead of factoring it into a typed CLI helper.
- Keep legacy `<abs-path>@<sha>`: rejected because DEC-CDCP-014
  mandates portable URIs portfolio-wide; the migration cost
  compounds with every repo that lags.

## rationale

Round 5 shipped deterministic replay and patched the sample's
sandbox SHA at the leaf to satisfy HEAD-strict replay; that
patch was the symptom of a systemic bug all four Round-5 agents
caught. The emitter computed `git rev-parse HEAD` BEFORE the
commit that contained the sample, so the recorded SHA was one
commit behind the truth. Round 6 fixes the root cause: the
emitter records PENDING, the finalizer records truth after the
commit lands. Replay refuses PENDING; the validator accepts
PENDING (the audit trail must survive the emit-then-finalize
window).

Three discipline points: URI grammar regex pins the shape, the
DEC-CDCP-014 interop clause keeps legacy paths working during
the cutover, and the placeholder + finalizer pattern is reusable
across regenerate runs, post-commit hooks, and the Round-7 CI
gate.

## evidence

- `src/lib/runEvidence.ts` exports `REPO_NAME`, `buildRepoUri`,
  `buildArtifactUri`, `pendingSandboxImageRef`, and rewrites
  `deriveSandboxImageRef` to return the URI form.
- `scripts/export_watchlist/main.ts` emits the URI form for
  `sandbox_image_ref`, `inputs[].ref`, `outputs[].artifact_id`,
  and uses the bare repo name for `workspace_id`.
- `scripts/validate_run_evidence.py` adds the `resolve_uri`
  helper and the URI regex; the validator continues to accept
  legacy local paths.
- `scripts/replay_run.py` adds `resolve_uri` and updates
  `_parse_sandbox_sha` to accept both URI and legacy forms; PENDING
  triggers a clean refusal naming the finalizer command.
- `scripts/finalize_sandbox_ref.py` is the new CLI helper that
  swaps `@PENDING/` tokens for the post-commit SHA.
- `scripts/test_validate_run_evidence.py` adds six tests for the
  `resolve_uri` helper plus one end-to-end test that a URI Run
  record validates clean.
- `scripts/test_replay_run.py` adds seven tests pinning the new
  URI parser branches.
- `scripts/test_finalize_sandbox_ref.py` covers four cases
  (positive, idempotent, missing record, partial rewrite).
- `ops/run-records/run-6a665b303138.json` is the regenerated
  sample carrying the URI form with the finalizer-resolved SHA.

## rollback

Revert the four Round-6 commits in order. `R-FIN-017..020` come
out of the spec in the same revert. The schemas stay because
they are URI-agnostic. No data migration is needed because the
validator + replay still accept the legacy form post-rollback.

## coverage

This DEC resolves the following requirements added to spec
0002:

- `R-FIN-017` the watchlist export emitter produces portable
  repo:// URIs per DEC-CDCP-014 for `sandbox_image_ref`,
  `inputs[].ref`, and `outputs[].artifact_id`; `workspace_id`
  carries the bare repo name `chip-supply-chain-map`.
- `R-FIN-018` `scripts/validate_run_evidence.py` exposes a
  `resolve_uri` helper that resolves `repo://` URIs to local
  paths under a portfolio root, returns None for `artifact://`
  URIs, and passes legacy local paths through unchanged
  (DEC-CDCP-014 interop clause).
- `R-FIN-019` `scripts/replay_run.py` accepts both the new URI
  form and the legacy `<abs-path>@<sha>` form when extracting
  the recorded sandbox SHA, and refuses to replay a Run record
  whose `sandbox_image_ref` still carries the PENDING
  placeholder.
- `R-FIN-020` `scripts/finalize_sandbox_ref.py` rewrites every
  `@PENDING/` token in a Run record's `sandbox_image_ref` and
  `inputs[].ref` URIs to the post-commit `git rev-parse HEAD`
  SHA; the rewrite is idempotent on records that already carry a
  resolved SHA.
