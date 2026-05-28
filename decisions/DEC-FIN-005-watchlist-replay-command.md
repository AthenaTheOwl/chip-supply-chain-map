---
id: DEC-FIN-005-watchlist-replay-command
amends: DEC-FIN-004-watchlist-export-run-evidence-cross-checks
spec: specs/0002-earnings-sensitivity-overlay/
requirement: R-FIN-013
date: 2026-05-28
status: approved
reversible: true
decision: |
  chip-supply-chain-map ships `scripts/replay_run.py` that performs
  deterministic replay against a recorded Run record. The script
  loads `ops/run-records/<run-id>.json` and the matching
  `ops/event-ledger/<run-id>.jsonl`, parses the `@<sha>` suffix from
  `Run.sandbox_image_ref`, runs `git rev-parse HEAD`, and exits 1
  on mismatch with the canonical message
  `replay requires checkout of <sha>; current HEAD is <current-sha>.
  Run: git checkout <sha>`. No auto-checkout. On match the script
  recomputes the input fingerprints (`prompt_snapshot_hash` from the
  scoring heuristic config, `tool_schemas_snapshot_hash` from the
  canonicalized contents of the four input files) using the same
  byte-equivalent canonicalization as the TypeScript emitter, shells
  out to `node scripts/export_watchlist.mjs --no-emit-evidence
  --output=<tmp>`, and compares the produced packet's SHA-256 to
  the committed packet at
  `ops/exports/chip-watchlist-risk-packet.json`. The script emits a
  `run.evidence.replayed` event to a fresh per-replay ledger at
  `ops/event-ledger/replay-<run-id>-<ISO-timestamp>.jsonl` and
  writes a replay report at
  `ops/replay-records/<run-id>/<replay-event-id>.json`. The replay
  exits 0 iff the produced packet bytes match the committed packet
  bytes.
alternatives:
  - label: shell-script replay (bash + jq + sha256sum)
    rejected_because: |
      The existing validator at `scripts/validate_run_evidence.py`
      is Python; matching the validator's language keeps the test
      pattern (`scripts/test_validate_run_evidence.py` + stdlib
      `unittest`) reusable for the replay tests and keeps the gate
      stack one-language. A bash replay would also have to
      reimplement the canonicalization of inputs and heuristic
      config; Python lets us pin the canonicalization in a module
      that the test matrix can import directly.
  - label: auto-checkout the recorded SHA before replay
    rejected_because: |
      Auto-checkout silently mutates the reviewer's working tree
      and would conflict with uncommitted edits. The HEAD-strict
      check exits 1 with the exact `git checkout <sha>` command
      the reviewer needs to paste; the reviewer keeps control of
      the working tree. The same convention is used in
      validate_run_evidence's "Re-cache from athena-site" error
      message for the same reason.
  - label: hash-only replay (skip the actual re-export)
    rejected_because: |
      A hash-only replay would catch input drift (the
      `tool_schemas_snapshot_hash` mismatch path) but would not
      catch a bug in the export pipeline that produces a different
      packet from the same inputs. Re-running the export and
      hashing the produced bytes is the cheaper-than-eval proof of
      "same code + same data = same output" the spec's
      determinism claim rests on.
  - label: write replay events to the original `<run-id>.jsonl`
      ledger instead of a fresh per-replay ledger
    rejected_because: |
      The original ledger is the append-only audit trail for the
      producing run. Appending replay events would conflate
      "what the pipeline emitted" with "what a downstream
      verifier observed"; the per-replay ledger keeps the two
      streams separate and lets multiple replays land without
      ordering ambiguity. The per-replay file name carries the
      replay timestamp so collisions cannot occur.
rationale: |
  This DEC amends DEC-FIN-004. Rounds 1-4 shipped typed event
  payloads, emitter cross-checks, and packet schema v2 carrying
  producer identity. The spec's determinism claim ("same inputs
  plus same code equals same output, and the Run record makes
  that auditable") still required a third party to manually re-run
  the export and `diff` the output to verify. Round 5 collapses
  that manual loop into one command: `python scripts/replay_run.py
  --run-id <id>` returns a typed pass/fail verdict plus a recorded
  artifact (the replay record + event) instead of a markdown note.

  The replay's three discipline points:

  1. HEAD-strict: the script refuses to replay unless the working
     tree is at the recorded `sandbox_image_ref` SHA. The reviewer
     keeps control of the checkout step; the script names the SHA
     and the exact command to paste. This catches the case where
     a later commit changed the export code without updating the
     sample.

  2. Input hash agreement: before re-running the export, the
     script recomputes the canonicalized input hashes (heuristic
     config + the four CSV/markdown inputs) and asserts equality
     with the recorded values. This catches an input-file edit
     that landed after the run was recorded without re-emitting
     a fresh Run record.

  3. Byte-equivalent output: the produced packet bytes must equal
     the committed packet bytes. SHA-256 of the file contents.
     No tolerance, no whitespace normalization, no field-level
     diff: byte equality is the determinism claim, and any
     tolerance would soften it.

  The pytest module `scripts/test_replay_run.py` covers four
  cases: positive byte-equivalent replay, HEAD mismatch, missing
  Run record, and synthetic input drift. The positive case stubs
  the export sub-process so the test runs without `node`
  installed; the HEAD and input-drift cases drive the real code
  paths against a temp ops/ layout.

  Keeping the change reversible per the standard DEC contract:
  the replay module isolates the new logic in one script, the
  per-replay ledger is a new file pattern (no edits to existing
  ledgers), and the sample Run record's `sandbox_image_ref`
  bump from `ef79a7ff` to `4814747e` is a single-line diff. A
  rollback drops the replay script, the test module, this DEC,
  the per-replay ledger, the replay record, and the sandbox
  bump.
evidence:
  - kind: spec
    ref: specs/0002-earnings-sensitivity-overlay/requirements.md
  - kind: decision
    ref: decisions/DEC-FIN-004-watchlist-export-run-evidence-cross-checks.md
  - kind: doc
    ref: scripts/replay_run.py
  - kind: doc
    ref: scripts/test_replay_run.py
  - kind: doc
    ref: ops/run-records/run-6a665b303138.json
  - kind: doc
    ref: ops/event-ledger/replay-run-6a665b303138-20260528T122033Z.jsonl
  - kind: doc
    ref: ops/replay-records/run-6a665b303138/a2d7a13e-b973-4ff3-a348-b125b6d9f37d.json
  - kind: doc
    ref: ops/schemas-cache/event.schema.json
rollback: |
  Revert the three Round-5 commits in order: the DEC and spec
  ledger updates, the replay artifact plus sample
  `sandbox_image_ref` bump, and the replay script plus tests. The
  `R-FIN-013` through `R-FIN-016` requirements come out of
  `specs/0002-earnings-sensitivity-overlay/requirements.md` and
  `traceability.md` in the same revert. The cached
  `event.schema.json` stays because the
  `run.evidence.replayed` branch already mirrors the athena-site
  source-of-truth schema. No data migration is needed because the
  per-replay ledger files and replay records are new artifacts;
  removing them does not affect the producer-side ledger or Run
  record. After the rollback the sample's `sandbox_image_ref`
  goes back to `ef79a7ff` and `validate_run_evidence` still
  passes.
owner: control.coordinator
---

## decision

`scripts/replay_run.py` performs deterministic, HEAD-strict
replay of a recorded Run record. It refuses to auto-checkout,
asserts the recomputed input fingerprints match the recorded
values, re-runs the watchlist export to a temp path, and exits
0 iff the produced packet bytes equal the committed packet
bytes. Each replay emits a `run.evidence.replayed` event to a
fresh per-replay ledger and writes a replay report.

## alternatives

- Shell-script replay (bash + jq + sha256sum): rejected because
  the validator stack is Python; one-language matters.
- Auto-checkout the recorded SHA: rejected because the reviewer
  keeps control of the working tree.
- Hash-only replay: rejected because the determinism claim
  covers the export code path, not just the input hashes.
- Append replay events to the original ledger: rejected because
  the per-replay ledger keeps producer and verifier streams
  separate.

## rationale

Rounds 1-4 shipped typed payloads + cross-checks + packet
schema v2. The "third party can verify" claim still required a
manual re-run + diff. The replay command collapses that loop
into one command with a typed pass/fail verdict and a recorded
artifact. Three discipline points: HEAD-strict (no
auto-checkout, reviewer keeps the working tree), input hash
agreement (catch input drift before invoking the export), and
byte-equivalent output (no tolerance softens the determinism
claim).

The pytest module covers positive replay, HEAD mismatch,
missing Run record, and synthetic input drift. The positive
case stubs `node`; the other three drive real code paths.

## evidence

- `specs/0002-earnings-sensitivity-overlay/requirements.md`
  lists `R-FIN-013` through `R-FIN-016` added in the same
  commit.
- `decisions/DEC-FIN-004-*` is the amended Round-3 decision.
- `scripts/replay_run.py` carries the replay flow.
- `scripts/test_replay_run.py` carries the four-case test
  matrix.
- `ops/run-records/run-6a665b303138.json` carries the bumped
  `sandbox_image_ref` so the replay command can run at the
  current HEAD.
- `ops/event-ledger/replay-run-6a665b303138-20260528T122033Z.jsonl`
  is the canonical replay event (one
  `run.evidence.replayed` event with `replay_equivalent: true`).
- `ops/replay-records/run-6a665b303138/a2d7a13e-b973-4ff3-a348-b125b6d9f37d.json`
  is the canonical replay record (recomputed hashes match
  recorded; replayed packet hash equals committed packet hash).

## rollback

Revert the three Round-5 commits in order. The
`R-FIN-013..016` requirements come out of the spec in the same
revert. The cached `event.schema.json` stays because the
`run.evidence.replayed` branch mirrors the athena-site source
of truth. No data migration is needed; the per-replay ledger
and replay record are append-only new files.

## coverage

This DEC resolves the following requirements added to spec
0002:

- `R-FIN-013` `scripts/replay_run.py` enforces HEAD-strict
  replay: if the working-tree HEAD SHA differs from the
  `@<sha>` suffix of `Run.sandbox_image_ref`, the script exits
  1 with the canonical `git checkout <sha>` message and does
  not run the export.
- `R-FIN-014` the replay command recomputes
  `prompt_snapshot_hash` and `tool_schemas_snapshot_hash`
  using a byte-equivalent canonicalization of the TypeScript
  emitter and asserts equality with the recorded values
  before invoking the export.
- `R-FIN-015` the replay command shells out to
  `node scripts/export_watchlist.mjs --no-emit-evidence
  --output=<tmp>` and compares the produced packet's SHA-256
  to the committed packet's SHA-256 at
  `ops/exports/chip-watchlist-risk-packet.json`; replay exits
  0 iff the hashes match.
- `R-FIN-016` the replay command emits a
  `run.evidence.replayed` event to a fresh per-replay ledger
  at `ops/event-ledger/replay-<run-id>-<ISO-timestamp>.jsonl`
  and writes a replay report at
  `ops/replay-records/<run-id>/<replay-event-id>.json`; both
  artifacts carry the recomputed hashes, the recorded sandbox
  SHA, and the verdict.
