---
id: DEC-FIN-002-deterministic-watchlist-risk-packets
spec: specs/0002-earnings-sensitivity-overlay/
requirement: R-FIN-002
date: 2026-05-25
status: approved
reversible: true
decision: |
  Build investor watchlist risk packets as deterministic client-side
  exports over sourced graph, score, scenario, and financial sensitivity
  facts. The export layer produces JSON or markdown from existing app
  state and carries source IDs into the packet.
alternatives:
  - label: llm-written narrative packet
    rejected_because: |
      Generated prose can add claims outside the curated graph and
      source rows. The product needs a fact packet with inspectable
      provenance.
  - label: persisted account watchlists
    rejected_because: |
      Accounts and storage add product scope that the MVP does not need.
      The user can copy or download the packet from local app state.
  - label: backend export service
    rejected_because: |
      The browser already has the graph, scores, scenarios, financial
      records, and source references needed for the export.
rationale: |
  A deterministic client export keeps the feature aligned with the
  existing static-data model. It gives investor readers a compact packet
  they can inspect, rerun under scenarios, and trace back to source IDs
  without adding runtime services or unsourced written judgment.
evidence:
  - kind: spec
    ref: specs/0002-earnings-sensitivity-overlay/requirements.md (R-FIN-002)
  - kind: doc
    ref: src/lib/riskPacket.ts
  - kind: doc
    ref: src/components/WatchlistPanel.tsx
  - kind: doc
    ref: src/data/sources.md
rollback: |
  Delete `src/lib/riskPacket.ts`, remove the watchlist panel and
  selected-node watchlist control, remove watchlist state from
  `src/state/store.ts`, remove the R-FIN-002 spec additions, and delete
  this DEC.
owner: engineering
---

## decision

Build investor watchlist risk packets as deterministic client-side
exports over sourced graph, score, scenario, and financial sensitivity
facts. The export layer produces JSON or markdown from existing app
state and carries source IDs into the packet.

## alternatives

- LLM-written narrative packet - generated prose can add claims outside
  the curated graph and source rows.
- Persisted account watchlists - accounts and storage add product scope
  that the MVP does not need.
- Backend export service - the browser already has the graph, scores,
  scenarios, financial records, and source references needed for the
  export.

## rationale

A deterministic client export keeps the feature aligned with the
existing static-data model. It gives investor readers a compact packet
they can inspect, rerun under scenarios, and trace back to source IDs
without adding runtime services or unsourced written judgment.

## evidence

- `specs/0002-earnings-sensitivity-overlay/requirements.md` -
  R-FIN-002.
- `src/lib/riskPacket.ts` - packet aggregation and serializers.
- `src/components/WatchlistPanel.tsx` - watchlist and export UI.
- `src/data/sources.md` - source IDs resolved into packet evidence.

## rollback

Delete the risk packet module, remove the watchlist panel and
selected-node watchlist control, remove watchlist state from the store,
remove the R-FIN-002 spec additions, and delete this DEC.
