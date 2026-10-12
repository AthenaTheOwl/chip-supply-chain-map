---
id: DEC-FIN-012-scheduled-replay-freshness-commit
amends: DEC-FIN-007-chip-supply-chain-map-ci-enforces-run-evidence-chain
spec: specs/0002-earnings-sensitivity-overlay/
requirement: R-FIN-038
date: 2026-10-12
status: approved
reversible: true
decision: |
  chip-supply-chain-map adds `.github/workflows/replay-freshness.yml`,
  a scheduled workflow (`cron: "17 6 1,15 * *"` plus
  `workflow_dispatch`) that replays the canonical sample
  `run-6a665b303138` and commits the dated replay record.

  The replay steps are the `replay-smoke` sequence from
  `run-evidence-gates.yml`, unchanged: check out the sibling
  trace-to-eval-harness, save the finalized Run record, the current
  `scripts/replay_run.py` and `ops/exports/chip-watchlist-risk-packet.json`,
  check out the recorded sandbox SHA, overlay the three, and run
  `python scripts/replay_run.py --run-id run-6a665b303138`.

  Only a replay that exits 0 is committed. The workflow then finds
  the one new report under `ops/replay-records/run-6a665b303138/`,
  reads its `replay_ledger_ref`, checks that the report says
  `replay_equivalent: true` and carries `created_at`, copies both
  files out, undoes the three overlays, returns to `main`, copies
  the two files back, and stages exactly those two paths. The commit
  is made as `github-actions[bot]` and pushed with the workflow's
  `GITHUB_TOKEN` (`permissions: contents: write`). A failed run
  commits nothing and opens an issue.
alternatives:
  - label: grant contents write to the existing replay-smoke job
    rejected_because: |
      `run-evidence-gates.yml` runs on every pull request and every
      push. Committing from it would add a bot commit per push and
      would need write access on pull-request runs, which a contract
      gate should not hold. Replay freshness is a calendar property,
      so it belongs on a schedule.
  - label: keep replaying by hand when the evidence window is about to close
    rejected_because: |
      The commit history of `ops/replay-records/` shows hand replays
      on 2026-05-29, 2026-07-25 and 2026-10-02. Each one landed after
      the window was already short, and the next one would be due on
      2026-11-01. A schedule removes the reminder.
  - label: upload the replay record as a workflow artifact instead of committing it
    rejected_because: |
      Workflow artifacts expire and live outside the repo. The
      evidence-quorum check in athena-site reads
      `ops/replay-records/<run-id>/*.json` from a clone, so the
      record has to be in the tree.
rationale: |
  DEC-FIN-007 made replay-smoke a contract gate, and it already
  replays the canonical sample on every push, but the job holds
  `contents: read` and the record it writes is discarded with the
  runner. The committed records are what an outside reader can
  check, and the newest of them ages: athena-site's evidence-quorum
  check counts a repo only when it has a replay record dated within
  30 days. Running the same replay twice a month and keeping the
  record closes that gap without changing what the replay proves.

  The workflow commits two files and no others. `git add -A` would
  also pick up anything the replay or `npm ci` left behind, so the
  step stages the report and the ledger the report names, then
  compares the staged set against those two paths before committing.
  A push made with `GITHUB_TOKEN` does not start other workflows,
  so the bot commit does not re-run the gates.
evidence:
  - kind: decision
    ref: decisions/DEC-FIN-007-chip-supply-chain-map-ci-enforces-run-evidence-chain.md
  - kind: doc
    ref: .github/workflows/replay-freshness.yml
  - kind: doc
    ref: .github/workflows/run-evidence-gates.yml
  - kind: doc
    ref: scripts/replay_run.py
  - kind: doc
    ref: ops/run-records/run-6a665b303138.json
  - kind: spec
    ref: specs/0002-earnings-sensitivity-overlay/requirements.md
rollback: |
  Delete `.github/workflows/replay-freshness.yml` and remove
  `R-FIN-038` from `requirements.md` and `traceability.md`. Replay
  records the workflow already committed stay; they are ordinary
  replay artifacts. `run-evidence-gates.yml` keeps running.
owner: control.coordinator
systems_map: |
  An evidence chain whose proof artifacts expire on a calendar but
  are produced only on demand. The replay already ran on every push;
  the record it produced was thrown away, so freshness depended on a
  person noticing the window closing.
transferable_principle: |
  When a check reads the age of an artifact, the artifact needs a
  producer on a schedule shorter than the window, and the producer
  should commit only the artifact, not whatever else the run left in
  the tree.
falsification_test: |
  If the evidence-quorum check reports this repo as failing while
  the workflow is enabled and its last scheduled run succeeded, the
  schedule or the commit step is not doing what this DEC claims.
adoption_ladder:
  minimum_viable: |
    One scheduled workflow that replays the canonical sample and
    commits the record and its ledger after a successful replay.
  mid_adoption: |
    An issue opens on a failed replay, and the same workflow runs in
    every repo the evidence-quorum check watches.
  full_adoption: |
    The quorum check reads the workflow's last run as well as the
    record dates, so a disabled schedule shows up before the window
    closes.
  monitoring_signals:
    - replay-freshness run status per scheduled run
    - age of the newest record under ops/replay-records/
    - issues opened by the failure step
---

## decision

chip-supply-chain-map adds `.github/workflows/replay-freshness.yml`.
On the 1st and 15th of each month (and on manual dispatch) it runs
the `replay-smoke` sequence from `run-evidence-gates.yml` against the
canonical sample `run-6a665b303138`, then commits the new replay
record and its per-replay ledger to `main` as `github-actions[bot]`.
Nothing is committed unless the replay exits 0 and the record carries
`replay_equivalent: true` and `created_at`. A failed run opens an
issue.

## alternatives

- Grant write access to the existing replay-smoke job: rejected,
  because it runs on every pull request and push, and a contract gate
  should not hold write access.
- Keep replaying by hand: rejected, because the hand replays on
  2026-05-29, 2026-07-25 and 2026-10-02 each landed late in the
  window.
- Upload the record as a workflow artifact: rejected, because
  artifacts expire and the evidence-quorum check reads the tree.

## rationale

The replay-smoke gate already proves the sandbox SHA reproduces the
committed packet on every push, but the record it writes leaves with
the runner. Committing one record twice a month keeps a dated,
inspectable proof in `ops/replay-records/` inside the 30-day window
that athena-site's evidence-quorum check reads. The workflow stages
two named paths and checks the staged set before committing, so the
bot commit never carries more than the replay produced.

## evidence

- `.github/workflows/replay-freshness.yml` is the new workflow.
- `.github/workflows/run-evidence-gates.yml` carries the
  `replay-smoke` sequence the new workflow copies.
- `scripts/replay_run.py` writes the report with `created_at` and
  names its ledger under `replay_ledger_ref`.

## rollback

Delete `.github/workflows/replay-freshness.yml` and remove
`R-FIN-038` from `requirements.md` and `traceability.md`. Records
already committed stay.

## coverage

This DEC resolves the following requirement added to spec 0002:

- `R-FIN-038` a scheduled workflow replays the canonical sample and
  commits only the new replay record and its ledger after a replay
  that exits 0.
