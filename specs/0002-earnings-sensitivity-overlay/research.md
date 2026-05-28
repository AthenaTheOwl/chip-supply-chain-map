# research: earnings sensitivity overlay

## Sources

The first seed uses official filings, annual reports, investor
relations releases, and company earnings materials already linked or
added as `s104` through `s113` in `src/data/sources.md`.

## Scenario fit

The seeded rows map to the current scenario IDs:

- `hbm-cowos-crunch`
- `taiwan-ai-cluster-stress`
- `lithography-constraint`
- `blackwell-mi-supply-drought`
- `ai-demand-spike`

## Data stance

This layer records published company metrics. It does not estimate
earnings, margins, valuation, share price, or event probability.

## Run-evidence framing (no LLM in the loop)

The watchlist export is the Run boundary for chip-supply-chain-map
under the cross-repo CDCP run-evidence rollout (DEC-CDCP-011 in
athena-site, DEC-FACTORY-007 in procurement-negotiation-lab,
DEC-EVL-006 in supplier-risk-rag-agent). The repo has no LLM in any
production pipeline, so the framing "replay equivalence" sits
differently than in the LLM-driven precedents:

- In an LLM pipeline, `prompt_snapshot_hash` fingerprints the prompt
  body; the same hash plus the same model + temperature + seed plus
  the same retrieved context is the closest a sampler-based runtime
  gets to a deterministic replay.
- In a deterministic data pipeline, the analog is the heuristic
  config: same scoring weights plus same input data plus same code
  equals byte-identical output. The Run record makes that audit
  trail explicit so a future reviewer can re-run from
  `sandbox_image_ref` and confirm byte equality against the
  `tool_schemas_snapshot_hash`.

The four shipped replay-equivalence fields are:

- `prompt_snapshot_hash` = SHA-256 of the canonicalized heuristic
  config (score basis, strength weights, packet version, runtime).
- `tool_schemas_snapshot_hash` = SHA-256 of the canonicalized input
  data files (nodes, edges, sources, financial sensitivity).
- `sandbox_image_ref` = `<repo-path>@<HEAD-SHA>`.
- `gate_results_summary` = aggregated from the two gate events fired
  per run (`input_validation`, `packet_shape`).

`determinism` and `checkpoint_ref` are omitted because there is no
sampler and no resumable checkpoint store. The schema treats
absence as "not applicable", which is the honest record.
