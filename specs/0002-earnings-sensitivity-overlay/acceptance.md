# acceptance: earnings sensitivity overlay

## Gates

- `python scripts/spec_check.py` exits 0 with spec 0002 listed.
- `python scripts/voice_lint.py` exits 0 across governance copy.
- `python scripts/validate_decisions.py` exits 0 with DEC-FIN-001.
- `python scripts/validate_roles.py` exits 0.
- `python scripts/validate_tools.py` exits 0.
- `python scripts/validate_policies.py` exits 0.
- `python scripts/check_schema_cache_freshness.py` exits 0.
- `python scripts/check_data_freshness.py` exits 0.
- `python scripts/validate_dreams.py` exits 0.
- `npm test` exits 0 when a test script is configured.
- `npm run build` exits 0.
- `npm run lint` exits 0.

## Done means

Spec 0002 is done when:

1. The app ships 8-12 financial sensitivity records with source IDs.
2. Selecting a covered node shows the investor section.
3. Active scenario matches are marked.
4. A user can build a watchlist, review aggregate exposure, and export
   JSON or markdown packets backed by source IDs.
5. The full gate list above passes.
