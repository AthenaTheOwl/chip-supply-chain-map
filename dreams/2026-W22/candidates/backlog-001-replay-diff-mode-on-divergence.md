---
id: backlog-001-replay-diff-mode-on-divergence
target_kind: backlog_item
week: 2026-W22
mode: failure_clustering
human_review_required: true
evidence:
  - kind: file
    ref: scripts/replay_run.py - compare_outputs function
  - kind: file
    ref: ops/replay-records/run-6a665b303138/
  - kind: decision
    ref: decisions/DEC-FIN-005-watchlist-replay-command.md
  - kind: ci_workflow
    ref: .github/workflows/run-evidence-gates.yml - replay-smoke step
  - kind: spec
    ref: specs/0002-earnings-sensitivity-overlay/traceability.md R-FIN-015
---

## proposal

Title: **Add `replay --diff` mode that emits a structured packet diff
when `replay_equivalent` is false.**

Add a `--diff` flag to `scripts/replay_run.py`. When the flag is set
and the replay verdict is `output_hash_mismatch`, the script writes a
diff artifact under `ops/replay-records/<run-id>/diff.json` that
captures:

- the JSON Patch (RFC 6902) between the canonical packet and the
  replayed packet
- the list of changed paths grouped by top-level packet key
- a summary count of (added, removed, modified) leaf values
- the first ten changed values, truncated to 200 characters each

The CI `replay-smoke` step adds `--diff` so a red gate shipping a
divergence carries the diff as a CI artifact upload, not as a stderr
dump.

## rationale

Today the replay command exits 1 with a verdict string when packets
diverge. The CI gate logs the verdict and uploads the replay record,
which carries `replayed_packet_hash` and `committed_packet_hash` but
not the difference between the two packets. The diff lives in a
human-driven follow-up: pull the canonical packet, run the export
locally, run a JSON diff tool, find the divergence.

The `--diff` mode collapses that follow-up to zero. The first time the
gate flips red because a scoring weight drifts, the reviewer reads the
diff artifact, identifies the changed key, and either reverts the
drift or updates the canonical packet in one PR. Without the diff,
the same reviewer pays an unbounded debug cost on every red.

The diff also serves as a forward-compatibility signal: the diff for
"we added one new packet field" is small and obvious; the diff for
"the scoring heuristic changed shape" is large and obvious. The shape
of the diff is itself the signal.

## scope sketch

- Add `--diff` (default false) to `scripts/replay_run.py` argparse.
- After `compare_outputs` returns false, load both packet JSONs and
  compute a JSON Patch using `jsonpatch` (already a transitive dep)
  or a hand-rolled walker if the dep adds weight.
- Write the diff to `ops/replay-records/<run-id>/diff.json` with a
  small schema (changed_paths, summary, first_ten_values).
- Add a unit test under `scripts/test_replay_run.py` that asserts
  the diff format on a synthesized divergence (mutate one packet
  value, replay, check the diff).
- Update `.github/workflows/run-evidence-gates.yml` to pass `--diff`
  to the replay-smoke step and to upload the diff as an artifact on
  failure.
- Add an R-FIN-NNN row to traceability.md and a DEC-FIN-008
  decision that names the diff format as the contract.

## evidence

- `scripts/replay_run.py` `compare_outputs` returns a boolean today.
  The function has the two hashes in scope; the diff would compute
  in the same function.
- `ops/replay-records/run-6a665b303138/` holds the canonical replay
  record. The diff artifact would land alongside it.
- `decisions/DEC-FIN-005-watchlist-replay-command.md` is the DEC the
  diff mode extends.
- `.github/workflows/run-evidence-gates.yml` replay-smoke step is
  where the diff flag lands in CI.

## cost + risk

- Cost: **small.** One new flag, one new function, one new test, one
  workflow edit, one DEC. Single sprint.
- Risk: **low.** The flag is opt-in by default. The CI step is the
  only consumer that turns it on. A diff function that throws on an
  edge case falls back to the verdict string the gate already emits.
- Timeline: **next sprint** (W23 or W24).

## owner role

`engineering.implementation` for the script change, the test, the
workflow edit. `science.proof-gate-runner` for the diff format
review. `product.spec-writer` for the DEC.
