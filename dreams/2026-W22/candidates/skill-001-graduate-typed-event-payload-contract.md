---
id: skill-001-graduate-typed-event-payload-contract
target_kind: skill_patch
skill_id: install-typed-event-payload-contract
week: 2026-W22
mode: skill_extraction
human_review_required: true
evidence:
  - kind: file
    ref: ops/schemas-cache/event.schema.json - typed-payload oneOf
  - kind: commit
    ref: c11d774 - schemas-cache refresh event.schema.json to typed-payload contract
  - kind: file
    ref: scripts/validate_run_evidence.py - cross_check function
  - kind: decision
    ref: decisions/DEC-FIN-004-watchlist-export-run-evidence-cross-checks.md
  - kind: cross_repo
    ref: trace-to-eval-harness - sibling repo carrying the same event schema as a CI dependency
  - kind: cross_repo
    ref: athena-site/ops/schemas/event.schema.json - upstream of the typed-payload contract
---

## proposal

Promote the typed-event payload install pattern into a named skill at
`.agents/skills/install-typed-event-payload-contract/SKILL.md`. The
skill ships with:

- a playbook that names the seven steps to install the contract in a
  new product repo (mirror the schema, wire the validator
  cross-checks, add the CI step, write a canonical sample, add the
  DEC trail, add the R-NNN traceability rows, run the gate suite)
- a 12-line eval set that an installer agent runs to confirm the
  install: schema parses, validator runs clean on the canonical
  sample, validator fails on six negative cases, CI workflow file
  carries the required step, decision trail covers the install
- the DEC trail from chip-supply-chain-map (DEC-FIN-003 +
  DEC-FIN-004) as the reference install, and a pointer to athena-site
  as the schema upstream
- a cross-link section listing the three repos where the contract
  is already installed and the next two repos in the portfolio that
  could install it (procurement-negotiation-lab,
  supplier-risk-rag-agent)

## rationale

The typed-event payload contract has now been installed in three
places across the portfolio:

1. `chip-supply-chain-map` - this repo. Installed in W22 across
   rounds 3 through 5 (`c11d774`, `cc2802b`, `ef79a7f`).
2. `trace-to-eval-harness` - sibling repo that consumes
   `event.schema.json` as a CI dependency for the cross-portfolio
   trace harness.
3. `athena-site` - upstream of the schema at
   `ops/schemas/event.schema.json`. The cache files in product
   repos mirror from there.

Three installs is the dream graduation threshold from W21. The
fourth install (the next product repo that wants run-evidence
emission) reads three repos worth of commits to reconstruct the
install steps. The skill collapses the fourth install to a
playbook run.

The install pattern is non-trivial: the schema, the validator
cross-check, the CI step, the canonical sample, the DEC trail, and
the traceability rows are all coupled. Missing any one piece
produces a soft-failure (the gate passes, the contract is not
enforced). The skill encodes the coupling.

## cross-link to portfolio

The two product repos most likely to install this next:

- `procurement-negotiation-lab` - already ships a deterministic
  packet (the EAS three-profile shape). Adding typed-event payloads
  would close the audit trail on negotiation runs.
- `supplier-risk-rag-agent` - already ships a deterministic packet
  (the hybrid ranker). Adding typed-event payloads would close the
  audit trail on retrieval runs.

The skill name (`install-typed-event-payload-contract`) is
deliberately portable across the portfolio.

## scope sketch

- Create `.agents/skills/install-typed-event-payload-contract/`
- Add `SKILL.md` (the playbook, the eval set, the install
  checklist)
- Add `references/` with a copy of the chip-supply-chain-map
  install commits and the DEC trail
- Add `eval/` with the 12-line eval list as a runnable script
- Wire the skill into `.agents/skills/README.md` index and into
  `.agents/CATALOG.md`

## evidence

- `ops/schemas-cache/event.schema.json` - the contract being
  graduated.
- `c11d774` - the schema-refresh commit. The point in this repo
  where the contract landed.
- `scripts/validate_run_evidence.py` `cross_check` function - the
  validator side of the install.
- `DEC-FIN-004` - the decision that authorises the cross-check
  contract.
- The cross-repo evidence rows name the two existing installs
  and the two next installs.

## cost + risk

- Cost: **medium.** One new skill directory, one playbook, one
  eval set, two cross-repo references. Single sprint.
- Risk: **medium.** A skill that does not get installed against
  is dead weight. Mitigation: the skill landing PR also opens a
  tracked install ticket in procurement-negotiation-lab so the
  skill graduates from "named" to "exercised" inside one cycle.
  If the install ticket sits open for four weeks, the skill
  gets re-evaluated.
- Timeline: **next month** (W23 to W26).

## owner role

`control.coordinator` for the skill graduation (skills cross repos
and the coordinator owns cross-repo install tracking).
`engineering.implementation` for the playbook prose and the eval
script. `product.spec-writer` for the cross-repo decision that
authorises the skill as the canonical install path.
