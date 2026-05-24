# traceability: cognitive-delivery-control-plane

| Requirement | Design surface | Planned proof | Owner role |
|---|---|---|---|
| R-CDCP-001 | `scripts/spec_check.py` + `decisions/.spec-check-allowlist.yaml` | `python scripts/spec_check.py` walks every R-* and confirms one DEC reference or allowlist entry per ID | `science.proof-gate-runner` |
| R-CDCP-002 | `scripts/validate_decisions.py` + `ops/schemas-cache/decision.schema.json` | `python scripts/validate_decisions.py` validates each DEC file against the cross-repo schema | `science.proof-gate-runner` |
| R-CDCP-003 | `dreams/README.md` + future `dreams/<week>/output.json` | first dream output lands with a `validate_dreams.py` gate in a later pass; this requirement reserves the contract | `learning.dream-orchestrator` |
| R-CDCP-004 | `ops/RELEASE_LEDGER.md` with the four-commit backfill | manual review during commit; future automation may parse the ledger | `control.coordinator` |
| R-CDCP-005 | `ops/RESET_LEDGER.md` with documented format header | reset entries land in the same push that performs the rewrite | `control.coordinator` |
| R-CDCP-006 | `.agents/AGENTS.md` with the four documented sections | agents read the file first; cross-repo charter names the rule | `control.coordinator` |
| R-CDCP-007 | `.agents/skills/` folder reserved; first SKILL.md lands later | front-matter parses against `skill.schema.json`; future `validate_skills.py` lands when the first skill graduates | `learning.dream-orchestrator` |
| R-CDCP-008 | `.github/workflows/gates.yml` running six python gates | a failed gate fails the CI run on PR | `science.proof-gate-runner` |
| R-CDCP-009 | `dreams/README.md` documents the human-gate rule + `.agents/policies/dream-candidates-require-human-approval.yaml` | dream outputs land with `human_review_required: true`; policy file encodes the rule | `learning.dream-orchestrator` |
| R-CDCP-010 | `scripts/validate_*.py` network-fetch paths + `ops/schemas-cache/` | schema bodies live in athena-site; this repo holds only cache copies | `science.proof-gate-runner` |

## DEC-MAP-* (standalone decision history)

The DEC-MAP-* records carry placeholder requirement IDs
(`R-MAP-001` through `R-MAP-007`). Those IDs are not defined as
requirements in any active spec in this repo today, so the
`scripts/spec_check.py` coverage rule does not gate them. The
DECs stand alone as decision history for the supply-chain map
features:

- `DEC-MAP-001` - Cytoscape over react-flow for 50-200 nodes.
- `DEC-MAP-002` - fcose layout for the supply-chain shape.
- `DEC-MAP-003` - chokepoint score heuristic (four-factor product).
- `DEC-MAP-004` - scenario design as toggle, not slider.
- `DEC-MAP-005` - 180-day data-freshness gate.
- `DEC-MAP-006` - synthetic historical data for pedagogy
  (Scenario History mode).
- `DEC-MAP-007` - HistorySlider mounted inside ScenarioControls.

When a future spec defines the `R-MAP-*` requirement IDs, the
existing DEC files satisfy coverage automatically via their
front-matter `requirement:` keys.
