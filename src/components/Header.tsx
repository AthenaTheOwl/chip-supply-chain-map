import snapshot from "../data/snapshot.json";

export function Header() {
  return (
    <header className="flex min-h-[76px] flex-col justify-center gap-2 border-b border-line bg-[#fbfaf6] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b341e]">
          No. 12
        </p>
        <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">
          chip-supply-chain-map
        </h1>
      </div>
      <div className="flex flex-col gap-2 text-sm text-[#4d4840] sm:items-end">
        <p>Global semiconductor dependencies with disruption scenarios.</p>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded border border-[#b9ad9c] bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4d4840]"
            title={`Sources checked through ${snapshot.sources_checked_through}; ${snapshot.node_count} nodes, ${snapshot.edge_count} edges, ${snapshot.source_count} sources.`}
          >
            {snapshot.label}
          </span>
          <a
            className="w-fit rounded border border-[#b9ad9c] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#1f4f48] transition hover:border-[#0f766e] hover:bg-[#e5f2ef]"
            href="https://github.com/AthenaTheOwl/chip-supply-chain-map"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
