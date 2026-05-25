# traceability: earnings sensitivity overlay

| Requirement | Design surface | Planned proof | Owner role |
|---|---|---|---|
| R-FIN-001 | `src/data/financial_sensitivity.csv`, `src/lib/financial.ts`, `src/components/NodeDetailPanel.tsx`, `src/data/sources.md` | full python gate list plus `npm run build` | `owner_role: engineering.implementation` |
| R-FIN-002 | `src/lib/riskPacket.ts`, `src/components/WatchlistPanel.tsx`, `src/state/store.ts`, `src/components/NodeDetailPanel.tsx` | `npm test`, full python gate list, `npm run build`, `npm run lint` | `owner_role: engineering.implementation` |
