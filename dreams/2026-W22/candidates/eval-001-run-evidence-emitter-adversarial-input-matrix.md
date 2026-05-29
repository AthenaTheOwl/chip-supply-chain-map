---
id: eval-001-run-evidence-emitter-adversarial-input-matrix
target_kind: test_generation
spec_id: 0002-earnings-sensitivity-overlay
test_path: tests/run-evidence/emitter.adversarial.test.ts
week: 2026-W22
mode: adversarial_simulation
human_review_required: true
evidence:
  - kind: commit
    ref: ae60cc7 - feat(run-evidence) fix sandbox off-by-one
  - kind: commit
    ref: cc2802b - fix(run-evidence) emit schema-required payload keys in watchlist export
  - kind: file
    ref: src/lib/runEvidence.ts - deriveSandboxImageRef, canonicalizeInputs, aggregateGateResults
  - kind: file
    ref: scripts/validate_run_evidence.py - cross_check function
  - kind: decision
    ref: decisions/DEC-FIN-003-watchlist-export-emits-conformant-run-evidence.md
---

## proposal

Add a Jest test file under `tests/run-evidence/emitter.adversarial.test.ts`
that feeds an adversarial input matrix into the run-evidence emitter
and asserts the emitter either produces a schema-conformant Run
record or throws with a documented error class. The matrix targets
the three call sites whose bugs surfaced during the rounds-1-through-8
rollout:

1. `deriveSandboxImageRef` - eight cases: short SHA (7 chars), long
   SHA (40 chars), uppercase SHA, SHA with leading whitespace, SHA
   with trailing newline, empty string, undefined, the W22 round-7
   off-by-one regression case (one char short of 40).
2. `canonicalizeInputs` - six cases: empty array, single input,
   inputs with duplicate paths, inputs with unicode path components,
   inputs with mixed forward + back slashes, inputs with a path
   containing a literal `@PENDING/` token.
3. `aggregateGateResults` - five cases: zero gates, all-pass, all-fail,
   mixed with one gate missing a name, mixed with `all_passed` flag
   disagreeing with the per-gate count.

Each case asserts one of:

- emit succeeds and the produced record validates against
  `ops/schemas-cache/run.schema.json`
- emit throws with a named error class (`RunEvidenceShapeError` or
  similar) and the thrown error carries the case label

## why it earns its keep

The W22 rollout surfaced two emit-side bugs that would have failed
this matrix in week one:

- `ae60cc7` fixed an off-by-one in `deriveSandboxImageRef` that
  produced a 39-char SHA. The matrix case "long SHA, slice end
  index" would have caught it.
- `cc2802b` fixed an emitter that omitted schema-required payload
  keys. The matrix case "single input, all-required-keys-present"
  would have caught it.

Both bugs shipped to disk before the validator caught them. A
property-style matrix run on every PR shortens the catch loop from
"validator-caught after the sample regenerates" to "test-caught at
edit time."

## evidence

- `ae60cc7` - the off-by-one fix. Commit body names the truncation
  as silent.
- `cc2802b` - the missing payload keys fix. Commit body names the
  schema as the gate that caught it.
- `src/lib/runEvidence.ts` - the three call sites the matrix
  targets.
- `scripts/validate_run_evidence.py` - the validator the matrix
  runs the produced record against. The matrix shells out to the
  validator instead of re-implementing the schema check.
- `DEC-FIN-003` - the DEC that defines the emit contract.

## promotion path

A `single-change` workflow run that adds the test file, the
adversarial input fixtures under `tests/run-evidence/fixtures/`,
and wires the file into the Jest config glob. Owner:
`engineering.implementation` for the test code,
`science.proof-gate-runner` for the test matrix review. Gates:
`npm test` runs the new file; the existing
`scripts/validate_run_evidence.py` step checks the produced records.

The test file lives under `tests/` so it does not change CI
runtime by more than a few hundred milliseconds; the 19 cases each
run a synchronous emit + schema check.

## risks if promoted blindly

- The matrix asserts on error classes the emitter does not throw
  today (the emitter currently returns a value or fails the
  validator downstream). Promotion includes the small refactor that
  makes the emitter throw a typed error on shape violations.
- The fixtures under `tests/run-evidence/fixtures/` could drift
  from the production input shape. Mitigation: derive the fixtures
  from the canonical sample at `ops/run-records/run-6a665b303138.json`
  with explicit mutations, never hand-rolled new shapes.
- The 19-case matrix is W22 effort one. A W23 review may add
  fuzzer-style randomized property tests on top of the matrix.
  Promote as v1.
