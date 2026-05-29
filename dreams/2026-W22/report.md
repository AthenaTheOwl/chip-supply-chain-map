# dream 2026-W22 - engineering-grade run-evidence retrospective

**week of 2026-05-22 through 2026-05-29 - generated 2026-05-29 - model: claude-opus-4-7 - run by: learning.dream-orchestrator**

The Friday dream pass against chip-supply-chain-map. Seventeen commits
landed on main during the window, almost all of them rounds 1 through
8 of the v2 engineering-grade run-evidence rollout. The pass scans the
emitter module, the validator, the deterministic replay command, the
portable repo URI migration, the CI contract that closes the
enforcement chain, and the canonical sample at run-6a665b303138.
Five of the seven dream modes run; two sit out with a named
precondition (see meta.yaml).

## What the week shipped

The retrospect anchors on four things that are now load-bearing in
this repo that were not 30 days ago:

1. **Typed event payloads.** `ops/schemas-cache/event.schema.json`
   moved from an `additionalProperties: true` shape into a
   discriminated `oneOf` over event types. The `tool.call.completed`
   branch requires `tool_name`. The `gate.run.evidence_recorded`
   branch requires `fields_populated`. The `pipeline.done` branch
   carries a `gate_results_summary` shape that the validator
   cross-checks against the Run record. The schema is a gate, not a
   hint.
2. **Portable `repo://` URIs.** `DEC-FIN-006` moved the emitter off
   absolute host paths onto `repo://chip-supply-chain-map@<sha>/...`
   for inputs + sandbox refs and `artifact://chip-supply-chain-map/...`
   for outputs. The migration also fixed a SHA-truncation off-by-one
   in `deriveSandboxImageRef` that had been masking a real bug behind
   a plausible-looking 39-char ref. `scripts/finalize_sandbox_ref.py`
   rewrites `@PENDING/` placeholders to the real HEAD SHA in a
   separate step.
3. **Deterministic replay command.** `scripts/replay_run.py` verifies
   HEAD against the recorded sandbox SHA, recomputes the input + tool
   schema hashes against the recorded Run record, shells out to
   `node scripts/export_watchlist.mjs --no-emit-evidence`, hashes the
   produced packet, and compares against the committed `packet_ref`
   hash. A divergence exits 1 with a typed verdict
   (`input_hash_mismatch`, `output_hash_mismatch`, etc.) and writes
   the replay record + `run.evidence.replayed` event to disk.
4. **CI contract that enforces all of it.** `DEC-FIN-007` plus the
   three workflow files (`gates.yml`, `build.yml`,
   `run-evidence-gates.yml`) pin the ten DEC-CDCP-015 enforcement
   gates to every PR + every push to main. Zero
   `continue-on-error: true` and zero `if: always()` on contract
   steps. The replay-smoke step checks out the recorded sandbox SHA
   on a `fetch-depth: 0` clone and runs the full replay against the
   canonical sample on every CI run.

## What is now load-bearing that was not

Six landmarks the rollout established. Each one is the kind of thing
that, if it broke silently, would leak past inspection:

- **`run.schema.json` + `event.schema.json` are typed contracts.**
  The Run record `prompt_snapshot_hash` + `tool_schemas_snapshot_hash`
  are SHA-256 over canonicalized inputs. `gate_results_summary` is a
  closed shape that the validator cross-check function compares
  against the event ledger `pipeline.done` payload. A drift in either
  direction fails the gate.
- **`run.evidence.replayed` is a first-class event.** Round 4 added
  the event type, Round 5 added the `verdict` enum, Round 7 fixed the
  sandbox SHA derivation. The event is the audit trail of the
  determinism claim.
- **`@PENDING/` is a documented placeholder, not a bug.** The
  two-step pattern (emit with placeholder, then
  `finalize_sandbox_ref.py` rewrites to HEAD SHA) is the way the
  emitter handles "I do not know HEAD at write time." Both the
  validator and the replay command recognise the placeholder and
  refuse to replay against it.
- **The DEC-FIN ledger is the spec.** Five DECs landed during the
  window (DEC-FIN-003 through DEC-FIN-007). Each one carries
  R-FIN-NNN requirements that traceability.md maps to specific source
  files, validators, and CI steps. The spec ledger is the code index.
- **Voice lint runs on every commit in CI.** `voice_lint.py` is one
  of the contract steps in `gates.yml`. The banlist holds 30+ FAIL
  phrases. The W22 commit `eefe52c` removed "harness" from the
  banlist after the role registry made it a load-bearing technical
  term; that delete is the audit trail of how the banlist evolves.
- **`check_no_bom.py` runs everywhere.** Markdown, YAML, JSON, and
  Python files cannot carry a UTF-8 BOM. The W21 commit `fe6126d`
  was the proximate trigger; the W22 CI contract bakes the gate into
  every workflow.

## What surfaced as a fragile edge

Three fragile edges that the rollout exposed and that next week could
harden further:

1. **SHA derivation was off by one.** Round 7
   `deriveSandboxImageRef` fix (`ae60cc7`) caught a substring
   truncation that had been silently producing 39-char SHAs in the
   sample record. The fix shipped with a regression test, but the
   shape of the bug (an off-by-one that produces a syntactically
   plausible value) is the kind that a property-based fuzzer would
   have caught in week one. Candidate `eval-001` proposes the fuzzer.
2. **`@PENDING/` placeholder is a two-step convention with no named
   owner.** The convention works, the finalizer is tested, but the
   only place the two-step shape is documented is the commit body of
   `ae60cc7` plus the DEC-FIN-006 prose. A future agent that emits a
   Run record without running the finalizer would ship a PENDING
   placeholder to disk, and downstream consumers (the replay command)
   would refuse it correctly but late. Candidate `memory-001`
   proposes promoting the convention to AGENTS.md.
3. **Replay-smoke runs once per CI invocation.** The gate proves
   determinism on the single canonical sample on the single CI
   runner. The gate does not prove determinism across runners,
   across timezones, or across repeated runs on the same runner. A
   flake that surfaced once in fifty CI runs would erode trust in
   the whole gate chain. Candidate `backlog-002` proposes a 25x
   replay probe to bound the determinism claim.

## What graduated, what is still local

One pattern crossed the dream graduation threshold:

- **The typed-event payload contract** is now installed in three
  product repos (this one, plus the watchlist contract in
  trace-to-eval-harness CI dependency, plus the same shape
  documented in athena-site schema registry). Candidate `skill-001`
  proposes graduating the install pattern into a named skill so the
  fourth repo install runs against the playbook instead of
  re-reading three repos worth of commits.

One pattern stays local for now:

- **The `replay --diff` mode** that would emit a structured packet
  diff when `replay_equivalent` is false. Candidate `backlog-001`
  proposes the work; today the replay command exits 1 with a verdict
  string and leaves the diff to a human. The diff would let CI red
  signal include a one-screen explanation of the divergence.

## What the dream did not surface

Two of the seven dream modes sit out W22 by design. Each gets a
one-line reason that the W23 pass re-evaluates:

- **prompt_patch_generation** - no versioned prompt files exist in
  the repo. The watchlist export is pure TypeScript; there is no
  prompt to patch. Reopen when a Claude-backed scoring helper lands
  with a versioned prompt file.
- **architecture_drift_detection** - the rounds-1-through-8 spec
  ledger and the file tree match cleanly. Every R-FIN-NNN row in
  traceability.md points at a real file at a real path. Reopen if a
  future round traceability lists files that do not yet exist or
  files that exist without a row.

## Open items for the next human review

Five candidates, one report. The candidates span:

- One **REDUCE** (memory-001 promotes the PENDING convention into
  AGENTS.md so the next agent does not re-discover it).
- One **EXTEND** (backlog-001 adds `replay --diff`).
- One **EXTEND + CROSS-LINK** (skill-001 graduates the typed-event
  payload install into a portable skill that
  procurement-negotiation-lab and supplier-risk-rag-agent could
  install next).
- Two **AUDIT** candidates (eval-001 adversarial-input matrix
  against the emitter; backlog-002 25x replay determinism probe).

The candidate files:

- `candidates/memory-001-pending-sandbox-placeholder-convention.md`
- `candidates/backlog-001-replay-diff-mode-on-divergence.md`
- `candidates/eval-001-run-evidence-emitter-adversarial-input-matrix.md`
- `candidates/skill-001-graduate-typed-event-payload-contract.md`
- `candidates/backlog-002-replay-non-determinism-probe.md`

## Handoff

This dream pass hands off to `control.coordinator` per the
weekly-dream workflow (`.agents/workflows/weekly-dream.yaml` step
`human-review`). The coordinator routes each picked candidate to its
owner role: `engineering.implementation` for the memory update and
the replay-diff backlog item, `science.proof-gate-runner` for the
adversarial-input matrix and the determinism probe,
`control.coordinator` itself for the typed-event skill graduation
(because the skill ships under `.agents/skills/` and crosses repos).

No candidate moves to its target file without human approval.

## Costs

This run produced five candidate files and one report. The dream-job
event lands in `ops/event-log/2026-05-29.jsonl` with the run id, the
modes run, the candidate count, and the cost line. The dream itself
does not emit a Run record; it is an offline-cognition artifact, not
a deterministic pipeline output.
