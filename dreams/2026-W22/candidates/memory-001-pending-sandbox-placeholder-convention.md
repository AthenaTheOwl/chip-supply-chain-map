---
id: memory-001-pending-sandbox-placeholder-convention
target_kind: memory_update
target: .agents/AGENTS.md
week: 2026-W22
mode: memory_consolidation
human_review_required: true
evidence:
  - kind: commit
    ref: ae60cc7 - feat(run-evidence) migrate emitter to portable repo:// URIs + fix sandbox off-by-one
  - kind: commit
    ref: d888db0 - chore(run-evidence) finalize sandbox_image_ref SHA on regenerated sample
  - kind: commit
    ref: 86d2248 - chore(run-evidence) regenerate sample with URI emitter + PENDING sandbox
  - kind: decision
    ref: decisions/DEC-FIN-006-watchlist-export-portable-repo-uri-migration.md
  - kind: file
    ref: scripts/finalize_sandbox_ref.py
  - kind: file
    ref: scripts/replay_run.py - PENDING refusal branch
---

## proposal

Add a `## Run-evidence emit + finalize convention` block to
`.agents/AGENTS.md` that names the two-step shape the rounds-1-through-8
rollout settled on. The block sits under `## Workflow conventions`,
above the role catalog.

Proposed text (to be reviewed and edited by a human, not auto-applied):

```markdown
## Run-evidence emit + finalize convention

The emitter at `src/lib/runEvidence.ts` writes Run records with a
`sandbox_image_ref` of `repo://chip-supply-chain-map@PENDING/`. The
placeholder is deliberate: at emission time the agent does not know
which commit HEAD will be at when the record lands.

After the record is written, run:

    python scripts/finalize_sandbox_ref.py ops/run-records/<run-id>.json

The finalizer rewrites every `@PENDING/` token in `sandbox_image_ref`
and `inputs[].ref` to the supplied head SHA, is idempotent on
already-resolved records, exits 1 on missing files, and supports
partial rewrites. Without the finalize step, downstream consumers
refuse the record:

- `scripts/validate_run_evidence.py` flags `sandbox_image_ref:
  PENDING` as a validation failure.
- `scripts/replay_run.py` exits 1 with `verdict: pending_placeholder`
  before it touches HEAD.

Either step covers the agent that forgets, but late. Run the
finalizer in the same commit that lands the Run record, never as a
follow-up.
```

## why it earns its keep

The two-step shape is the load-bearing pattern from rounds 6 through 8.
Today it lives in three places that an agent has to find first: the
commit body of `ae60cc7`, the DEC-FIN-006 prose, and the docstring of
`finalize_sandbox_ref.py`. None of those three places is in AGENTS.md,
which is the file the agent reads at session start.

The W22 commit `d888db0` (one commit after the URI migration) was the
finalize step. Without the convention named in AGENTS.md, the next
agent that emits a Run record reproduces the missing-finalize bug in
their first commit, catches it from the validator, and pays the cost
of a second commit to fix.

## evidence

- `ae60cc7` - the W22 commit that introduced the placeholder and the
  finalize script. Commit body documents the two-step shape but no
  reader-side file points at it.
- `d888db0` - the follow-up commit that ran the finalizer. The fact
  that this is a separate commit is the artifact of the missing
  convention; with the AGENTS.md block, the finalize would land in
  the same commit as the emit.
- `decisions/DEC-FIN-006-watchlist-export-portable-repo-uri-migration.md`
  - the DEC that authorises the convention. The DEC is correct prose;
  it is not where an agent looks at session start.
- `scripts/finalize_sandbox_ref.py` - the tool. The docstring names
  the convention but the tool is opt-in by file path.
- `scripts/replay_run.py` - the PENDING refusal branch that catches
  the missing finalize, but late.

## promotion path

If approved, the change touches one file:

- `.agents/AGENTS.md` - add the new block under `## Workflow
  conventions`.

Reviewer checks:

1. Block reads in under 30 seconds.
2. The finalize command in the block matches the actual CLI of
   `scripts/finalize_sandbox_ref.py` (including the trailing
   positional argument).
3. The PENDING refusal verdict string in the block matches the
   actual string emitted by `scripts/replay_run.py`.
4. The block clears `voice_lint.py` and `check_no_bom.py` when it
   lands.

Owner role: `engineering.implementation`.

## risks if promoted blindly

- The block names two scripts by path. A future refactor that
  renames either script (for example to move into a `scripts/run-
  evidence/` subdirectory) breaks the block. Mitigation: name the
  scripts by the function they perform, link the path as a
  for-reference detail.
- The convention is specific to the watchlist export today. If a
  second pipeline lands that emits Run records, the block should
  generalize. Promote as v1; revisit when the second pipeline
  lands.
- AGENTS.md is the contract the agent reads first. Adding a 30-line
  block nudges the file toward a runbook. Reviewer should weigh
  whether the block belongs in AGENTS.md or in a new
  `RUNBOOK-run-evidence.md` file.
