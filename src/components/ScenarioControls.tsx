import type { FinancialSensitivity } from "../lib/financial";
import { SCENARIOS } from "../lib/scenarios";
import type { ScoreMap } from "../lib/scoring";
import type { GraphData, SourceRef } from "../lib/types";
import { useGraphStore } from "../state/store";
import { HistorySlider } from "./HistorySlider";
import { WatchlistPanel } from "./WatchlistPanel";

interface ScenarioControlsProps {
  financialSensitivityRecords: FinancialSensitivity[];
  graph: GraphData;
  scoreBasis: string;
  scores: ScoreMap;
  sources: Map<string, SourceRef>;
}

export function ScenarioControls({
  financialSensitivityRecords,
  graph,
  scoreBasis,
  scores,
  sources
}: ScenarioControlsProps) {
  const activeScenarioIds = useGraphStore((state) => state.activeScenarioIds);
  const toggleScenario = useGraphStore((state) => state.toggleScenario);

  return (
    <aside className="z-20 border-b border-line bg-panel lg:h-[calc(100vh-76px)] lg:overflow-auto lg:border-b-0">
      <details className="group lg:block" open>
        <summary className="flex cursor-pointer list-none items-center justify-between border-b border-line px-4 py-4 font-semibold">
          <span>Scenarios</span>
          <span className="text-xs font-medium text-[#5f574e]">
            {activeScenarioIds.length} active
          </span>
        </summary>
        <div className="px-4 py-4">
          <div className="space-y-3">
            {SCENARIOS.map((scenario) => {
              const checked = activeScenarioIds.includes(scenario.id);

              return (
                <label
                  className="block rounded border border-[#d2cabd] bg-[#fbfaf6] p-3 shadow-sm transition hover:border-[#a99d8f]"
                  key={scenario.id}
                >
                  <span className="flex items-start gap-3">
                    <input
                      checked={checked}
                      className="mt-1 h-4 w-4 accent-[#0f766e]"
                      onChange={() => toggleScenario(scenario.id)}
                      type="checkbox"
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        {scenario.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[#5f574e]">
                        {scenario.description}
                      </span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <HistorySlider />
        </div>
      </details>
      <WatchlistPanel
        activeScenarioIds={activeScenarioIds}
        financialSensitivityRecords={financialSensitivityRecords}
        graph={graph}
        scoreBasis={scoreBasis}
        scores={scores}
        sources={sources}
      />
    </aside>
  );
}
