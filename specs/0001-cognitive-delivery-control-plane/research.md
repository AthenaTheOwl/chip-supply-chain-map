# research: cognitive-delivery-control-plane

Research checked 2026-05-24.

- The CDCP framing came out of a synthesis pass across athena-site
  and the other product repos. Specs were already gated by a six-file
  pattern in `ai-field-brief`; decisions were not. The chip-supply-
  chain-map here had a single flat `DECISIONS.md` file with no
  schema, no per-requirement traceability, and no gate.
- The cross-repo schemas under `athena-site/ops/schemas/` (artifact,
  decision, dream-output, role, tool, policy, skill) are the source
  of truth. This repo references them by URL and keeps a local cache
  copy for offline CI.
- Anthropic's published guidance on agent skills (March 2026) frames
  a skill as instructions plus optional scripts and evals, graduated
  from observed practice. The `skill.schema.json` shape in
  athena-site follows that pattern.
- The codex workflow pattern in athena-site uses declarative YAML
  workflows with named steps; this repo mirrors that under
  `.agents/workflows/`.
- The reset ledger pattern came from the procurement-negotiation-lab
  repo's audit-trail discipline; force-pushes get recorded in the
  same push so the trail survives the rewrite.
- The release ledger backfill covers four commits from `611e497`
  (initial supply-chain map build) through `1a8b796` (the deployed
  URL doc pass). Each entry names which gates the release passed.
- The 180-day data-freshness gate already lives in
  `.github/workflows/stale-data.yml` and pairs with the broader
  athena-site portfolio-manifest. This spec writes the rule down as
  DEC-MAP-005 and threads the policy + workflow on top.

## Why now

- Specs alone do not record why a path was chosen over alternatives.
  DEC files fill that gap. The repo shipped four commits without one
  structured decision record (only the flat `DECISIONS.md`).
- The build discipline was already strong (Vite + TypeScript strict
  + a deployed Vercel preview), but the agent-side governance was
  thin. CDCP closes the loop.
- The data-update coupling is repo-specific: a change to
  `src/data/nodes.csv` or `src/data/edges.csv` without a matching
  source citation in `src/data/sources.md` silently weakens the
  attestation chain. The operating-model layer encodes that as a
  policy plus a workflow gate, not a hope.

## Alternatives considered

- Keep the single-file `DECISIONS.md` and call it done: skipped
  because the flat file generates no executable gate and offers no
  schema to drift against.
- Adopt a framework stack (LangGraph, CrewAI, Strands): skipped
  because frameworks turn over every six months; the records survive
  the framework.
- A 12-screen control-plane SaaS: deferred until artifact volume
  warrants a UI layer beyond the markdown ledgers.
- Mirror the full 44-role operating-model catalog now: deferred. Six
  roles cover the single-change flow this repo runs; the rest land
  as specs grow into product surfaces that need them.

## Open questions

- When does the first dream output land? Likely after the second
  data-CSV refresh; the agent contract will name the trigger.
- How does the data-update workflow enforce the source-citation
  hard gate in CI? Today the policy file encodes the rule and the
  workflow YAML documents the steps. A future commit wires the
  enforcement into a CI check that diffs the CSV against
  `sources.md`.
- How do dream candidates that propose changes to gate scripts
  themselves get handled? Treated as a skill patch, gated by human
  review.
