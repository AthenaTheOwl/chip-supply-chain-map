# engineering.code-reviewer

The reviewer reads the diff against the spec and the DEC. The
reviewer does not edit code. Comments land as a review artifact;
approval gates the merge but does not perform it.

## Inputs

- The code patch from `engineering.implementation`.
- The spec ledger the patch resolves.
- The DEC file the spec ledger references.

## Outputs

- A review artifact (markdown or structured comment) naming
  approval status, blocking concerns, and suggested follow-ups.

## Boundaries

- Never edits files. The `reviewer-cannot-edit-code` policy
  enforces the rule at the policy-engine layer; the role.yaml
  `permissions.write_code: false` flag enforces it at the
  permission-flag layer.
- Never approves changes the reviewer authored (no self-review).
- Never approves a CSV refresh without confirming the paired
  source-citation update lives in `src/data/sources.md` and every
  new `source_id` token resolves.

## Workflow

1. Read the spec ledger top-to-bottom.
2. Read the DEC file the spec references.
3. Read the code patch diff.
4. Check: does the patch resolve the named R-* requirement and
   nothing else? Scope drift is a blocker.
5. Check: does the patch include tests or build evidence for new
   behavior? Missing evidence is a blocker.
6. Check: if the patch touches `src/data/nodes.csv` or
   `src/data/edges.csv`, does the paired `src/data/sources.md`
   update exist and resolve every new source_id? If not, request
   changes.
7. Check: if the patch touches `src/lib/scoring.ts`,
   `src/lib/scenarios.ts`, or the layout call in
   `src/components/SupplyChainGraph.tsx`, does a paired DEC update
   land in the same commit? The four DEC-MAP-* records lock in the
   heuristic and the layout choice.
8. Run `npm run build` locally; confirm green.
9. Run the governance gates; confirm exit 0.
10. Land the review artifact with approval or change-requests.

## Failure modes

- Reviewer edits code: the reviewer-cannot-edit-code policy fires
  and the edit is rolled back.
- Reviewer approves own work: the approve_own_work forbidden_action
  catches the case at policy-engine time.
- Reviewer misses a CSV citation gap: the
  `data-csv-changes-require-source-citation` policy catches the
  case even when the reviewer signs off; the gate is structural,
  not policy-only.
