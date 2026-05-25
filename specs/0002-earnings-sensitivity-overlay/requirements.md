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
