import { useMemo, useState } from "react";
import type { FinancialSensitivity } from "../lib/financial";
import {
  buildWatchlistRiskPacket,
  formatRiskPacket,
  type RiskPacketFormat
} from "../lib/riskPacket";
import type { ScoreMap } from "../lib/scoring";
import type { GraphData, SourceRef } from "../lib/types";
import { MAX_WATCHLIST_SIZE, useGraphStore } from "../state/store";
import { ChokepointScoreBadge } from "./ChokepointScoreBadge";

interface WatchlistPanelProps {
  activeScenarioIds: string[];
  financialSensitivityRecords: FinancialSensitivity[];
  graph: GraphData;
  scoreBasis: string;
  scores: ScoreMap;
  sources: Map<string, SourceRef>;
}

export function WatchlistPanel({
  activeScenarioIds,
  financialSensitivityRecords,
  graph,
  scoreBasis,
  scores,
  sources
}: WatchlistPanelProps) {
  const watchlistNodeIds = useGraphStore((state) => state.watchlistNodeIds);
  const addWatchlistNode = useGraphStore((state) => state.addWatchlistNode);
  const removeWatchlistNode = useGraphStore((state) => state.removeWatchlistNode);
  const clearWatchlist = useGraphStore((state) => state.clearWatchlist);
  const [format, setFormat] = useState<RiskPacketFormat>("json");
  const [candidateId, setCandidateId] = useState(graph.nodes[0]?.id ?? "");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle"
  );

  const nodeOptions = useMemo(
    () => [...graph.nodes].sort((a, b) => a.name.localeCompare(b.name)),
    [graph.nodes]
  );
  const packet = useMemo(
    () =>
      buildWatchlistRiskPacket({
        activeScenarioIds,
        financialSensitivityRecords,
        graph,
        scoreBasis,
        scores,
        sources,
        watchlistNodeIds
      }),
    [
      activeScenarioIds,
      financialSensitivityRecords,
      graph,
      scoreBasis,
      scores,
      sources,
      watchlistNodeIds
    ]
  );
  const exportText = useMemo(() => formatRiskPacket(packet, format), [format, packet]);
  const watchedNodes = packet.watchlist;
  const addDisabled =
    !candidateId ||
    watchlistNodeIds.includes(candidateId) ||
    watchlistNodeIds.length >= MAX_WATCHLIST_SIZE;

  function handleAdd() {
    if (addDisabled) {
      return;
    }
    addWatchlistNode(candidateId);
  }

  async function handleCopy() {
    if (watchedNodes.length === 0 || !navigator.clipboard) {
      setCopyStatus("failed");
      return;
    }
    try {
      await navigator.clipboard.writeText(exportText);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1600);
    } catch {
      setCopyStatus("failed");
    }
  }

  function handleDownload() {
    if (watchedNodes.length === 0) {
      return;
    }
    const extension = format === "json" ? "json" : "md";
    const type = format === "json" ? "application/json" : "text/markdown";
    const blob = new Blob([exportText], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chip-watchlist-risk-packet.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="border-t border-line px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Investor watchlist</h2>
        <span className="text-xs font-medium text-[#5f574e]">
          {watchedNodes.length}/{MAX_WATCHLIST_SIZE}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <select
          className="min-w-0 rounded border border-[#c9bbaa] bg-white px-2 py-2 text-sm"
          onChange={(event) => setCandidateId(event.target.value)}
          value={candidateId}
        >
          {nodeOptions.map((node) => (
            <option key={node.id} value={node.id}>
              {node.name}
            </option>
          ))}
        </select>
        <button
          className="rounded border border-[#0f5f57] bg-[#0f766e] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-[#c9bbaa] disabled:bg-[#d8d0c2] disabled:text-[#6b6258]"
          disabled={addDisabled}
          onClick={handleAdd}
          type="button"
        >
          Add
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {watchedNodes.length === 0 ? (
          <p className="rounded border border-line bg-[#f7f4ee] px-3 py-2 text-sm text-[#6b6258]">
            Add companies or graph nodes to build a packet.
          </p>
        ) : (
          watchedNodes.map((node) => (
            <div
              className="flex items-center justify-between gap-2 rounded border border-line bg-[#fbfaf6] px-3 py-2"
              key={node.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{node.name}</p>
                <p className="text-xs text-[#5f574e]">
                  {node.country} - {node.public_ticker}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ChokepointScoreBadge score={node.chokepoint_score ?? 0} size="sm" />
                <button
                  className="rounded border border-[#c9bbaa] bg-white px-2 py-1 text-xs font-semibold text-[#4d4840] hover:border-[#7b341e]"
                  onClick={() => removeWatchlistNode(node.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Metric
          label="avg score"
          value={packet.summary.average_chokepoint_score?.toString() ?? "n/a"}
        />
        <Metric
          label="max score"
          value={
            packet.summary.max_chokepoint_score
              ? packet.summary.max_chokepoint_score.score.toString()
              : "n/a"
          }
        />
        <Metric label="dependencies" value={packet.summary.dependency_count.toString()} />
        <Metric label="regions" value={packet.summary.region_count.toString()} />
      </dl>

      <SummaryList
        items={packet.top_dependencies.map(
          (dependency) =>
            `${dependency.name} (${dependency.country}, ${dependency.highest_strength})`
        )}
        title="Top dependencies"
      />
      <SummaryList
        items={packet.sensitive_links.map(
          (link) => `${link.source_name} -> ${link.target_name} (${link.strength})`
        )}
        title="Sensitive links"
      />

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex rounded border border-[#c9bbaa] bg-white p-0.5">
            {(["json", "markdown"] as const).map((option) => (
              <button
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  format === option
                    ? "bg-[#0f766e] text-white"
                    : "text-[#5f574e] hover:bg-[#f7f4ee]"
                }`}
                key={option}
                onClick={() => setFormat(option)}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
          <button
            className="text-xs font-semibold text-[#7b341e] disabled:text-[#a99d8f]"
            disabled={watchedNodes.length === 0}
            onClick={clearWatchlist}
            type="button"
          >
            Clear
          </button>
        </div>
        <textarea
          className="mt-2 h-40 w-full resize-none rounded border border-[#c9bbaa] bg-white p-2 font-mono text-[11px] leading-4 text-[#1f1c18]"
          readOnly
          value={exportText}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            className="rounded border border-[#0f5f57] bg-[#0f766e] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:border-[#c9bbaa] disabled:bg-[#d8d0c2] disabled:text-[#6b6258]"
            disabled={watchedNodes.length === 0}
            onClick={handleCopy}
            type="button"
          >
            {copyStatus === "copied" ? "Copied" : "Copy"}
          </button>
          <button
            className="rounded border border-[#c9bbaa] bg-white px-3 py-2 text-xs font-semibold text-[#4d4840] disabled:cursor-not-allowed disabled:text-[#a99d8f]"
            disabled={watchedNodes.length === 0}
            onClick={handleDownload}
            type="button"
          >
            Download
          </button>
        </div>
        {copyStatus === "failed" ? (
          <p className="mt-2 text-xs text-[#7f1d1d]">Clipboard unavailable.</p>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-[#f7f4ee] px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b6258]">
        {label}
      </dt>
      <dd className="mt-1 break-words font-semibold">{value}</dd>
    </div>
  );
}

function SummaryList({ items, title }: { items: string[]; title: string }) {
  return (
    <section className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5f574e]">
        {title}
      </h3>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-[#4d4840]">
        {items.length === 0 ? (
          <li className="rounded border border-line bg-[#f7f4ee] px-2 py-1">
            none
          </li>
        ) : (
          items.slice(0, 4).map((item) => (
            <li className="rounded border border-line bg-[#f7f4ee] px-2 py-1" key={item}>
              {item}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
