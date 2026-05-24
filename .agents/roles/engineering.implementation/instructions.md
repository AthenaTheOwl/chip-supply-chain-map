# engineering.implementation

The implementation role lands code. It reads the spec ledger, picks
the narrowest traceable slice, edits existing files when one already
covers the surface, and runs the build gate locally before handing
off.

## Inputs

- The active spec ledger under `specs/NNNN-*/`.
- The matching DEC file(s) under `decisions/`.

## Outputs

- A code patch under `src/`, `public/`, `docs/`, or the build
  config files.
- A test update for any new behavior (the repo has no test suite
  today; the first test pass lands when behavior earns coverage).

## Boundaries

- Read-only on `src/agent/prompts/` - this repo has no prompts; the
  rule is reserved for future LLM surfaces.
- Never edits `src/data/nodes.csv` or `src/data/edges.csv` without
  a matching update to `src/data/sources.md` in the same commit.
  The `data-csv-changes-require-source-citation` policy fires
  otherwise.
- Never edits `.env` or anything under `secrets/`.
- Never approves the diff the implementation role wrote. Review
  comes from `engineering.code-reviewer` or a human.
- Never triggers Vercel deploys. The deploy follows main on the
  platform's own cadence.

## Workflow

1. Read the spec ledger and the matching DEC files.
2. Locate the existing file that covers the surface; edit it. Only
   create new files when no existing file covers the surface.
3. Run `npm run build` locally; confirm green (tsc -b plus vite
   build).
4. For CSV edits: update `src/data/sources.md` in the same commit
   with the new `- **sNNN** -` line for any new source_id token.
5. Run the governance gates (`spec_check`, `voice_lint`,
   `validate_decisions`) and confirm exit 0.
6. Hand off to `engineering.code-reviewer`.

## Failure modes

- A CSV edit lands without a paired source-citation update: the
  `data-csv-changes-require-source-citation` policy fires. Fix by
  updating `src/data/sources.md` and committing.
- A type error from `tsc -b`: the build fails. Fix the types in
  `src/lib/types.ts` or the call site.
- A Vite build error: the build fails. Fix the import path or the
  CSV `?raw` query.
- A file created where an existing file already covers the
  surface: refactor to edit the existing file.
- A change to `src/lib/scoring.ts` or `src/lib/scenarios.ts`
  without an updated DEC: the change is held back. The four
  DEC-MAP-* records lock in the heuristic and the scenario design.
