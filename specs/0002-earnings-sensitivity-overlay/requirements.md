# requirements: earnings sensitivity overlay

## Scope

Spec 0002 adds a static financial sensitivity layer to the chip map.
It records public-company revenue, capex, backlog, and exposure
claims that explain why selected chokepoints matter to investors.

## Requirements

### R-FIN-001: static sourced financial sensitivity records

WHEN a user selects a covered node, THE SYSTEM SHALL show financial
sensitivity records from `src/data/financial_sensitivity.csv` without
market feeds or paid APIs.

Acceptance:
- The CSV columns are `company`, `ticker`, `node_id`, `scenario_id`,
  `metric_name`, `metric_value`, `period`, `source_id`,
  `sensitivity_band`, and `note`.
- Each row carries a `source_id` listed in `src/data/sources.md`.
- The selected-node panel lists matching rows with metric, period,
  scenario label, sensitivity band, note, and source link.
- Active scenario matches are marked in the panel.
- The 180-day freshness script checks the financial CSV.

### R-FIN-002: investor watchlist risk packet export

WHEN a user builds a small watchlist from graph nodes, THE SYSTEM
SHALL show an aggregate exposure summary and export a deterministic
risk packet assembled from existing graph and financial sensitivity
facts.

Acceptance:
- The user can add and remove graph nodes without auth, persistence,
  backend storage, or paid data feeds.
- The watchlist summary shows watched-node count, average and maximum
  chokepoint score when scores are present, top dependencies, top
  regions, and sensitive graph links.
- The export can be copied or downloaded as JSON or markdown.
- The export includes source IDs and source labels or URLs for graph
  nodes, edges, and financial sensitivity rows when those references
  are available.
- The export is derived from data fields already loaded in the app and
  does not write analyst recommendations.
