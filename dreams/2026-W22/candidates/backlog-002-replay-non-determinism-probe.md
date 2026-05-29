---
id: backlog-002-replay-non-determinism-probe
target_kind: backlog_item
week: 2026-W22
mode: adversarial_simulation
human_review_required: true
evidence:
  - kind: ci_workflow
    ref: .github/workflows/run-evidence-gates.yml - replay-smoke step
  - kind: file
    ref: scripts/replay_run.py
  - kind: run_record
    ref: ops/run-records/run-6a665b303138.json
  - kind: replay_record
    ref: ops/replay-records/run-6a665b303138/
  - kind: decision
    ref: decisions/DEC-FIN-005-watchlist-replay-command.md
  - kind: decision
    ref: decisions/DEC-FIN-007-chip-supply-chain-map-ci-enforces-run-evidence-chain.md
---

## proposal

Title: **Run the replay-smoke gate 25 times on the canonical sample to
bound the determinism claim.**

Add a one-shot probe job that runs `scripts/replay_run.py
--run-id run-6a665b303138` twenty-five times in a row on the same CI
runner, captures the `replayed_packet_hash` from each run, and asserts
all 25 hashes are equal. The probe runs as an opt-in workflow
(`.github/workflows/replay-determinism-probe.yml`) triggered by manual
dispatch or weekly cron, not on every PR.

A failure of the assertion (any two hashes differ) blocks promotion of
the probe to the contract suite and writes a postmortem stub under
`ops/postmortems/replay-non-determinism-<date>.md` with the diverging
hashes, the run logs, and the git SHA.

## rationale

The contract today proves the canonical sample replays deterministically
on the CI runner that fires the replay-smoke step. The contract does
not prove the canonical sample replays deterministically across:

- repeated runs on the same runner (would catch a non-deterministic
  iteration order, a time-dependent value, an environment-dependent
  hash)
- different runners (would catch a Node version drift, a glibc
  drift, a filesystem-ordering drift)
- different network conditions (would catch a hidden network call
  that the emitter mistakenly makes)

The W22 rollout shipped the deterministic claim. The probe bounds the
claim. Without the probe, the first time the gate flips red because of
a flake (which is the most likely failure mode of a CI-pinned
determinism gate), the team has no baseline to know whether the flake
is real or rare.

25 runs on one runner is the cheapest probe that gives a statistical
floor: if the true flake rate is 5 percent, 25 runs catches at least
one flake with probability ~72 percent. If the true flake rate is 1
percent, 25 runs catches one with probability ~22 percent; that case
calls for a follow-up probe at 100 runs across three runners.

## scope sketch

- Add `.github/workflows/replay-determinism-probe.yml` (manual
  dispatch + weekly cron) that runs the replay 25 times in a single
  job and asserts hash equality
- Add a small helper script `scripts/probe_replay_determinism.py`
  that wraps the 25-run loop and the hash-equality assertion (keeps
  the workflow file thin)
- Add a unit test under `scripts/test_probe_replay_determinism.py`
  that synthesizes two diverging hashes and asserts the helper
  reports the divergence with a typed error
- Add a postmortem template under
  `ops/postmortems/_template-replay-non-determinism.md`
- Add a `DEC-FIN-009` decision that authorises the probe and names
  the 25-run threshold

## evidence

- `ops/run-records/run-6a665b303138.json` is the canonical sample.
- `ops/replay-records/run-6a665b303138/` carries the committed
  replayed packet hash; the probe compares 25 fresh hashes against
  this baseline.
- `scripts/replay_run.py` is the entry point the probe calls.
- `.github/workflows/run-evidence-gates.yml` replay-smoke step is
  the once-per-PR equivalent that the probe extends.
- `DEC-FIN-005` and `DEC-FIN-007` are the load-bearing decisions
  the probe defends.

## cost + risk

- Cost: **small.** One workflow file, one helper script, one test,
  one postmortem template, one DEC. Single sprint.
- Risk: **low + informational.** The probe is opt-in by manual
  dispatch or cron; it does not block the contract gates today. The
  worst case is the probe fires red and the team learns about a
  determinism flake earlier than they otherwise would have.
- Timeline: **next sprint** (W23).

## owner role

`science.proof-gate-runner` for the probe design (gate authoring
lives with the proof-gate role). `engineering.implementation` for
the helper script and the test. `control.coordinator` for the
workflow file and the DEC.
