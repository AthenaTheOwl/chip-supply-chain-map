---
id: DEC-FIN-011-systems-thinking-discipline-adoption
amends: DEC-FIN-010-chip-supply-chain-map-chaos-test-suite
spec: specs/0002-earnings-sensitivity-overlay/
requirement: R-FIN-034
date: 2026-05-29
status: approved
reversible: true
decision: |
  chip-supply-chain-map adopts the systems-thinking discipline shipped
  in DEC-CDCP-020 (athena-site). Four steps land in this DEC:

  - `ops/schemas-cache/decision.schema.json`,
    `ops/schemas-cache/dream-output.schema.json`, and
    `ops/schemas-cache/run.schema.json` refresh byte-for-byte from
    athena-site so the four new optional fields (`systems_map`,
    `transferable_principle`, `falsification_test`,
    `adoption_ladder`) are visible to local validators offline.
    `scripts/check_schema_cache_freshness.py` exits 0.
  - `.agents/AGENTS.md` gains a top-level section named
    "Systems-thinking discipline (per DEC-CDCP-020)" that names the
    four fields, the optional-with-warning contract, and the 30-day
    ratchet to a hard failure.
  - `scripts/validate_decisions.py` emits a stderr warning when a DEC
    with `status: approved` is missing any of the four fields. Exit
    code stays 0 during the bootstrap window. The warning names the
    file, the missing fields, and the source DEC.
  - The three most-recent FIN-family DECs (DEC-FIN-008, DEC-FIN-009,
    DEC-FIN-010) carry retrofitted four-field blocks with substantive
    content (not pad). Against the post-retrofit corpus of 19 DECs,
    the validator reports 15 missing-field warnings (four DECs
    populate the fields: FIN-008, FIN-009, FIN-010, and this self-
    applying DEC-FIN-011).

  This DEC is self-applying: the four fields are populated on this
  record itself, so the warning-count drops to 14 once this lands.
alternatives:
  - label: refresh the schema cache without updating AGENTS.md or the validator
    rejected_because: |
      The schema is the contract surface, but the contract only
      exercises when a validator reads it. Updating only the cache
      would leave new DECs in this repo with no prompt to populate
      the four fields. AGENTS.md is the readme the agent reads before
      acting; the validator is the enforcement. The full chain
      (cache + AGENTS.md + validator + retrofit demonstration) is the
      adoption pattern DEC-CDCP-020 specifies.
  - label: skip the retrofit; let the discipline accumulate organically on new DECs
    rejected_because: |
      A zero-example adoption leaves the field meanings abstract. The
      three retrofitted DECs serve as worked examples — a future
      author writing a new DEC can read the FIN-008 / FIN-009 /
      FIN-010 blocks and copy the shape. The retrofit also seeds the
      historical-population denominator the validator monitors over
      30 days.
  - label: ratchet the validator to a hard failure today instead of warning
    rejected_because: |
      DEC-CDCP-020 specifies the 30-day warning window on purpose:
      the discipline is portfolio-wide and the bootstrap pattern lets
      every repo land the adoption without bouncing in-flight DEC
      branches. A unilateral hard failure here would diverge from the
      portfolio contract and bounce any DEC author who has not read
      the AGENTS.md section yet.
  - label: retrofit every historical DEC in the repo (all 18)
    rejected_because: |
      Retrofitting older MAP-family DECs (DEC-MAP-001..007) and
      DEC-FIN-001..007 would either pad fields the original authors
      never considered or invent post-hoc rationales the original
      decisions did not carry. The discipline is forward-looking; the
      three most-recent DECs are the right window because they
      document still-active changes whose adoption ladders are
      visible. A later amendment DEC can widen the retrofit if the
      portfolio-wide pattern calls for it.
rationale: |
  The four fields close gaps the existing DEC shape leaves open: the
  rationale block names WHY at the local level, but does not name the
  systemic pattern (`systems_map`), the principle that would transfer
  to another repo (`transferable_principle`), the observation that
  would falsify the call (`falsification_test`), or the rollout
  steps with monitoring (`adoption_ladder`). Those four dimensions
  are the difference between a recorded decision and an engineering-
  grade claim.

  Adopting in this repo follows the same shape every other CDCP norm
  has taken (schema + AGENTS.md + validator + worked examples). The
  cost is bounded: three schema files copied, a 17-line AGENTS.md
  section, ~25 lines of validator code, and three retrofitted DECs.
  The benefit accrues every time a new DEC author reads AGENTS.md or
  the validator emits a warning.

  Reversible per the standard DEC contract: a single commit reverts
  the schema cache, the AGENTS.md section, the validator block, and
  the four retrofitted blocks. The R-FIN-034..037 requirements come
  out of `requirements.md` and `traceability.md` in the same revert.
evidence:
  - kind: decision
    ref: ../athena-site/decisions/DEC-CDCP-020-systems-thinking-discipline.md
  - kind: doc
    ref: .agents/AGENTS.md
  - kind: doc
    ref: scripts/validate_decisions.py
  - kind: doc
    ref: ops/schemas-cache/decision.schema.json
  - kind: doc
    ref: ops/schemas-cache/dream-output.schema.json
  - kind: doc
    ref: ops/schemas-cache/run.schema.json
  - kind: decision
    ref: decisions/DEC-FIN-008-chip-map-dedicated-determinism-fixture.md
  - kind: decision
    ref: decisions/DEC-FIN-009-additional-scenarios.md
  - kind: decision
    ref: decisions/DEC-FIN-010-chip-supply-chain-map-chaos-test-suite.md
  - kind: spec
    ref: specs/0002-earnings-sensitivity-overlay/requirements.md
rollback: |
  Revert the schema-cache files to their pre-DEC-CDCP-020 shape
  (drop the four properties from each schema). Revert the AGENTS.md
  section and the validator block. Remove the four-field blocks from
  DEC-FIN-008, DEC-FIN-009, and DEC-FIN-010 front-matter. Remove
  `R-FIN-034`..`R-FIN-037` from
  `specs/0002-earnings-sensitivity-overlay/requirements.md` and the
  matching rows from `traceability.md`. The portfolio contract in
  athena-site is unaffected by this repo's local revert.
owner: control.coordinator
systems_map: |
  Per-repo adoption of cross-repo control-plane discipline. The
  schema cache is the contract, AGENTS.md is the readme, the
  validator is the enforcement, the retrofit is the demonstration;
  the four-step chain is the adoption pattern.
transferable_principle: |
  Any cross-repo schema discipline lands via the four-step chain
  (cache refresh -> AGENTS.md section -> validator warning -> worked
  examples). The same pattern applies to future portfolio-wide
  schemas (event shapes, role contracts, policy gates).
falsification_test: |
  If new DECs in this repo over 30 days populate the four fields at
  under 20 percent despite the validator warning and the AGENTS.md
  section, the discipline is not taking hold; escalate via an
  amendment DEC that either ratchets the warning sooner or rewrites
  the four-field prompt.
adoption_ladder:
  minimum_viable: |
    Schema cache refreshed and validator emits warnings on missing
    fields.
  mid_adoption: |
    AGENTS.md section published, new DECs populate the four fields
    organically, three worked examples retrofitted.
  full_adoption: |
    Validator fails on missing fields after 30-day amendment;
    80 percent or more of historical DECs retrofitted; field
    population is the ambient expectation for every DEC author.
  monitoring_signals:
    - new-DEC field-population rate per week
    - validator warning count trend over 30 days
    - count of retrofitted historical DECs
    - whether new DEC authors cite the four fields in PR descriptions
---

## decision

chip-supply-chain-map adopts the systems-thinking discipline from
DEC-CDCP-020 (athena-site). Four steps land:

- The three schema-cache files (`decision`, `dream-output`, `run`)
  refresh byte-for-byte from athena-site so the four new optional
  fields are visible to local validators offline.
- `.agents/AGENTS.md` carries a "Systems-thinking discipline (per
  DEC-CDCP-020)" section that names the four fields, the optional-
  with-warning contract, and the 30-day ratchet.
- `scripts/validate_decisions.py` emits a stderr warning when an
  approved DEC is missing any of the four fields. Exit code stays 0
  during the bootstrap window.
- DEC-FIN-008, DEC-FIN-009, and DEC-FIN-010 carry retrofitted four-
  field blocks with substantive content.

This DEC is self-applying: the four fields are populated on this
record itself.

## alternatives

- Refresh the cache only, skip AGENTS.md and the validator: rejected
  because the contract only exercises when a validator reads it.
- Skip the retrofit and let the discipline accumulate organically:
  rejected because zero examples leave the field meanings abstract.
- Ratchet the validator to a hard failure today: rejected because
  DEC-CDCP-020 specifies the 30-day warning window on purpose.
- Retrofit every historical DEC: rejected because older DECs would
  carry padded fields or invented post-hoc rationales.

## rationale

The rationale block names WHY at the local level; the four new
fields name the systemic pattern, the principle that transfers, the
falsification surface, and the rollout ladder. Those dimensions are
the difference between a recorded decision and an engineering-grade
claim. Adopting in this repo follows the same shape every other CDCP
norm has taken: schema, AGENTS.md, validator, worked examples. Cost
is bounded; benefit accrues every time a new DEC author reads
AGENTS.md or the validator emits a warning.

## evidence

- `../athena-site/decisions/DEC-CDCP-020-systems-thinking-discipline.md`
  is the parent DEC.
- `.agents/AGENTS.md` carries the new section.
- `scripts/validate_decisions.py` carries the warning block.
- The three schema-cache files carry the four new properties.
- DEC-FIN-008, DEC-FIN-009, and DEC-FIN-010 carry the retrofitted
  four-field blocks.
- `specs/0002-earnings-sensitivity-overlay/requirements.md` carries
  R-FIN-034..037.

## rollback

Revert the schema-cache files, the AGENTS.md section, the validator
block, and the four retrofitted blocks. Remove R-FIN-034..037 from
the spec ledger. The portfolio contract in athena-site is unaffected.

## coverage

This DEC resolves the following requirements added to spec 0002:

- `R-FIN-034` `ops/schemas-cache/decision.schema.json`,
  `ops/schemas-cache/dream-output.schema.json`, and
  `ops/schemas-cache/run.schema.json` mirror the athena-site sources
  byte-for-byte and carry the four new optional fields
  (`systems_map`, `transferable_principle`, `falsification_test`,
  `adoption_ladder`).
- `R-FIN-035` `.agents/AGENTS.md` carries a top-level "Systems-
  thinking discipline (per DEC-CDCP-020)" section that names the
  four fields, the optional-with-warning contract, and the 30-day
  ratchet.
- `R-FIN-036` `scripts/validate_decisions.py` emits a stderr warning
  for every DEC with `status: approved` that is missing any of the
  four fields; the warning names the file, the missing fields, and
  the source DEC. Exit code stays 0 during the bootstrap window.
- `R-FIN-037` the three most-recent FIN-family DECs (DEC-FIN-008,
  DEC-FIN-009, DEC-FIN-010) carry the four fields with substantive
  content. Against the post-retrofit corpus of 19 DECs, the
  validator reports 15 missing-field warnings (four DECs populate
  the fields: FIN-008, FIN-009, FIN-010, and this self-applying
  DEC-FIN-011).
