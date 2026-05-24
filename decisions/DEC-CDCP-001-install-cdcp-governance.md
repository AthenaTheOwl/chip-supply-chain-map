---
id: DEC-CDCP-001-install-cdcp-governance
spec: specs/0001-cognitive-delivery-control-plane/
requirement: R-CDCP-001
date: 2026-05-24
status: approved
reversible: true
decision: |
  Install the Cognitive Delivery Control Plane governance scaffold in
  this repo: .agents/, decisions/, dreams/, ops/RELEASE_LEDGER,
  ops/RESET_LEDGER, plus executable enforcement via
  scripts/validate_decisions.py, scripts/validate_roles.py,
  scripts/validate_tools.py, scripts/validate_policies.py, and an
  extended scripts/spec_check.py that flags any R-* requirement
  without a DEC reference. Also install the operating-model layer:
  six role contracts, a tool registry, six policy files, three state
  machines, and four workflow declarations. The same pass records
  five architectural DECs (DEC-MAP-001..005) covering cytoscape,
  fcose, the chokepoint heuristic, scenario toggles, and the data-
  freshness gate.
alternatives:
  - label: keep the flat DECISIONS.md and call it done
    rejected_because: |
      The flat file generates no executable gate and offers no schema
      to drift against. Four commits shipped under it without one
      structured per-requirement record. The trail is unverifiable.
  - label: adopt a framework stack (LangGraph, CrewAI, Strands)
    rejected_because: |
      Frameworks turn over every six months. The records (specs,
      decisions, traces, ledgers, builds, deployment evidence)
      survive the framework. Adopting a framework now buys lock-in
      and changes no behavior the gates check.
  - label: install only the base CDCP (no operating-model layer)
    rejected_because: |
      The data-update coupling is repo-specific: a change to
      src/data/nodes.csv or src/data/edges.csv without a paired
      source-citation update silently weakens the attestation chain.
      The operating-model layer encodes that as a policy plus a
      workflow gate. Splitting the install into two passes leaves the
      gap open in between.
  - label: build a 12-screen control-plane SaaS
    rejected_because: |
      Premature. Markdown ledgers plus executable gates cover the
      audit-trail and human-review needs at current artifact volume.
      A UI layer over the ledgers lands when volume warrants it; not
      now.
rationale: |
  The CDCP framing came out of a synthesis pass across athena-site
  and the other product repos. Specs were already a strong pattern in
  ai-field-brief; the deploy + build discipline here was strong. The
  agent-side governance was thin: one flat DECISIONS.md, no schema,
  no per-requirement traceability, no gate.

  Installing the scaffold now (instead of waiting until artifact
  volume forces it) keeps the records consistent from the start.
  Backfilling later means the early commits get no DEC and the trail
  has a gap. Installing now also turns the discipline into
  executable gates: validate_decisions, validate_roles, validate_tools,
  validate_policies, and the extended spec_check fail builds when
  records drift out of shape.

  Installing the operating-model layer in the same pass closes the
  data-update loop. The policy
  data-csv-changes-require-source-citation encodes the rule; the
  workflow data-update.yaml documents the steps; the
  reviewer-cannot-edit-code policy keeps the review role bounded.
evidence:
  - kind: spec
    ref: specs/0001-cognitive-delivery-control-plane/
  - kind: doc
    ref: ../athena-site/ops/control-plane.md
  - kind: doc
    ref: ../athena-site/ops/schemas/decision.schema.json
  - kind: doc
    ref: ../athena-site/ops/schemas/role.schema.json
  - kind: doc
    ref: ../athena-site/ops/schemas/tool.schema.json
  - kind: doc
    ref: ../athena-site/ops/schemas/policy.schema.json
  - kind: doc
    ref: ../athena-site/ops/schemas/skill.schema.json
  - kind: doc
    ref: ../athena-site/ops/schemas/dream-output.schema.json
  - kind: decision
    ref: DECISIONS.md (legacy flat file; remains as a rollback target)
rollback: |
  Delete this commit. The added directories (.agents/, decisions/,
  dreams/, ops/, specs/0001-*/) and the new scripts under scripts/
  can be removed wholesale. The existing build.yml and stale-data.yml
  workflows continue to work; the deployed Vercel app is untouched
  by this commit. The legacy DECISIONS.md flat file remains in place
  for the rollback target. No data loss: the cross-repo schemas
  remain in athena-site, and no DEC besides this one and the five
  DEC-MAP-* architectural records was created in the install pass.
owner: platform
---

## decision

Install the Cognitive Delivery Control Plane governance scaffold in
chip-supply-chain-map and make it executable. The scaffold adds
`.agents/AGENTS.md`, a `decisions/` directory with this DEC, five
architectural DEC-MAP-* records, and the allowlist; a `dreams/`
directory with the README and contract reservation; an `ops/`
directory with the two ledgers and the schema cache; and four new
gate scripts (`validate_decisions.py`, `validate_roles.py`,
`validate_tools.py`, `validate_policies.py`) plus `spec_check.py`
and `voice_lint.py`. The same pass installs the operating-model
layer: six role contracts, a tool registry, six policy files, three
state machines, and four workflow declarations.

## alternatives

- Keep the flat `DECISIONS.md` - generates no executable gate.
- Framework stack (LangGraph, CrewAI, Strands) - framework soup;
  does not change behavior the gates check.
- Base CDCP without operating-model layer - leaves the data-update
  coupling gap open.
- 12-screen control-plane SaaS - premature; markdown ledgers cover
  the audit-trail need at current artifact volume.

## rationale

Specs were already strong elsewhere. Decisions were not recorded per
requirement in this repo. The build discipline was strong but the
agent-side governance was thin. Installing the scaffold now keeps
the records consistent from the start and turns the discipline into
executable gates. Installing the operating-model layer in the same
pass closes the data-update loop via policy plus workflow, not via
hope.

## evidence

- `specs/0001-cognitive-delivery-control-plane/` - the spec ledger
  this DEC resolves.
- `../athena-site/ops/control-plane.md` - the cross-repo charter
  that names the six artifact types.
- `../athena-site/ops/schemas/decision.schema.json` - the contract
  this DEC parses against.
- `../athena-site/ops/schemas/role.schema.json`,
  `tool.schema.json`, `policy.schema.json` - the contracts the
  operating-model layer parses against.
- `DECISIONS.md` - the legacy flat file the install replaces for
  per-requirement tracking; the data-model and sourcing notes there
  remain as documentation until later specs absorb them.

## rollback

Delete this commit. Remove the added directories wholesale. Remove
the new gate scripts. The existing `build.yml` and `stale-data.yml`
continue to work against `src/`. The deployed Vercel app is untouched.
No data loss: the cross-repo schemas remain in athena-site, and the
legacy `DECISIONS.md` remains in place as the rollback target.
